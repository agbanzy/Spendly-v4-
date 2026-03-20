import express from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireAdmin, requirePin } from "../middleware/auth";
import { financialLimiter, sensitiveLimiter } from "../middleware/rateLimiter";
import {
  param,
  header,
  validateAmount,
  resolveUserCompany,
  getSettingsForRequest,
  logAudit,
  getAuditUserName,
  payoutSchema,
} from "./shared";
import {
  paymentService,
  REGION_CONFIGS,
  getRegionConfig,
  getCurrencyForCountry,
  getPaymentProvider,
} from "../paymentService";
import {
  getStripeClient,
  getUncachableStripeClient,
  getStripePublishableKey,
} from "../stripeClient";
import { getPaystackPublicKey, paystackClient } from "../paystackClient";
import { mapPaymentError, Money, paymentLogger } from "../utils/paymentUtils";
import { IdempotencyCache } from "../utils/idempotencyCache";
import { validateTransferRequest } from "../lib/validators";
import { db } from "../db";
import { companyBalances, transactions as transactionsTable } from "@shared/schema";
import { eq } from "drizzle-orm";
import { notificationService } from "../services/notification-service";
import { computeNextDate } from "../recurringScheduler";

const router = express.Router();

// ==================== PAYMENT ROUTES ====================

router.get("/regions", async (req, res) => {
  try {
    res.json(REGION_CONFIGS);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch regions" });
  }
});

router.get("/region/:countryCode", async (req, res) => {
  try {
    const config = getRegionConfig(param(req.params.countryCode));
    if (!config) {
      return res.status(404).json({ error: "Region not found for country" });
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch region config" });
  }
});

router.get("/currency/:countryCode", async (req, res) => {
  try {
    const currency = getCurrencyForCountry(param(req.params.countryCode));
    res.json(currency);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch currency" });
  }
});

router.get("/payment/keys", async (req, res) => {
  try {
    let stripeKey: string | null = null;
    let paystackKey: string | null = null;

    try {
      stripeKey = await getStripePublishableKey();
    } catch (e) {
      console.log("Stripe not configured");
    }

    try {
      paystackKey = getPaystackPublicKey();
    } catch (e) {
      console.log("Paystack not configured");
    }

    res.json({
      stripe: stripeKey,
      paystack: paystackKey,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payment keys" });
  }
});

// Stripe checkout session for card payments (non-African countries)
const checkoutSessionSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(3).max(3),
  countryCode: z.string().min(2).max(2),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  metadata: z.record(z.any()).optional(),
});

router.post("/stripe/checkout-session", requireAuth, async (req, res) => {
  try {
    const result = checkoutSessionSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid checkout data", details: result.error.issues });
    }

    const { amount, currency, successUrl, cancelUrl, metadata } = result.data;

    const stripe = await getUncachableStripeClient();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: metadata?.description || 'Wallet Funding',
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: metadata || {},
    });

    res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    const mapped = mapPaymentError(error, 'payment');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

const processedConfirmPayments = new IdempotencyCache(10000, 3600000); // 1 hour TTL

router.post("/stripe/confirm-payment", requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID required" });
    }

    if (processedConfirmPayments.has(sessionId)) {
      return res.json({ success: true, status: 'completed', duplicate: true });
    }

    const userId = (req as any).user?.uid || (req as any).user?.id;
    const stripe = await getUncachableStripeClient();

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const sessionUserId = (session.metadata as any)?.userId;
    if (sessionUserId && sessionUserId !== userId) {
      return res.status(403).json({ error: "This payment session does not belong to your account" });
    }

    if (session.payment_status === 'paid') {
      const amount = (session.amount_total || 0) / 100;
      const currency = session.currency?.toUpperCase() || 'USD';

      const existingTx = await storage.getTransactionByReference(`STRIPE-${sessionId}`);
      if (existingTx) {
        return res.json({ success: true, status: 'completed', duplicate: true });
      }

      processedConfirmPayments.add(sessionId);

      if (userId) {
        const userWallet = await storage.getWalletByUserId(userId, currency);
        if (userWallet) {
          await storage.creditWallet(
            userWallet.id,
            amount,
            'deposit',
            `Card payment via Stripe - ${sessionId}`,
            `STRIPE-${sessionId}`,
            { provider: 'stripe', sessionId }
          );
        } else {
          await storage.createWallet({
            userId,
            currency,
            balance: String(amount),
            status: 'active',
          });
        }
      }

      await storage.createTransaction({
        type: 'funding',
        amount: String(amount),
        fee: "0",
        status: 'completed',
        description: `Card payment via Stripe - ${sessionId}`,
        currency,
        date: new Date().toISOString().split('T')[0],
        reference: null,
        userId: (req as any).user?.uid || null,
      });

      res.json({
        success: true,
        amount,
        status: 'completed',
      });
    } else {
      res.json({
        success: false,
        status: session.payment_status,
      });
    }
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'payment');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

const paymentIntentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(1),
  countryCode: z.string().min(2).max(2),
  email: z.string().email().optional(),
  metadata: z.record(z.any()).optional(),
});

router.post("/payment/create-intent", requireAuth, async (req, res) => {
  try {
    const result = paymentIntentSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid payment data", details: result.error.issues });
    }

    const { amount, currency, countryCode, email, metadata } = result.data;
    const paymentResult = await paymentService.createPaymentIntent(
      amount,
      currency,
      countryCode,
      { email, ...metadata }
    );

    res.json(paymentResult);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'stripe/paystack');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

const transferSchema = z.object({
  amount: z.number().positive(),
  countryCode: z.string().min(2).max(2),
  reason: z.string().min(1),
  recipientDetails: z.object({
    // Common fields
    accountNumber: z.string().optional(),
    accountName: z.string().optional(),
    currency: z.string().optional(),
    country: z.string().optional(),
    accountType: z.enum(['individual', 'company']).optional().default('individual'),
    // Paystack fields (Africa)
    bankCode: z.string().optional(),
    // Stripe Connect
    stripeAccountId: z.string().optional(),
    // Stripe bank transfer fields (non-African countries)
    routingNumber: z.string().optional(),  // US ACH routing number
    sortCode: z.string().optional(),        // UK BACS sort code
    bsbNumber: z.string().optional(),       // AU BECS BSB number
    iban: z.string().optional(),            // EU SEPA IBAN
    swiftCode: z.string().optional(),       // International SWIFT/BIC
  }),
});

// ==================== BANK DETAIL VALIDATION ====================

router.post("/validate/bank-details", requireAuth, async (req, res) => {
  try {
    const { validateBankDetails, getRequiredBankFields } = await import('../utils/bankValidation');
    const result = validateBankDetails(req.body);
    res.json({
      ...result,
      requiredFields: getRequiredBankFields(req.body.countryCode || ''),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Validation failed" });
  }
});

router.post("/payment/transfer", requireAuth, requirePin, financialLimiter, async (req, res) => {
  try {
    const result = transferSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid transfer data", details: result.error.issues });
    }

    const { amount, countryCode, reason, recipientDetails } = result.data;
    const { currency } = getCurrencyForCountry(countryCode);
    const userId = (req as any).user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "User authentication required" });
    }

    // Validate transfer request: currency-country match, amount limits, account format, provider
    const transferValidation = validateTransferRequest({
      amount,
      countryCode,
      currency,
      recipientDetails: {
        accountNumber: recipientDetails.accountNumber,
        bankCode: recipientDetails.bankCode,
        routingNumber: recipientDetails.routingNumber,
        sortCode: recipientDetails.sortCode,
        bsbNumber: recipientDetails.bsbNumber,
        iban: recipientDetails.iban,
      },
    });
    if (!transferValidation.valid) {
      return res.status(400).json({
        error: "Transfer validation failed",
        details: transferValidation.errors,
      });
    }

    // SECURITY: Verify user's personal wallet balance before transfer
    const userWallet = await storage.getWalletByUserId(userId, currency);
    if (!userWallet) {
      return res.status(400).json({
        error: "No wallet found for this user",
        currency
      });
    }

    const walletBalance = parseFloat(String(userWallet.balance || 0));
    if (walletBalance < amount) {
      return res.status(400).json({
        error: "Insufficient wallet balance",
        required: amount,
        available: walletBalance,
        currency
      });
    }

    // SECURITY: Check daily transfer limits (per-user, per-currency)
    // Limits are in local currency units to account for currency value differences
    const DAILY_LIMITS: Record<string, number> = {
      USD: 50000,     // $50,000
      EUR: 45000,     // €45,000
      GBP: 40000,     // £40,000
      AUD: 75000,     // A$75,000
      CAD: 65000,     // C$65,000
      NGN: 50000000,  // ₦50M (CBN regulatory limit for transfers)
      GHS: 500000,    // GH₵500,000
      ZAR: 1000000,   // R1,000,000
      KES: 5000000,   // KSh5,000,000
      EGP: 2000000,   // E£2,000,000
      RWF: 50000000,  // RF50,000,000
      XOF: 30000000,  // CFA30,000,000
    };
    const DAILY_LIMIT = DAILY_LIMITS[currency] || 50000;
    const dailyTotal = await storage.getDailyTransferTotal(userId);
    if (dailyTotal + amount > DAILY_LIMIT) {
      return res.status(400).json({
        error: "Daily transfer limit exceeded",
        limit: DAILY_LIMIT,
        used: dailyTotal,
        requested: amount,
        currency
      });
    }

    // SECURITY: Large transaction alert threshold (scaled per currency)
    const LARGE_THRESHOLDS: Record<string, number> = {
      USD: 10000, EUR: 9000, GBP: 8000, AUD: 15000, CAD: 13000,
      NGN: 10000000, GHS: 100000, ZAR: 200000, KES: 1000000,
      EGP: 400000, RWF: 10000000, XOF: 6000000,
    };
    const LARGE_TRANSACTION_THRESHOLD = LARGE_THRESHOLDS[currency] || 10000;
    if (amount > LARGE_TRANSACTION_THRESHOLD) {
      console.log(`SECURITY ALERT: Large transfer of ${currency} ${amount} by user ${userId}`);
      // In production, this would require 2FA or admin approval
    }

    // Generate unique reference for idempotency tracking
    const transferReference = `TRF-${userId.substring(0, 8)}-${Date.now()}`;

    const transferResult = await paymentService.initiateTransfer(
      amount,
      recipientDetails,
      countryCode,
      reason
    );

    // Debit from user's wallet after successful transfer initiation
    await storage.debitWallet(
      userWallet.id,
      amount,
      'transfer_out',
      `Transfer: ${reason}`,
      transferResult.reference || transferReference,
      { recipientName: recipientDetails.accountName, countryCode }
    );

    // Create transaction record with provider reference for webhook tracking
    const providerRef = transferResult.reference || transferResult.transferId || transferReference;
    await storage.createTransaction({
      type: 'transfer',
      amount: String(amount),
      fee: "0",
      status: 'processing',
      date: new Date().toISOString().split('T')[0],
      description: providerRef, // Store provider reference in description for lookup
      currency,
      reference: null,
      userId: (req as any).user?.uid || null,
    });

    // Send notification (in-app + push) and email separately
    try {
      const notifUserId = (req as any).user?.uid || (req as any).user?.cognitoSub;
      const userEmail = (req as any).user?.email;
      if (notifUserId) {
        await notificationService.notifyPayoutProcessed(notifUserId, {
          amount,
          currency,
          recipientName: recipientDetails.accountName || 'Recipient',
          bankName: recipientDetails.bankCode,
          reference: providerRef,
        });
      }
      if (userEmail) {
        await notificationService.sendPayoutConfirmationEmail({
          email: userEmail,
          name: recipientDetails.accountName || 'User',
          recipientName: recipientDetails.accountName || 'Recipient',
          recipientBank: recipientDetails.bankCode,
          recipientAccount: recipientDetails.accountNumber,
          amount,
          currency,
          reference: providerRef,
          date: new Date().toLocaleDateString(),
        });
      }
    } catch (notifError) {
      console.warn('Transfer notification failed:', notifError);
    }

    try {
      const auditName = await getAuditUserName(req);
      await storage.createAuditLog({
        action: 'transfer_initiated',
        userId: userId || 'system',
        userName: auditName,
        entityType: 'transfer',
        entityId: providerRef,
        details: { amount, currency, reason, recipient: recipientDetails.accountName, countryCode },
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
        createdAt: new Date().toISOString(),
      } as any);
    } catch (e) { /* audit log failure should not block operation */ }

    res.json({ ...transferResult, reference: providerRef });
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'transfer');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

const virtualAccountSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  countryCode: z.string().min(2).max(2),
  phone: z.string().optional(),
});

router.post("/payment/virtual-account", requireAuth, async (req, res) => {
  try {
    const result = virtualAccountSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid account data", details: result.error.issues });
    }

    const { email, firstName, lastName, countryCode, phone } = result.data;
    const accountResult = await paymentService.createVirtualAccount(
      email,
      firstName,
      lastName,
      countryCode,
      phone
    );

    res.json(accountResult);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'virtual_account');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

router.post("/payment/verify", requireAuth, async (req, res) => {
  try {
    const { reference, provider } = req.body;
    if (!reference || !provider) {
      return res.status(400).json({ error: "Reference and provider required" });
    }

    const verifyResult = await paymentService.verifyPayment(reference, provider);
    res.json(verifyResult);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'verify');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

router.get("/payment/banks/:countryCode", requireAuth, async (req, res) => {
  try {
    const banks = await paymentService.getBanks(param(req.params.countryCode));
    res.json(banks);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'banks');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

router.get("/payment/provider-balance/:countryCode", requireAuth, requireAdmin, async (req, res) => {
  try {
    const balances = await paymentService.getBalance(param(req.params.countryCode));
    res.json(balances);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'balance');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// ==================== BILL PAYMENT ====================
const billPaymentSchema = z.object({
  billId: z.string().min(1),
  paymentMethod: z.enum(['wallet', 'card', 'bank']),
  countryCode: z.string().min(2).max(2).default('US'),
});

router.post("/bills/pay", financialLimiter, requireAuth, requirePin, async (req, res) => {
  try {
    const result = billPaymentSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid payment data", details: result.error.issues });
    }

    const { billId, paymentMethod, countryCode } = result.data;
    const bill = await storage.getBill(billId);

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    if (bill.status?.toLowerCase() === 'paid') {
      return res.status(400).json({ error: "Bill already paid" });
    }

    if (paymentMethod === 'wallet') {
      const billAmount = parseFloat(String(bill.amount || 0));
      const billCurrency = bill.currency || 'USD';

      const userId = (req as any).user?.uid || (req as any).user?.id;
      let deducted = false;

      if (userId) {
        const userWallet = await storage.getWalletByUserId(userId, billCurrency);
        if (userWallet) {
          const walletBalance = parseFloat(String(userWallet.balance || 0));
          if (walletBalance < billAmount) {
            return res.status(400).json({ error: "Insufficient wallet balance", available: walletBalance, required: billAmount });
          }
          await storage.debitWallet(
            userWallet.id,
            billAmount,
            'bill_payment',
            `Bill payment - ${bill.name}`,
            `BILL-${billId}-${Date.now()}`,
            { billId }
          );
          deducted = true;
        }
      }

      if (!deducted) {
        const balances = await storage.getBalances();
        let balanceField: string;
        if (billCurrency === 'USD') {
          balanceField = 'usd';
        } else if (billCurrency === balances.localCurrency) {
          balanceField = 'local';
        } else {
          return res.status(400).json({ error: `No company balance available for ${billCurrency}. Please fund a wallet in this currency first.` });
        }
        const currentBalance = parseFloat(String((balances as any)[balanceField] || 0));
        if (currentBalance < billAmount) {
          return res.status(400).json({ error: "Insufficient wallet balance", available: currentBalance, required: billAmount, currency: billCurrency });
        }
        await storage.updateBalances({ [balanceField]: String(currentBalance - billAmount) });
      }

      await storage.updateBill(billId, { status: 'paid' });

      await storage.createTransaction({
        type: 'bill',
        amount: String(bill.amount),
        fee: "0",
        status: 'completed',
        date: new Date().toISOString().split('T')[0],
        description: `Bill payment - ${bill.name}`,
        currency: billCurrency,
        reference: `BILL-${billId}`,
        userId: (req as any).user?.uid || null,
      });

      // Send bill payment notification
      const billPayerUid = (req as any).user?.uid;
      if (billPayerUid) {
        notificationService.notifyBillPaid(billPayerUid, {
          name: bill.name,
          amount: parseFloat(String(bill.amount)),
          currency: billCurrency,
          provider: bill.provider || 'Provider',
        }).catch(console.error);
      }

      res.json({ success: true, message: "Bill paid successfully from wallet" });
    } else {
      const paymentResult = await paymentService.createPaymentIntent(
        parseFloat(String(bill.amount)),
        bill.currency || 'USD',
        countryCode,
        { billId, type: 'bill_payment' }
      );

      res.json({
        success: true,
        requiresPayment: true,
        paymentDetails: paymentResult,
      });
    }
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'bill_payment');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// ==================== DEPOSIT/FUND WALLET ====================
const depositSchema = z.object({
  amount: z.number().positive(),
  source: z.enum(['bank', 'card']),
  countryCode: z.string().min(2).max(2).default('US'),
  email: z.string().email().optional(),
});

router.post("/wallet/deposit", requireAuth, async (req, res) => {
  try {
    const result = depositSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid deposit data", details: result.error.issues });
    }

    const userId = (req as any).user?.uid || (req as any).user?.id;
    const { amount, source, countryCode, email } = result.data;
    const currencyInfo = getCurrencyForCountry(countryCode);

    let wallet = await storage.getWalletByUserId(userId, currencyInfo.currency);

    const paymentResult = await paymentService.createPaymentIntent(
      amount,
      currencyInfo.currency,
      countryCode,
      { email, type: 'wallet_deposit', source, userId, walletId: wallet?.id }
    );

    res.json({
      success: true,
      paymentDetails: paymentResult,
      currency: currencyInfo,
    });
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'deposit');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

const processedDepositReferences = new Set<string>();

router.post("/wallet/deposit/confirm", requireAuth, async (req, res) => {
  try {
    const { paymentIntentId, sessionId, provider, reference: paystackRef } = req.body;
    const userId = (req as any).user?.uid || (req as any).user?.id;

    if (!paymentIntentId && !sessionId && !paystackRef) {
      return res.status(400).json({ error: "Payment reference required (paymentIntentId, sessionId, or reference)" });
    }

    const idempotencyKey = paymentIntentId || sessionId || paystackRef;
    if (processedDepositReferences.has(idempotencyKey)) {
      return res.json({ success: true, message: "Deposit already processed", duplicate: true });
    }

    const existingDepositTx = await storage.getTransactionByReference(`DEP-${idempotencyKey}`);
    if (existingDepositTx) {
      processedDepositReferences.add(idempotencyKey);
      return res.json({ success: true, message: "Deposit already processed", duplicate: true });
    }

    let amount = 0;
    let depositCurrency = 'USD';

    if (sessionId) {
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== 'paid') {
        return res.status(400).json({ error: "Payment not completed" });
      }
      const sessionUserId = (session.metadata as any)?.userId;
      if (sessionUserId && sessionUserId !== userId) {
        return res.status(403).json({ error: "Session does not belong to this user" });
      }
      amount = (session.amount_total || 0) / 100;
      depositCurrency = session.currency?.toUpperCase() || 'USD';
    } else if (paymentIntentId) {
      const stripe = await getUncachableStripeClient();
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (pi.status !== 'succeeded') {
        return res.status(400).json({ error: "Payment not completed" });
      }
      const piUserId = (pi.metadata as any)?.userId;
      if (piUserId && piUserId !== userId) {
        return res.status(403).json({ error: "Payment does not belong to this user" });
      }
      amount = pi.amount / 100;
      depositCurrency = pi.currency?.toUpperCase() || 'USD';
    } else if (paystackRef) {
      const paystackResult = await paymentService.verifyPayment(paystackRef, 'paystack');
      if (!paystackResult || paystackResult.status !== 'success') {
        return res.status(400).json({ error: "Payment verification failed" });
      }
      amount = paystackResult.amount / 100;
      depositCurrency = paystackResult.currency?.toUpperCase() || 'NGN';
    }

    if (amount <= 0) {
      return res.status(400).json({ error: "Invalid payment amount" });
    }

    processedDepositReferences.add(idempotencyKey);

    let wallet = await storage.getWalletByUserId(userId, depositCurrency);

    if (wallet) {
      await storage.creditWallet(
        wallet.id,
        amount,
        'deposit',
        `Wallet deposit confirmed - ${idempotencyKey}`,
        `DEP-${idempotencyKey}`,
        { provider: provider || 'stripe', currency: depositCurrency }
      );
    } else {
      wallet = await storage.createWallet({
        userId,
        currency: depositCurrency,
        balance: String(amount),
        status: 'active',
      });
    }

    await storage.createTransaction({
      type: 'funding',
      amount: String(amount),
      fee: "0",
      status: 'completed',
      date: new Date().toISOString().split('T')[0],
      description: `Wallet deposit confirmed - DEP-${idempotencyKey}`,
      currency: depositCurrency,
      reference: null,
      userId: (req as any).user?.uid || null,
    });

    // Send deposit notification
    notificationService.notifyWalletDeposit(userId, {
      amount,
      currency: depositCurrency,
      method: sessionId ? 'Stripe Checkout' : paymentIntentId ? 'Card Payment' : 'Paystack',
      reference: idempotencyKey,
    }).catch(console.error);

    res.json({ success: true, amount, currency: depositCurrency, message: `${depositCurrency} ${amount} deposited successfully` });
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'deposit_confirm');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// ==================== PAYOUT/WITHDRAW ====================
const walletPayoutSchema = z.object({
  amount: z.number().positive(),
  countryCode: z.string().min(2).max(2).default('US'),
  recipientDetails: z.object({
    accountNumber: z.string().optional(),
    bankCode: z.string().optional(),
    accountName: z.string().optional(),
    stripeAccountId: z.string().optional(),
  }),
  reason: z.string().default('Payout'),
  recurring: z.boolean().optional().default(false),
  frequency: z.enum(['once', 'weekly', 'monthly', 'quarterly', 'yearly']).optional().default('monthly'),
});

router.post("/wallet/payout", requireAuth, requirePin, financialLimiter, async (req, res) => {
  try {
    const result = walletPayoutSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid payout data", details: result.error.issues });
    }

    const { amount, countryCode, recipientDetails, reason } = result.data;
    const { currency } = getCurrencyForCountry(countryCode);

    // Get balance in the correct currency
    const balances = await storage.getBalances();
    let currentBalance = 0;

    // Map currency to balance field (temporary workaround for legacy balance structure)
    if (currency === 'USD' || ['US', 'CA'].includes(countryCode)) {
      currentBalance = parseFloat(String(balances.usd || 0));
    } else {
      // For non-USD currencies, use local balance
      currentBalance = parseFloat(String(balances.local || 0));
    }

    if (currentBalance < amount) {
      return res.status(400).json({
        error: "Insufficient wallet balance",
        required: amount,
        available: currentBalance,
        currency
      });
    }

    const transferResult = await paymentService.initiateTransfer(
      amount,
      recipientDetails,
      countryCode,
      reason
    );

    // Wrap balance deduction + transaction record in a DB transaction
    // to prevent balance/ledger mismatch if either step fails
    await db.transaction(async (tx) => {
      // Deduct from correct currency balance
      const balanceUpdate = (currency === 'USD' || ['US', 'CA'].includes(countryCode))
        ? { usd: String(currentBalance - amount) }
        : { local: String(currentBalance - amount) };
      await tx.update(companyBalances).set(balanceUpdate as any);

      await tx.insert(transactionsTable).values({
        type: 'payout',
        amount: String(amount),
        fee: "0",
        status: 'processing',
        date: new Date().toISOString().split('T')[0],
        description: reason,
        currency,
        reference: null,
        userId: (req as any).user?.uid || null,
      } as any);
    });

    const userId = (req as any).user?.uid || 'system';
    try {
      const auditName = await getAuditUserName(req);
      await storage.createAuditLog({
        action: 'payout_processed',
        userId,
        userName: auditName,
        entityType: 'payout',
        entityId: transferResult?.reference || `PAY-${Date.now()}`,
        details: { amount, currency, reason, recipient: recipientDetails.accountName, countryCode },
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
        createdAt: new Date().toISOString(),
      } as any);
    } catch (e) { /* audit log failure should not block operation */ }

    if (result.data.recurring && result.data.frequency !== 'once') {
      try {
        const company = await resolveUserCompany(req);
        const nextDate = computeNextDate(new Date().toISOString().split('T')[0], result.data.frequency);
        await storage.createScheduledPayment({
          type: 'payout',
          sourceType: 'wallet_payout',
          sourceId: transferResult?.reference || `PAY-${Date.now()}`,
          amount: String(amount),
          currency,
          frequency: result.data.frequency,
          nextRunDate: nextDate,
          recipientType: 'bank_account',
          recipientId: recipientDetails.accountNumber || '',
          recipientName: recipientDetails.accountName || 'Recipient',
          metadata: { countryCode, reason, recipientDetails } as any,
          companyId: company?.companyId,
          createdBy: userId,
        } as any);
      } catch (e) {
        console.error('[Recurring] Failed to create scheduled payout:', e);
      }
    }

    res.json({
      success: true,
      transferDetails: transferResult,
      recurring: result.data.recurring,
      frequency: result.data.recurring ? result.data.frequency : undefined,
      balanceDeducted: {
        amount,
        currency,
        remainingBalance: currentBalance - amount
      }
    });
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'payout');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// ==================== UTILITY PAYMENTS ====================

// List available providers for a utility type
router.get("/payments/utility/providers", requireAuth, async (req, res) => {
  try {
    const { type, countryCode } = req.query;
    if (!type) {
      return res.status(400).json({ error: "type query parameter is required (airtime, data, electricity, cable, internet)" });
    }
    const result = await paymentService.listUtilityProviders(
      type as string,
      (countryCode as string) || 'NG'
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch utility providers", detail: error.message });
  }
});

const utilityPaymentSchema = z.object({
  type: z.enum(['airtime', 'data', 'electricity', 'cable', 'internet']),
  provider: z.string().min(1),
  amount: z.number().positive(),
  reference: z.string().min(1),
  walletId: z.string().optional(),
  userId: z.string().optional(),
  countryCode: z.string().optional().default('US'),
  phoneNumber: z.string().optional(),
  meterNumber: z.string().optional(),
  smartCardNumber: z.string().optional(),
});

// Country-specific validation patterns
const validationPatterns: Record<string, { phone: RegExp; meter: RegExp; smartcard: RegExp }> = {
  NG: { phone: /^0[789][01]\d{8}$/, meter: /^\d{11,13}$/, smartcard: /^\d{10,12}$/ },
  KE: { phone: /^0[17]\d{8}$/, meter: /^\d{8,11}$/, smartcard: /^\d{10}$/ },
  GH: { phone: /^0[235]\d{8}$/, meter: /^\d{11,13}$/, smartcard: /^\d{10}$/ },
  ZA: { phone: /^0[678]\d{8}$/, meter: /^\d{13,14}$/, smartcard: /^\d{10}$/ },
  US: { phone: /^\d{10}$/, meter: /^\d{9,12}$/, smartcard: /^\d{10}$/ },
  GB: { phone: /^0[1-9]\d{9}$/, meter: /^[A-Z0-9]{8,12}$/i, smartcard: /^\d{10}$/ },
  EU: { phone: /^\+?[0-9]{8,15}$/, meter: /^[A-Z]{2}[0-9A-Z]{8,16}$/i, smartcard: /^\d{10,14}$/ },
  DE: { phone: /^\+?49[0-9]{9,12}$/, meter: /^DE[0-9A-Z]{10,14}$/i, smartcard: /^\d{10,12}$/ },
  FR: { phone: /^\+?33[0-9]{9}$/, meter: /^[0-9]{14}$/, smartcard: /^\d{10}$/ },
  EG: { phone: /^(\+?20)?1[0-9]{9}$/, meter: /^\d{10,14}$/, smartcard: /^\d{10,12}$/ },
  RW: { phone: /^(\+?250|07)[0-9]{7,9}$/, meter: /^\d{8,12}$/, smartcard: /^\d{10}$/ },
  CI: { phone: /^(\+?225|0)[0-9]{8,10}$/, meter: /^\d{10,14}$/, smartcard: /^\d{10,12}$/ },
};

// Use getPaymentProvider from paymentService (imported at top) instead of local duplicate

router.post("/payments/utility", requireAuth, async (req, res) => {
  try {
    const result = utilityPaymentSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid utility payment data", details: result.error.issues });
    }

    const { type, provider, amount, reference, walletId, userId, countryCode, phoneNumber, meterNumber, smartCardNumber } = result.data;

    // Validate reference based on type and country
    const patterns = validationPatterns[countryCode?.toUpperCase() || 'US'] || validationPatterns['US'];

    if (type === 'airtime' || type === 'data') {
      const phoneToValidate = phoneNumber || reference;
      const cleanPhone = phoneToValidate.replace(/[\s\-\(\)]/g, '');
      if (!patterns.phone.test(cleanPhone)) {
        return res.status(400).json({ error: `Invalid phone number format for ${countryCode}` });
      }
    }

    if (type === 'electricity') {
      const meterToValidate = meterNumber || reference;
      if (!patterns.meter.test(meterToValidate)) {
        return res.status(400).json({ error: `Invalid meter number format for ${countryCode}` });
      }
    }

    if (type === 'cable') {
      const smartcardToValidate = smartCardNumber || reference;
      if (!patterns.smartcard.test(smartcardToValidate)) {
        return res.status(400).json({ error: `Invalid smart card number format for ${countryCode}` });
      }
    }

    if (type === 'internet') {
      const meterToValidate = meterNumber || reference;
      if (!patterns.meter.test(meterToValidate)) {
        return res.status(400).json({ error: `Invalid account number format for ${countryCode}` });
      }
    }

    // Valid providers by type and region
    const validProviders: Record<string, Record<string, string[]>> = {
      Africa: {
        airtime: ['mtn', 'glo', 'airtel', '9mobile', 'safaricom', 'vodacom'],
        data: ['mtn-data', 'glo-data', 'airtel-data', '9mobile-data', 'spectranet', 'smile'],
        electricity: ['eko', 'ikeja', 'abuja', 'ibadan', 'kplc', 'eskom'],
        cable: ['dstv', 'gotv', 'startimes', 'showmax'],
        internet: ['spectranet', 'smile', 'swift', 'ntel'],
      },
      'US/Europe': {
        airtime: ['verizon', 'tmobile', 'att', 'vodafone', 'ee', 'o2'],
        data: ['verizon-data', 'tmobile-data', 'att-data'],
        electricity: ['pge', 'coned', 'duke', 'edf', 'british-gas'],
        cable: ['netflix', 'hulu', 'hbo', 'disney', 'sky'],
        internet: ['xfinity', 'spectrum', 'att-fiber', 'virgin', 'bt'],
      },
    };

    const africanCountries = ['NG', 'KE', 'GH', 'ZA', 'EG', 'RW', 'CI'];
    const region = africanCountries.includes(countryCode?.toUpperCase() || 'US') ? 'Africa' : 'US/Europe';
    const validProvidersForType = validProviders[region][type] || [];

    if (!validProvidersForType.includes(provider.toLowerCase())) {
      return res.status(400).json({
        error: `Invalid provider '${provider}' for ${type} in ${region}`,
        validProviders: validProvidersForType
      });
    }

    // Get wallet for balance check - try user's wallet first, then company balance
    let wallet: any = null;
    const authUserId = (req as any).user?.uid;
    const effectiveUserId = userId || authUserId;

    if (walletId) {
      wallet = await storage.getWallet(walletId);
    } else if (effectiveUserId) {
      // Try to get user's wallet in the appropriate currency
      const { currency: walletCurrency } = getCurrencyForCountry(countryCode || 'US');
      wallet = await storage.getWalletByUserId(effectiveUserId, walletCurrency);
    }

    if (!wallet) {
      // Fall back to company balance
      const balances = await storage.getBalances();
      const currentLocal = parseFloat(String(balances.local || 0));
      if (currentLocal < amount) {
        return res.status(400).json({
          error: "Insufficient balance",
          message: `You need ${amount} but only have ${currentLocal} available`,
          available: currentLocal,
          required: amount
        });
      }
      await storage.updateBalances({ local: String(currentLocal - amount) });
    } else {
      // Use user wallet
      const walletBalance = parseFloat(String(wallet.balance || 0));
      if (walletBalance < amount) {
        return res.status(400).json({
          error: "Insufficient wallet balance",
          available: walletBalance,
          required: amount
        });
      }

      // Debit wallet
      await storage.debitWallet(
        wallet.id,
        amount,
        'utility_payment',
        `${type.charAt(0).toUpperCase() + type.slice(1)} - ${provider}`,
        `UTL-${Date.now()}`,
        { type, provider, reference, countryCode }
      );
    }

    // Determine payment provider
    const paymentProvider = getPaymentProvider(countryCode || 'US');
    const utilityRef = `UTL-${Date.now()}`;

    // --- CALL REAL PAYMENT PROVIDER ---
    let providerResult: any;
    try {
      providerResult = await paymentService.processUtilityPayment({
        type: type as any,
        provider,
        amount,
        customer: phoneNumber || meterNumber || smartCardNumber || reference,
        countryCode: countryCode || 'US',
        email: (req as any).user?.email,
        metadata: { reference, userId: effectiveUserId, utilityRef },
      });
    } catch (providerErr: any) {
      // Provider call failed — reverse the wallet debit
      if (wallet) {
        try {
          await storage.creditWallet(
            wallet.id, amount, 'utility_reversal',
            `Reversal: ${type} - ${provider} failed`,
            `REV-${utilityRef}`,
            { reason: providerErr.message }
          );
        } catch (reversalErr) {
          console.error('CRITICAL: Utility reversal failed after provider error:', reversalErr);
        }
      } else {
        // Reverse company balance debit
        try {
          const balances = await storage.getBalances();
          const currentLocal = parseFloat(String(balances.local || 0));
          await storage.updateBalances({ local: String(currentLocal + amount) });
        } catch (reversalErr) {
          console.error('CRITICAL: Company balance reversal failed:', reversalErr);
        }
      }

      return res.status(502).json({
        error: `${type} payment failed with provider`,
        detail: providerErr.message,
        reversed: true,
      });
    }

    // Determine final status based on provider response
    const finalStatus = providerResult.status === 'requires_payment_method' ? 'Pending' :
      (providerResult.status === 'pending' ? 'Processing' : 'Completed');

    // Create transaction record with real provider reference
    await storage.createTransaction({
      type: 'bill',
      amount: String(amount),
      fee: "0",
      status: finalStatus,
      date: new Date().toISOString().split('T')[0],
      description: `${type.charAt(0).toUpperCase() + type.slice(1)} - ${provider} (${phoneNumber || meterNumber || smartCardNumber || reference})`,
      currency: wallet?.currency || 'USD',
      reference: providerResult.reference || providerResult.orderId || utilityRef,
      userId: (req as any).user?.uid || null,
    });

    try {
      const auditName = await getAuditUserName(req);
      await storage.createAuditLog({
        action: 'utility_payment',
        userId: effectiveUserId || 'system',
        userName: auditName,
        entityType: 'utility',
        entityId: utilityRef,
        details: {
          type, provider, amount, reference,
          countryCode, paymentProvider,
          providerOrderId: providerResult.orderId,
          providerReference: providerResult.reference,
          providerStatus: providerResult.status,
        },
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
        createdAt: new Date().toISOString(),
      } as any);
    } catch (e) { /* audit log failure should not block operation */ }

    res.json({
      success: providerResult.success,
      message: providerResult.message || `${type.charAt(0).toUpperCase() + type.slice(1)} payment ${finalStatus.toLowerCase()}`,
      reference: providerResult.reference || utilityRef,
      orderId: providerResult.orderId,
      status: finalStatus,
      paymentProvider,
      amount,
      type,
      provider,
      // For Stripe non-African payments, client needs this to complete
      ...(providerResult.clientSecret ? { clientSecret: providerResult.clientSecret } : {}),
    });
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'payment');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// ==================== TRANSACTION PIN ====================
const BCRYPT_ROUNDS = 10;

const setPinSchema = z.object({
  pin: z.string().length(6).regex(/^\d{6}$/, "PIN must be 6 digits"),
});

const verifyPinSchema = z.object({
  pin: z.string().length(6),
});

router.post("/user/set-pin", requireAuth, async (req, res) => {
  try {
    const result = setPinSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid PIN format. Must be 6 digits." });
    }

    // SECURITY: Use authenticated user's identity, not client-provided value
    const cognitoSub = (req as any).user?.cognitoSub || (req as any).user?.uid;
    const { pin } = result.data;
    const bcrypt = await import('bcryptjs');
    const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);

    const profile = await storage.getUserProfileByCognitoSub(cognitoSub);
    if (!profile) {
      return res.status(404).json({ error: "User profile not found" });
    }

    await storage.updateUserProfile(cognitoSub, {
      transactionPinHash: pinHash,
      transactionPinEnabled: true,
    });

    res.json({ success: true, message: "Transaction PIN set successfully" });
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'pin');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

router.post("/user/verify-pin", requireAuth, async (req, res) => {
  try {
    const result = verifyPinSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid PIN format" });
    }

    // SECURITY: Use authenticated user's identity, not client-provided value
    const cognitoSub = (req as any).user?.cognitoSub || (req as any).user?.uid;
    const { pin } = result.data;
    const profile = await storage.getUserProfileByCognitoSub(cognitoSub);

    if (!profile) {
      return res.status(404).json({ error: "User profile not found" });
    }

    if (!profile.transactionPinEnabled || !profile.transactionPinHash) {
      return res.status(400).json({ error: "Transaction PIN not set" });
    }

    const bcrypt = await import('bcryptjs');
    const valid = await bcrypt.compare(pin, profile.transactionPinHash);

    res.json({ valid });
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'pin');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

router.post("/user/disable-pin", requireAuth, async (req, res) => {
  try {
    // SECURITY: Use authenticated user's cognitoSub
    const cognitoSub = req.user!.cognitoSub;

    await storage.updateUserProfile(cognitoSub, {
      transactionPinEnabled: false,
    });

    res.json({ success: true, message: "Transaction PIN disabled" });
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'pin');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// ==================== ACCOUNT VALIDATION ====================
const validateAccountSchema = z.object({
  accountNumber: z.string().min(1),
  bankCode: z.string().min(1),
  countryCode: z.string().min(2).max(2).default('NG'),
});

router.post("/payment/validate-account", requireAuth, financialLimiter, async (req, res) => {
  try {
    const result = validateAccountSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid account data", details: result.error.issues });
    }

    const { accountNumber, bankCode, countryCode } = result.data;

    const isAfricanCountry = ['NG', 'GH', 'KE', 'ZA', 'EG', 'RW', 'CI'].includes(countryCode);

    if (isAfricanCountry) {
      try {
        const verification = await paystackClient.resolveAccount(accountNumber, bankCode);
        res.json({
          success: true,
          accountName: verification.data?.account_name || 'Account Holder',
          accountNumber: verification.data?.account_number || accountNumber,
          bankId: bankCode,
        });
      } catch (error: any) {
        res.status(400).json({ error: "Could not verify account", details: error.message });
      }
    } else {
      res.json({
        success: true,
        accountName: "Account Holder",
        accountNumber,
        bankId: bankCode,
        note: "Account verification simulated for non-African countries",
      });
    }
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'payment');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// ==================== PAYSTACK AUTO-DEBIT & SUBSCRIPTIONS ====================

router.post("/paystack/plans", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, amount, interval, description } = req.body;
    if (!name || !amount || !interval) {
      return res.status(400).json({ error: "Name, amount, and interval are required" });
    }
    const result = await paystackClient.createSubscriptionPlan(name, amount, interval, description);
    res.json(result);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'subscription');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

router.get("/paystack/plans", requireAuth, async (req, res) => {
  try {
    const result = await paystackClient.listPlans();
    res.json(result);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'subscription');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

router.post("/paystack/subscriptions", requireAuth, sensitiveLimiter, async (req, res) => {
  try {
    const { customerEmail, planCode, authorizationCode } = req.body;
    if (!customerEmail || !planCode) {
      return res.status(400).json({ error: "Customer email and plan code are required" });
    }
    const result = await paystackClient.createSubscription(customerEmail, planCode, authorizationCode);
    res.json(result);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'subscription');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

router.get("/paystack/subscriptions", requireAuth, async (req, res) => {
  try {
    const result = await paystackClient.listSubscriptions();
    res.json(result);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'subscription');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

router.post("/paystack/subscriptions/enable", requireAuth, async (req, res) => {
  try {
    const { subscriptionCode, emailToken } = req.body;
    if (!subscriptionCode || !emailToken) {
      return res.status(400).json({ error: "Subscription code and email token are required" });
    }
    const result = await paystackClient.enableSubscription(subscriptionCode, emailToken);
    res.json(result);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'subscription');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

router.post("/paystack/subscriptions/disable", requireAuth, async (req, res) => {
  try {
    const { subscriptionCode, emailToken } = req.body;
    if (!subscriptionCode || !emailToken) {
      return res.status(400).json({ error: "Subscription code and email token are required" });
    }
    const result = await paystackClient.disableSubscription(subscriptionCode, emailToken);
    res.json(result);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'subscription');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// ==================== SUBSCRIPTION MANAGEMENT ====================

// Get current subscription status
router.get("/subscription", requireAuth, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    if (!company) {
      return res.json({ status: 'none', isActive: false, isTrialing: false, isExpired: false, trialDaysLeft: 0 });
    }

    const subscription = await storage.getSubscriptionByCompanyId(company.companyId);
    if (!subscription) {
      return res.json({ status: 'none', isActive: false, isTrialing: false, isExpired: false, trialDaysLeft: 0 });
    }

    const now = Date.now();
    const trialEnd = subscription.trialEndDate ? new Date(subscription.trialEndDate).getTime() : 0;
    const trialDaysLeft = subscription.status === 'trialing' && trialEnd > now
      ? Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000))
      : 0;

    res.json({
      id: subscription.id,
      status: subscription.status,
      isActive: subscription.status === 'trialing' || subscription.status === 'active',
      isTrialing: subscription.status === 'trialing',
      isExpired: subscription.status === 'expired',
      trialDaysLeft,
      trialEndDate: subscription.trialEndDate,
      currentPeriodEnd: subscription.currentPeriodEnd,
      canceledAt: subscription.canceledAt,
      quantity: subscription.quantity,
      unitPrice: subscription.unitPrice,
      currency: subscription.currency,
      provider: subscription.provider,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch subscription" });
  }
});

// Activate subscription (create Stripe/Paystack subscription)
router.post("/subscription/activate", requireAuth, financialLimiter, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    if (!company) {
      return res.status(400).json({ error: "No company context" });
    }

    const subscription = await storage.getSubscriptionByCompanyId(company.companyId);
    if (!subscription) {
      return res.status(404).json({ error: "No subscription found" });
    }

    if (subscription.status === 'active') {
      return res.json({ message: "Subscription already active", subscription });
    }

    const now = new Date().toISOString();

    if (subscription.provider === 'stripe') {
      const stripe = getStripeClient();
      if (!stripe) {
        return res.status(503).json({ error: "Stripe not configured" });
      }

      // Create or get Stripe customer
      let customerId = subscription.providerCustomerId;
      if (!customerId) {
        const settings = await storage.getCompanyAsSettings(company.companyId);
        const customer = await stripe.customers.create({
          email: (req as any).user?.email || settings?.companyEmail || '',
          name: settings?.companyName || '',
          metadata: { companyId: company.companyId },
        });
        customerId = customer.id;
      }

      // Create a price first, then subscription
      const price = await stripe.prices.create({
        currency: 'usd',
        unit_amount: 500,
        recurring: { interval: 'month' },
        product_data: { name: 'Financiar Pro' },
      });

      const stripeSub = await stripe.subscriptions.create({
        customer: customerId!,
        items: [{ price: price.id, quantity: subscription.quantity }],
      }) as any;

      await storage.updateSubscription(subscription.id, {
        status: 'active',
        providerSubscriptionId: stripeSub.id,
        providerCustomerId: customerId,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000).toISOString(),
        updatedAt: now,
      });

      await storage.updateCompanyAsSettings(company.companyId, {
        subscriptionStatus: 'active',
      } as any);

      res.json({ message: "Subscription activated", stripeSubscriptionId: stripeSub.id });
    } else {
      // Paystack subscription activation
      const { authorizationCode, planCode } = req.body;
      if (!authorizationCode || !planCode) {
        return res.status(400).json({ error: "Authorization code and plan code required for Paystack" });
      }

      const profile = await storage.getUserProfileByCognitoSub((req as any).user?.cognitoSub);
      const result = await paystackClient.createSubscription(
        profile?.email || (req as any).user?.email || '',
        planCode,
        authorizationCode
      );

      await storage.updateSubscription(subscription.id, {
        status: 'active',
        providerSubscriptionId: result.data?.subscription_code || '',
        updatedAt: now,
      });

      await storage.updateCompanyAsSettings(company.companyId, {
        subscriptionStatus: 'active',
      } as any);

      res.json({ message: "Subscription activated", paystackResult: result });
    }
  } catch (error: any) {
    console.error('Subscription activation error:', error);
    res.status(500).json({ error: error.message || "Failed to activate subscription" });
  }
});

// Cancel subscription
router.post("/subscription/cancel", requireAuth, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    if (!company) {
      return res.status(400).json({ error: "No company context" });
    }

    const subscription = await storage.getSubscriptionByCompanyId(company.companyId);
    if (!subscription) {
      return res.status(404).json({ error: "No subscription found" });
    }

    const now = new Date().toISOString();

    if (subscription.provider === 'stripe' && subscription.providerSubscriptionId) {
      const stripe = getStripeClient();
      if (stripe) {
        await stripe.subscriptions.update(subscription.providerSubscriptionId, {
          cancel_at_period_end: true,
        });
      }
    }

    await storage.updateSubscription(subscription.id, {
      canceledAt: now,
      updatedAt: now,
    });

    res.json({ message: "Subscription will be canceled at end of current period" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to cancel subscription" });
  }
});

router.post("/paystack/charge-authorization", requireAuth, financialLimiter, async (req, res) => {
  try {
    const { email, amount, authorizationCode, reference, metadata } = req.body;
    if (!email || !amount || !authorizationCode) {
      return res.status(400).json({ error: "Email, amount, and authorization code are required" });
    }
    const result = await paystackClient.chargeAuthorization(email, amount, authorizationCode, reference, metadata);

    if (result.status && result.data?.status === 'success') {
      const amountInNaira = result.data.amount / 100;
      await storage.createTransaction({
        type: 'payout',
        amount: String(amountInNaira),
        fee: "0",
        status: 'completed',
        description: metadata?.description || 'Auto-debit charge',
        currency: 'NGN',
        date: new Date().toISOString().split('T')[0],
        reference: null,
        userId: (req as any).user?.uid || null,
      });
    }

    res.json(result);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'subscription');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

router.get("/paystack/authorizations/:email", requireAuth, async (req, res) => {
  try {
    const result = await paystackClient.listAuthorizations(param(req.params.email));
    res.json(result);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'subscription');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

router.post("/paystack/deactivate-authorization", requireAuth, sensitiveLimiter, async (req, res) => {
  try {
    const { authorizationCode } = req.body;
    if (!authorizationCode) {
      return res.status(400).json({ error: "Authorization code is required" });
    }
    const result = await paystackClient.deactivateAuthorization(authorizationCode);
    res.json(result);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'subscription');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// ==================== PAYSTACK VIRTUAL CARD & TRANSFER METHODS ====================

router.get("/paystack/balance", requireAuth, requireAdmin, async (req, res) => {
  try {
    const balance = await paystackClient.fetchBalance();
    res.json(balance.data);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'balance_check');
    res.status(mapped.statusCode).json({ error: mapped.userMessage });
  }
});

router.post("/paystack/resolve-account", requireAuth, async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.body;
    if (!accountNumber || !bankCode) {
      return res.status(400).json({ error: "Account number and bank code required" });
    }
    const result = await paystackClient.resolveAccountNumber(accountNumber, bankCode);
    res.json(result.data);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'account_resolution');
    res.status(mapped.statusCode).json({ error: mapped.userMessage });
  }
});

router.get("/paystack/banks", requireAuth, async (req, res) => {
  try {
    const country = req.query.country as string || 'nigeria';
    const result = await paystackClient.listBanks(country);
    res.json(result.data);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch banks" });
  }
});

router.get("/paystack/transfer-recipients", requireAuth, async (req, res) => {
  try {
    const perPage = Math.min(Number(req.query.perPage) || 50, 100);
    const page = Number(req.query.page) || 1;
    const result = await paystackClient.listTransferRecipients({ perPage, page });
    res.json(result.data);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'transfer_list');
    res.status(mapped.statusCode).json({ error: mapped.userMessage });
  }
});

router.get("/paystack/transfers/:transferCode", requireAuth, async (req, res) => {
  try {
    const transferCode = param(req.params.transferCode);
    const result = await paystackClient.fetchTransfer(transferCode);
    res.json(result.data);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'transfer_fetch');
    res.status(mapped.statusCode).json({ error: mapped.userMessage });
  }
});

router.post("/paystack/transfers/verify", requireAuth, async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) {
      return res.status(400).json({ error: "Transfer reference required" });
    }
    const result = await paystackClient.verifyTransfer(reference);
    res.json(result.data);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'transfer_verify');
    res.status(mapped.statusCode).json({ error: mapped.userMessage });
  }
});

router.post("/paystack/transfers/finalize", requireAuth, requireAdmin, requirePin, financialLimiter, async (req, res) => {
  try {
    const { transferCode, otp } = req.body;
    if (!transferCode || !otp) {
      return res.status(400).json({ error: "Transfer code and OTP required" });
    }
    const result = await paystackClient.finalizeTransfer(transferCode, otp);
    res.json(result.data);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'transfer_finalize');
    res.status(mapped.statusCode).json({ error: mapped.userMessage });
  }
});

router.post("/paystack/transfers/bulk", requireAuth, requireAdmin, financialLimiter, async (req, res) => {
  try {
    const { transfers } = req.body;
    if (!Array.isArray(transfers) || transfers.length === 0) {
      return res.status(400).json({ error: "Valid transfers array required" });
    }
    const result = await paystackClient.bulkTransfer(transfers);
    res.json(result.data);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'bulk_transfer');
    res.status(mapped.statusCode).json({ error: mapped.userMessage });
  }
});

router.get("/paystack/settlements", requireAuth, requireAdmin, async (req, res) => {
  try {
    const perPage = Math.min(Number(req.query.perPage) || 50, 100);
    const page = Number(req.query.page) || 1;
    const from = req.query.from as string;
    const to = req.query.to as string;
    const result = await paystackClient.fetchSettlements({ perPage, page, from, to });
    res.json(result.data);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'settlements');
    res.status(mapped.statusCode).json({ error: mapped.userMessage });
  }
});

router.post("/paystack/managed-accounts", requireAuth, sensitiveLimiter, async (req, res) => {
  try {
    const { customerId, currency, name } = req.body;
    if (!customerId || !currency || !name) {
      return res.status(400).json({ error: "customerId, currency, and name are required" });
    }
    const result = await paystackClient.createManagedAccount({
      customerId,
      currency,
      name,
      type: 'virtual',
    });
    res.json(result.data);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'managed_account_create');
    res.status(mapped.statusCode).json({ error: mapped.userMessage });
  }
});

export default router;
