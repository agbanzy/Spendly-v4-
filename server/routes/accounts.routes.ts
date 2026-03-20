/**
 * Account routes — virtual account CRUD, deposits, withdrawals, signup-time account creation,
 * and funding source management.
 * Covers VIRTUAL ACCOUNTS (lines 1849–2307), VIRTUAL ACCOUNT CREATION ON SIGNUP (lines 10179–10325),
 * and FUNDING SOURCE ROUTES (lines 10473–10515) from the original routes.ts.
 */
import express from "express";
import { storage } from "../storage";
import { paymentService } from "../paymentService";
import { getCurrencyForCountry, getPaymentProvider } from "../paymentService";
import { getUncachableStripeClient } from "../stripeClient";
import { paystackClient } from "../paystackClient";
import { notificationService } from "../services/notification-service";
import { mapPaymentError, paymentLogger } from "../utils/paymentUtils";
import { requireAuth, requirePin } from "../middleware/auth";
import {
  param,
  resolveUserCompany,
  fundingSourceSchema,
} from "./shared";
import {
  getPreferredBank,
  getVirtualAccountMethod,
  PREFERRED_BANKS,
  type VirtualAccountMethod,
} from "../../shared/constants";

const router = express.Router();

// ==================== VIRTUAL ACCOUNTS ====================

router.get("/virtual-accounts", requireAuth, async (req, res) => {
  try {
    const companyContext = await resolveUserCompany(req);
    const accounts = await storage.getVirtualAccounts(companyContext?.companyId);
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch virtual accounts" });
  }
});

router.post("/virtual-accounts", requireAuth, async (req, res) => {
  try {
    const { name, currency, type, countryCode, email, firstName, lastName, phone, bvn, preferredBank: reqPreferredBank } = req.body;
    const userId = (req as any).user?.uid || (req as any).user?.id;

    if (!name) {
      return res.status(400).json({ error: "Account name is required" });
    }

    const effectiveCountry = countryCode || (currency === 'NGN' ? 'NG' : currency === 'GHS' ? 'GH' : 'US');
    // DVA countries must use local currency regardless of what client sends
    const DVA_CURRENCY_MAP: Record<string, string> = { 'NG': 'NGN', 'GH': 'GHS', 'KE': 'KES', 'ZA': 'ZAR' };
    const effectiveCurrency = DVA_CURRENCY_MAP[effectiveCountry.toUpperCase()] || currency || 'USD';
    const provider = paymentService.getProvider ? paymentService.getProvider(effectiveCountry) : (
      ['NG', 'GH', 'ZA', 'KE', 'EG', 'RW', 'CI'].includes(effectiveCountry.toUpperCase()) ? 'paystack' : 'stripe'
    );

    // ── KYC gate: block virtual account creation if KYC not approved ──
    if (userId) {
      const userProfile = await storage.getUserProfileByCognitoSub(userId);
      const kycStatus = (userProfile as any)?.kycStatus;
      const APPROVED_KYC_STATUSES = ['approved', 'auto_verified'];
      if (!kycStatus || !APPROVED_KYC_STATUSES.includes(kycStatus)) {
        return res.status(403).json({
          error: "KYC verification required before creating a virtual account",
          kycStatus: kycStatus || 'not_started',
          requiredStatuses: APPROVED_KYC_STATUSES,
        });
      }
    }

    // ── Duplicate prevention: one account per currency per user ──
    if (userId) {
      const companyCtx = await resolveUserCompany(req);
      const existingAccounts = await storage.getVirtualAccounts(companyCtx?.companyId);
      const duplicate = existingAccounts.find(
        (a: any) => a.userId === userId && a.currency === effectiveCurrency && a.status !== 'closed'
      );
      if (duplicate) {
        return res.status(409).json({
          error: `You already have an active ${effectiveCurrency} virtual account`,
          existingAccountId: duplicate.id,
          accountNumber: (duplicate as any).accountNumber,
        });
      }
    }

    // Resolve company context
    const companyContext = await resolveUserCompany(req);

    let accountNumber = '';
    let bankName = '';
    let bankCode = '';
    let accountName = '';
    let providerAccountId = '';
    let providerCustomerCode = '';
    let status = 'pending';

    // Determine the virtual account method for this country
    const vaMethod = getVirtualAccountMethod(effectiveCountry);

    if (vaMethod === 'unsupported') {
      return res.status(400).json({
        error: `Virtual accounts are not yet available for country '${effectiveCountry}'.`,
        supportedMethods: ['paystack_dva (NG/GH)', 'mpesa_paybill (KE)', 'bank_reference (ZA)', 'stripe_treasury (US/GB/EU/AU)'],
      });
    }

    if (vaMethod === 'paystack_dva') {
      // --- PAYSTACK DVA (Dedicated Virtual Account) — NG and GH ---
      const userProfile = userId ? await storage.getUserProfileByCognitoSub(userId) : null;
      const userEmail = email || (userProfile as any)?.email;
      const userFirstName = firstName || (userProfile as any)?.firstName || name;
      const userLastName = lastName || (userProfile as any)?.lastName || 'User';
      const userPhone = phone || (userProfile as any)?.phoneNumber || '';

      if (!userEmail) {
        return res.status(400).json({
          error: "Email is required for Paystack virtual accounts",
          requiredFields: ['email', 'firstName', 'lastName'],
        });
      }

      // Select preferred bank: use request param, or fall back to country default
      const preferred = reqPreferredBank
        ? { code: reqPreferredBank, name: reqPreferredBank }
        : getPreferredBank(effectiveCountry);

      try {
        const dvaResult = await paymentService.createVirtualAccount(
          userEmail, userFirstName, userLastName, effectiveCountry, userPhone, bvn
        );

        accountNumber = dvaResult.accountNumber || '';
        bankName = dvaResult.bankName || preferred.name;
        bankCode = dvaResult.bankCode || preferred.code;
        accountName = dvaResult.accountName || `${userFirstName} ${userLastName}`;
        providerCustomerCode = dvaResult.customerCode || '';
        status = dvaResult.status === 'active' || dvaResult.status === 'assigned' ? 'active' : 'pending';

        // If DVA pending validation, inform frontend
        if ((dvaResult as any).message) {
          console.log('DVA creation note:', (dvaResult as any).message);
        }
      } catch (dvaErr: any) {
        console.error('Paystack DVA creation failed:', dvaErr.message);
        return res.status(502).json({
          error: "Failed to create virtual account with payment provider",
          detail: dvaErr.message,
        });
      }
    } else if (vaMethod === 'mpesa_paybill') {
      // --- KENYA: M-Pesa paybill number generation ---
      // M-Pesa paybill numbers are typically assigned by Safaricom.
      // Generate a unique account reference that maps to the Paystack customer.
      const userProfile = userId ? await storage.getUserProfileByCognitoSub(userId) : null;
      const userEmail = email || (userProfile as any)?.email;
      const userFirstName = firstName || (userProfile as any)?.firstName || name;
      const userLastName = lastName || (userProfile as any)?.lastName || 'User';
      const userPhone = phone || (userProfile as any)?.phoneNumber || '';

      if (!userEmail) {
        return res.status(400).json({
          error: "Email is required for Kenyan virtual accounts",
          requiredFields: ['email', 'firstName', 'lastName', 'phone'],
        });
      }

      try {
        // Create Paystack customer first
        const customer = await paystackClient.createCustomer(
          userEmail, userFirstName, userLastName, userPhone
        );
        const customerCode = customer.data?.customer_code;
        if (!customerCode) {
          throw new Error('Failed to create Paystack customer for M-Pesa');
        }

        // Generate a unique paybill account reference
        // Format: SP-<short user id>-<timestamp suffix>
        const shortId = (userId || 'U').substring(0, 6).toUpperCase();
        const accountRef = `SP-${shortId}-${Date.now().toString(36).toUpperCase()}`;

        accountNumber = accountRef;
        bankName = 'M-Pesa (Safaricom)';
        bankCode = 'MPESA';
        accountName = `${userFirstName} ${userLastName}`;
        providerCustomerCode = customerCode;
        status = 'active';

        paymentLogger.info('mpesa_paybill_reference_created', {
          accountRef, customerCode, country: 'KE',
        });
      } catch (mpesaErr: any) {
        console.error('M-Pesa account reference creation failed:', mpesaErr.message);
        return res.status(502).json({
          error: "Failed to create M-Pesa virtual account",
          detail: mpesaErr.message,
        });
      }
    } else if (vaMethod === 'bank_reference') {
      // --- SOUTH AFRICA: Bank reference generation ---
      // ZA does not support Paystack DVA; generate a unique bank reference
      // that can be used for EFT deposits to a pooled collection account.
      const userProfile = userId ? await storage.getUserProfileByCognitoSub(userId) : null;
      const userEmail = email || (userProfile as any)?.email;
      const userFirstName = firstName || (userProfile as any)?.firstName || name;
      const userLastName = lastName || (userProfile as any)?.lastName || 'User';
      const userPhone = phone || (userProfile as any)?.phoneNumber || '';

      if (!userEmail) {
        return res.status(400).json({
          error: "Email is required for South African virtual accounts",
          requiredFields: ['email', 'firstName', 'lastName'],
        });
      }

      try {
        // Create Paystack customer
        const customer = await paystackClient.createCustomer(
          userEmail, userFirstName, userLastName, userPhone
        );
        const customerCode = customer.data?.customer_code;
        if (!customerCode) {
          throw new Error('Failed to create Paystack customer for ZA');
        }

        // Generate unique bank reference for EFT deposits
        const shortId = (userId || 'U').substring(0, 8).toUpperCase();
        const bankRef = `FIN-${shortId}-${Date.now().toString(36).toUpperCase()}`;

        accountNumber = bankRef;
        bankName = 'Financiar (EFT Reference)';
        bankCode = 'FIN-ZA';
        accountName = `${userFirstName} ${userLastName}`;
        providerCustomerCode = customerCode;
        status = 'active';

        paymentLogger.info('za_bank_reference_created', {
          bankRef, customerCode, country: 'ZA',
        });
      } catch (zaErr: any) {
        console.error('ZA bank reference creation failed:', zaErr.message);
        return res.status(502).json({
          error: "Failed to create South African virtual account",
          detail: zaErr.message,
        });
      }
    } else {
      // --- STRIPE TREASURY (US/GB/EU/AU) ---
      try {
        const treasuryResult = await paymentService.createStripeFinancialAccount({
          supportedCurrencies: [effectiveCurrency],
        });

        providerAccountId = treasuryResult.id;

        // Extract real ABA routing/account from financial_addresses
        const abaAddress = (treasuryResult.financialAddresses || []).find(
          (addr: any) => addr.type === 'aba' && addr.aba
        );
        if (abaAddress?.aba) {
          accountNumber = abaAddress.aba.account_number || '';
          bankCode = abaAddress.aba.routing_number || '';
          bankName = 'Stripe Treasury';
          accountName = name;
        } else {
          // Financial account created but ABA not yet provisioned
          accountNumber = `pending_${treasuryResult.id}`;
          bankName = 'Stripe Treasury';
          bankCode = '';
          accountName = name;
        }

        status = treasuryResult.status === 'open' ? 'active' : 'pending';
      } catch (treasuryErr: any) {
        console.error('Stripe Treasury creation failed:', treasuryErr.message);
        return res.status(502).json({
          error: "Failed to create virtual account with payment provider",
          detail: treasuryErr.message,
        });
      }
    }

    // Only persist if we got a real account number from the provider
    if (!accountNumber || accountNumber.startsWith('pending_') || accountNumber.startsWith('PENDING')) {
      return res.status(202).json({
        message: "Virtual account is being provisioned. Bank details will be available shortly.",
        status: 'provisioning',
        bankName: bankName || undefined,
        providerCustomerCode: providerCustomerCode || undefined,
        providerAccountId: providerAccountId || undefined,
      });
    }

    // Persist in DB with real provider details
    const account = await storage.createVirtualAccount({
      userId: userId || null,
      companyId: companyContext?.companyId || null,
      name,
      accountNumber,
      accountName,
      bankName,
      bankCode,
      routingNumber: null,
      swiftCode: null,
      country: countryCode || 'US',
      currency: effectiveCurrency,
      balance: '0',
      type: type || 'collection',
      status,
      provider,
      providerAccountId: providerAccountId || null,
      providerCustomerCode: providerCustomerCode || null,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json(account);
  } catch (error: any) {
    console.error('Virtual account creation error:', error);
    res.status(500).json({ error: "Failed to create virtual account" });
  }
});

router.get("/virtual-accounts/:id", requireAuth, async (req, res) => {
  try {
    const account = await storage.getVirtualAccount(param(req.params.id));
    if (!account) {
      return res.status(404).json({ error: "Virtual account not found" });
    }
    // Verify company access
    const companyContext = await resolveUserCompany(req);
    if (companyContext && (account as any).companyId && (account as any).companyId !== companyContext.companyId) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch virtual account" });
  }
});

// Fund virtual account via real payment provider
// For Paystack DVAs: Returns bank transfer instructions (user sends money to DVA number externally)
// For Stripe Treasury: Initiates an inbound transfer from a linked payment method
router.post("/virtual-accounts/:id/deposit", requireAuth, async (req, res) => {
  try {
    const { amount, originPaymentMethod } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    const account = await storage.getVirtualAccount(param(req.params.id));
    if (!account) {
      return res.status(404).json({ error: "Virtual account not found" });
    }

    // Verify user owns this account
    const userId = (req as any).user?.uid || (req as any).user?.id;
    if (account.userId && account.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const accountProvider = (account as any).provider ||
      (['NGN', 'GHS', 'ZAR', 'KES', 'EGP', 'RWF', 'XOF'].includes(account.currency) ? 'paystack' : 'stripe');

    if (accountProvider === 'paystack') {
      // Paystack DVAs receive deposits automatically via bank transfer
      // The charge.success webhook credits the wallet when funds arrive
      // Return the bank details for the user to initiate a transfer
      res.json({
        success: true,
        method: 'bank_transfer',
        instructions: {
          bankName: account.bankName,
          accountNumber: account.accountNumber,
          accountName: (account as any).accountName || account.name,
          currency: account.currency,
          message: `Transfer ${account.currency} ${amount.toLocaleString()} to the account above. Funds will be credited automatically when received.`,
        },
      });
    } else {
      // Stripe Treasury: Initiate inbound transfer from linked payment method
      const providerAcctId = (account as any).providerAccountId;
      if (!providerAcctId || providerAcctId.startsWith('pending_')) {
        return res.status(400).json({
          error: "Treasury account not yet fully provisioned. Please wait for account activation.",
        });
      }

      if (!originPaymentMethod) {
        return res.status(400).json({
          error: "originPaymentMethod is required for Stripe Treasury deposits",
          hint: "Link a bank account first via Stripe Financial Connections",
        });
      }

      try {
        const transfer = await paymentService.createInboundTransfer({
          financialAccountId: providerAcctId,
          amount,
          currency: account.currency,
          originPaymentMethod,
          description: `Deposit to ${account.name}`,
        });

        // Create pending transaction record (webhook will mark Completed)
        await storage.createTransaction({
          description: `Deposit to ${account.name} (${account.accountNumber})`,
          amount: String(amount),
          fee: "0",
          type: 'deposit',
          status: 'pending',
          date: new Date().toISOString().split('T')[0],
          currency: account.currency,
          reference: transfer.id,
          userId: (req as any).user?.uid || null,
        });

        res.json({
          success: true,
          method: 'inbound_transfer',
          transferId: transfer.id,
          status: transfer.status,
          message: `Inbound transfer of ${account.currency} ${amount.toLocaleString()} initiated. Funds typically arrive in 1-3 business days.`,
        });
      } catch (transferErr: any) {
        console.error('Stripe inbound transfer failed:', transferErr.message);
        res.status(502).json({ error: "Failed to initiate deposit", detail: transferErr.message });
      }
    }
  } catch (error: any) {
    console.error('Virtual account deposit error:', error);
    res.status(500).json({ error: "Failed to process deposit" });
  }
});

// Withdraw from virtual account — initiates real payout via provider
router.post("/virtual-accounts/:id/withdraw", requireAuth, requirePin, async (req, res) => {
  try {
    const { amount, destination, reason } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    const account = await storage.getVirtualAccount(param(req.params.id));
    if (!account) {
      return res.status(404).json({ error: "Virtual account not found" });
    }

    // Verify user owns this account
    const userId = (req as any).user?.uid || (req as any).user?.id;
    if (account.userId && account.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const accountBalance = parseFloat(String(account.balance || '0'));
    if (accountBalance < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    const accountProvider = (account as any).provider ||
      (['NGN', 'GHS', 'ZAR', 'KES', 'EGP', 'RWF', 'XOF'].includes(account.currency) ? 'paystack' : 'stripe');

    if (accountProvider === 'paystack') {
      // Paystack: Initiate transfer to destination bank account
      if (!destination?.accountNumber || !destination?.bankCode) {
        return res.status(400).json({
          error: "Destination bank details required",
          requiredFields: ['destination.accountNumber', 'destination.bankCode', 'destination.accountName'],
        });
      }

      try {
        // Create transfer recipient
        const recipient = await paystackClient.createTransferRecipient(
          destination.accountName || account.name,
          destination.accountNumber,
          destination.bankCode,
          account.currency
        );

        const recipientCode = recipient.data?.recipient_code;
        if (!recipientCode) {
          throw new Error('Failed to create transfer recipient');
        }

        // Initiate transfer
        const transfer = await paystackClient.initiateTransfer(
          amount,
          recipientCode,
          reason || `Withdrawal from ${account.name}`
        );

        // Debit the virtual account balance optimistically
        const newBalance = accountBalance - amount;
        await storage.updateVirtualAccount(param(req.params.id), { balance: String(newBalance) } as any);

        // Create pending transaction (webhook will update to Completed/Failed)
        await storage.createTransaction({
          description: `Withdrawal from ${account.name} to ${destination.accountNumber}`,
          amount: String(amount),
          fee: "0",
          type: 'payout',
          status: 'pending',
          date: new Date().toISOString().split('T')[0],
          currency: account.currency,
          reference: transfer.data?.transfer_code || transfer.data?.reference || null,
          userId: (req as any).user?.uid || null,
        });

        // Send SMS notification
        if (account.userId) {
          const profile = await storage.getUserProfileByCognitoSub(account.userId);
          const settings = await storage.getNotificationSettings(account.userId);
          if (profile?.phoneNumber && settings?.paymentNotifications) {
            notificationService.sendTransactionAlertSms({
              phone: profile.phoneNumber,
              type: 'debit',
              amount,
              currency: account.currency,
              description: `Withdrawal from ${account.name}`,
              balance: newBalance,
            }).catch(err => console.error('Transaction SMS failed:', err));
          }
        }

        res.json({
          success: true,
          transferCode: transfer.data?.transfer_code,
          status: 'Pending',
          newBalance,
          message: `${account.currency} ${amount.toLocaleString()} withdrawal initiated. Transfer is being processed.`,
        });
      } catch (transferErr: any) {
        console.error('Paystack withdrawal failed:', transferErr.message);
        res.status(502).json({ error: "Failed to initiate withdrawal", detail: transferErr.message });
      }
    } else {
      // Stripe Treasury: Create outbound payment
      const providerAcctId = (account as any).providerAccountId;
      if (!providerAcctId || providerAcctId.startsWith('pending_')) {
        return res.status(400).json({
          error: "Treasury account not yet fully provisioned",
        });
      }

      if (!destination?.accountNumber || !destination?.routingNumber) {
        return res.status(400).json({
          error: "Destination bank details required for withdrawal",
          requiredFields: ['destination.accountNumber', 'destination.routingNumber', 'destination.accountName'],
        });
      }

      try {
        const stripe = await getUncachableStripeClient();

        // Create outbound payment
        const outboundPayment = await stripe.treasury.outboundPayments.create({
          financial_account: providerAcctId,
          amount: Math.round(amount * 100),
          currency: account.currency.toLowerCase(),
          destination_payment_method_data: {
            type: 'us_bank_account',
            us_bank_account: {
              routing_number: destination.routingNumber,
              account_number: destination.accountNumber,
              account_holder_type: 'individual',
            },
            billing_details: {
              name: destination.accountName || account.name,
            },
          },
          description: reason || `Withdrawal from ${account.name}`,
        });

        // Debit balance optimistically (webhook confirms)
        const newBalance = accountBalance - amount;
        await storage.updateVirtualAccount(param(req.params.id), { balance: String(newBalance) } as any);

        // Create pending transaction
        await storage.createTransaction({
          description: `Withdrawal from ${account.name}`,
          amount: String(amount),
          fee: "0",
          type: 'payout',
          status: 'pending',
          date: new Date().toISOString().split('T')[0],
          currency: account.currency,
          reference: outboundPayment.id,
          userId: (req as any).user?.uid || null,
        });

        res.json({
          success: true,
          paymentId: outboundPayment.id,
          status: 'Pending',
          newBalance,
          message: `${account.currency} ${amount.toLocaleString()} withdrawal initiated via ACH. Typically arrives in 1-3 business days.`,
        });
      } catch (stripeErr: any) {
        console.error('Stripe Treasury withdrawal failed:', stripeErr.message);
        res.status(502).json({ error: "Failed to initiate withdrawal", detail: stripeErr.message });
      }
    }
  } catch (error: any) {
    console.error('Virtual account withdrawal error:', error);
    res.status(500).json({ error: "Failed to process withdrawal" });
  }
});

router.delete("/virtual-accounts/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await storage.deleteVirtualAccount(param(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: "Virtual account not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete virtual account" });
  }
});

// ==================== VIRTUAL ACCOUNT CREATION ON SIGNUP ====================

router.post("/virtual-accounts/create", requireAuth, requirePin, async (req, res) => {
  try {
    // SECURITY: Use authenticated user's ID
    const userId = req.user!.cognitoSub;
    const { email, firstName, lastName, countryCode, phone, bvn, bankAccountNumber, bankCode: userBankCode } = req.body;

    const safeName = `${firstName || 'User'} ${lastName || ''}`.trim();
    const safeEmail = email || '';
    const safeCountry = countryCode || 'US';
    const { currency } = getCurrencyForCountry(safeCountry);

    // Duplicate prevention: check for existing account with same currency
    const existingAccounts = await storage.getVirtualAccounts();
    const userAccount = existingAccounts.find(
      (a: any) => a.userId === userId && a.currency === currency && a.status !== 'closed'
    );
    if (userAccount) {
      return res.json(userAccount);
    }

    // KYC gate: require approved or auto_verified status
    const userProfile = userId ? await storage.getUserProfileByCognitoSub(userId) : null;
    const kycStatus = (userProfile as any)?.kycStatus;
    const APPROVED_KYC = ['approved', 'auto_verified'];
    if (!kycStatus || !APPROVED_KYC.includes(kycStatus)) {
      return res.status(403).json({
        error: "KYC verification must be completed before creating a virtual account",
        kycStatus: kycStatus || 'not_started',
        requiredStatuses: APPROVED_KYC,
      });
    }

    let accountNumber = '';
    let bankName = 'Financiar';
    let bankCode = 'FINANCIAR';
    let accountName = safeName;
    let accountStatus = 'active';
    let providerMessage = '';

    try {
      const vaMethod = getVirtualAccountMethod(safeCountry);

      if (vaMethod === 'stripe_treasury') {
        // Use Stripe Treasury for non-African countries (US/GB/EU/AU)
        try {
          const financialAccount = await paymentService.createStripeFinancialAccount({
            supportedCurrencies: [currency],
          });

          // Extract real bank account details from financial addresses
          const abaAddress = financialAccount.financialAddresses?.find((a: any) => a.type === 'aba');
          if (abaAddress?.aba) {
            accountNumber = abaAddress.aba.account_number || financialAccount.id;
            bankCode = abaAddress.aba.routing_number || 'STRIPE_TREASURY';
            bankName = abaAddress.aba.bank_name || 'Stripe Treasury';
          } else {
            accountNumber = financialAccount.id;
            bankCode = 'STRIPE_TREASURY';
            bankName = 'Stripe Treasury';
          }
          accountStatus = financialAccount.status === 'open' ? 'active' : 'pending';
          providerMessage = accountStatus === 'active'
            ? 'Virtual account created with real bank details.'
            : 'Virtual account created. Bank details will be available once account is activated.';
          paymentLogger.info('stripe_treasury_account_created', { accountId: financialAccount.id, currency });
        } catch (treasuryError: any) {
          paymentLogger.error('stripe_treasury_creation_failed', { error: treasuryError.message, currency });
          accountStatus = 'pending';
          providerMessage = 'Stripe Treasury account pending activation. Your account will be activated shortly.';
        }
      } else if (vaMethod === 'paystack_dva') {
        // Paystack DVA for NG and GH — with preferred bank selection
        const preferred = getPreferredBank(safeCountry);
        const providerResult = await paymentService.createVirtualAccount(
          safeEmail,
          firstName || 'User',
          lastName || safeName,
          safeCountry,
          phone,
          bvn,
          bankAccountNumber,
          userBankCode
        );

        if (providerResult.accountNumber) {
          accountNumber = providerResult.accountNumber;
          bankName = providerResult.bankName || preferred.name;
          bankCode = providerResult.bankCode || preferred.code;
          accountName = providerResult.accountName || accountName;
          accountStatus = 'active';
        } else if (providerResult.status === 'pending_validation') {
          accountStatus = 'pending';
          providerMessage = providerResult.message || 'Account pending validation';
        }
      } else if (vaMethod === 'mpesa_paybill') {
        // Kenya — M-Pesa paybill reference
        try {
          const customer = await paystackClient.createCustomer(
            safeEmail, firstName || 'User', lastName || safeName, phone
          );
          const customerCode = customer.data?.customer_code;
          if (!customerCode) throw new Error('Failed to create Paystack customer');

          const shortId = userId.substring(0, 6).toUpperCase();
          accountNumber = `SP-${shortId}-${Date.now().toString(36).toUpperCase()}`;
          bankName = 'M-Pesa (Safaricom)';
          bankCode = 'MPESA';
          accountName = safeName;
          accountStatus = 'active';
          paymentLogger.info('mpesa_signup_account_created', { userId, country: 'KE' });
        } catch (keErr: any) {
          accountStatus = 'pending';
          providerMessage = 'M-Pesa account creation pending. Please try again.';
        }
      } else if (vaMethod === 'bank_reference') {
        // South Africa — bank reference for EFT
        try {
          const customer = await paystackClient.createCustomer(
            safeEmail, firstName || 'User', lastName || safeName, phone
          );
          const customerCode = customer.data?.customer_code;
          if (!customerCode) throw new Error('Failed to create Paystack customer');

          const shortId = userId.substring(0, 8).toUpperCase();
          accountNumber = `FIN-${shortId}-${Date.now().toString(36).toUpperCase()}`;
          bankName = 'Financiar (EFT Reference)';
          bankCode = 'FIN-ZA';
          accountName = safeName;
          accountStatus = 'active';
          paymentLogger.info('za_signup_account_created', { userId, country: 'ZA' });
        } catch (zaErr: any) {
          accountStatus = 'pending';
          providerMessage = 'South African account creation pending. Please try again.';
        }
      } else {
        accountStatus = 'unavailable';
        providerMessage = `Virtual accounts are not yet available in your country (${safeCountry}).`;
      }
    } catch (providerError: any) {
      console.log('Payment provider virtual account creation failed:', providerError.message);
    }

    // If no real account number was obtained, return error instead of creating fake account
    if (!accountNumber) {
      return res.status(502).json({
        error: providerMessage || 'Failed to create virtual account with payment provider. Please try again or complete identity verification.',
        status: accountStatus,
      });
    }

    const virtualAccount = await storage.createVirtualAccount({
      userId,
      name: accountName,
      accountNumber,
      bankName,
      bankCode,
      routingNumber: null,
      swiftCode: null,
      country: countryCode || 'US',
      currency,
      balance: '0',
      type: 'personal',
      status: accountStatus,
      createdAt: new Date().toISOString(),
      provider: getPaymentProvider(safeCountry),
      accountName: accountName || null,
      providerAccountId: null,
      providerCustomerCode: null,
      companyId: null,
    });

    const existingWallet = await storage.getWalletByUserId(userId);
    if (!existingWallet) {
      await storage.createWallet({
        userId,
        currency,
        type: 'personal',
        balance: '0',
        availableBalance: '0',
        pendingBalance: '0',
        status: 'active',
        virtualAccountId: virtualAccount.id,
      });
    }

    const response: any = { ...virtualAccount };
    if (providerMessage) {
      response.message = providerMessage;
    }

    res.status(201).json(response);
  } catch (error: any) {
    console.error('Virtual account creation error:', error);
    const mapped = mapPaymentError(error, 'virtual_account');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// ==================== FUNDING SOURCE ROUTES ====================

router.get("/funding-sources", requireAuth, async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    const sources = await storage.getFundingSources(userId as string);
    res.json(sources);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'funding');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

router.post("/funding-sources", requireAuth, async (req, res) => {
  try {
    const result = fundingSourceSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid funding source data", details: result.error.issues });
    }
    const source = await storage.createFundingSource(result.data as any);
    res.status(201).json(source);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'funding');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

router.delete("/funding-sources/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await storage.deleteFundingSource(param(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: "Funding source not found" });
    }
    res.json({ success: true });
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'funding');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

export default router;
