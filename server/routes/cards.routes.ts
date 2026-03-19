/**
 * Card routes — virtual card issuance, management, funding, payments, and Stripe card controls.
 * Covers the CARDS section (lines 1451–1848) and STRIPE CARD MANAGEMENT section (lines 4147–4341)
 * from the original routes.ts.
 */
import express from "express";
import { storage } from "../storage";
import { paymentService } from "../paymentService";
import { mapPaymentError, paymentLogger } from "../utils/paymentUtils";
import { requireAuth, requirePin } from "../middleware/auth";
import { financialLimiter, sensitiveLimiter } from "../middleware/rateLimiter";
import {
  param,
  validateAmount,
  resolveUserCompany,
  verifyCompanyAccess,
  cardSchema,
  cardUpdateSchema,
} from "./shared";

const router = express.Router();

// ==================== CARDS ====================

router.get("/cards", requireAuth, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const cards = await storage.getCards(company?.companyId);
    res.json(cards);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch cards" });
  }
});

router.get("/cards/:id", requireAuth, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const card = await storage.getCard(param(req.params.id));
    if (!card) {
      return res.status(404).json({ error: "Card not found" });
    }
    if (company && !await verifyCompanyAccess(card.companyId, company.companyId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(card);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch card" });
  }
});

router.post("/cards", requireAuth, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const result = cardSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid card data", details: result.error.issues });
    }
    const { name, limit, type, color, currency: cardCurrency } = result.data;

    const selectedCurrency = cardCurrency || 'USD';

    // Virtual card issuance is only available via Stripe (USD, EUR, GBP, AUD, etc.)
    // Paystack does not have a card issuance API — reject local currency cards
    const LOCAL_CURRENCIES = ['NGN', 'GHS', 'KES', 'ZAR', 'EGP', 'RWF', 'XOF'];
    if (LOCAL_CURRENCIES.includes(selectedCurrency)) {
      return res.status(400).json({
        error: 'Virtual card issuance is not yet available for this currency.',
        detail: `Card issuance for ${selectedCurrency} is coming soon. Virtual cards are currently available for USD, EUR, GBP, and AUD.`,
        comingSoon: true,
      });
    }

    const provider = 'stripe';
    const cardType = type || 'Visa';

    let last4: string | undefined;
    let stripeCardId: string | undefined;
    let stripeCardholderId: string | undefined;

    // Create real Stripe Issuing card
    {
      try {
        const user = req.user as any;
        const userId = user?.uid || user?.id;

        // Get full user profile for billing address (Cognito token doesn't have address)
        const userProfile = userId ? await storage.getUserProfileByCognitoSub(userId) : null;
        const kycData = userId ? await storage.getKycSubmission(userId) : null;

        if (!userProfile?.email) {
          return res.status(400).json({ error: "Complete your profile before creating a card" });
        }

        // Billing address from KYC or profile - NEVER use fake defaults
        const billingAddress = {
          line1: (kycData as any)?.address || (userProfile as any)?.address || '',
          city: (kycData as any)?.city || (userProfile as any)?.city || '',
          state: (kycData as any)?.state || (userProfile as any)?.state || '',
          postalCode: (kycData as any)?.postalCode || (userProfile as any)?.postalCode || '',
          country: (kycData as any)?.country || (userProfile as any)?.country || 'US',
        };

        if (!billingAddress.line1 || !billingAddress.city || !billingAddress.postalCode) {
          return res.status(400).json({
            error: "Billing address required for card issuance. Please complete your address in settings.",
            requiredFields: ['address', 'city', 'state', 'postalCode', 'country']
          });
        }

        // Create cardholder with real profile data
        const cardholder = await paymentService.createCardholder({
          name: userProfile.displayName || user.email || 'Cardholder',
          email: userProfile.email || user.email,
          phoneNumber: (userProfile as any)?.phoneNumber || user.phoneNumber,
          billingAddress,
          type: 'individual',
        });
        stripeCardholderId = cardholder.id;

        // Issue virtual card
        const stripeCard = await paymentService.issueVirtualCard({
          cardholderId: cardholder.id,
          currency: selectedCurrency,
          spendingLimit: limit || undefined,
          spendingLimitInterval: 'monthly',
        });

        stripeCardId = stripeCard.id;
        last4 = stripeCard.last4 || last4;
        paymentLogger.info('stripe_card_created', { cardId: stripeCardId, cardholderId: stripeCardholderId });
      } catch (stripeError: any) {
        const mapped = mapPaymentError(stripeError, 'stripe');
        paymentLogger.error('stripe_card_creation_failed', { error: stripeError.message, userId: (req.user as any).id });
        return res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
      }
    }

    const card = await storage.createCard({
      name,
      last4,
      balance: 0,
      limit: limit || 0,
      type: cardType as any,
      color: color || 'indigo',
      currency: selectedCurrency,
      status: 'active',
      stripeCardId,
      stripeCardholderId,
      companyId: company?.companyId,
    } as any);

    res.status(201).json({
      ...card,
      provider,
      message: `Virtual ${cardType} card created. Fund it from your wallet to start using.`,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create card" });
  }
});

router.patch("/cards/:id", requireAuth, async (req, res) => {
  try {
    const result = cardUpdateSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid card data", details: result.error.issues });
    }
    const existingCard = await storage.getCard(param(req.params.id));
    if (!existingCard) {
      return res.status(404).json({ error: "Card not found" });
    }
    const company = await resolveUserCompany(req);
    if (company && existingCard.companyId && existingCard.companyId !== company.companyId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const card = await storage.updateCard(param(req.params.id), result.data as any);
    if (!card) {
      return res.status(404).json({ error: "Card not found" });
    }
    res.json(card);
  } catch (error) {
    res.status(500).json({ error: "Failed to update card" });
  }
});

router.delete("/cards/:id", requireAuth, async (req, res) => {
  try {
    const card = await storage.getCard(param(req.params.id));
    if (!card) {
      return res.status(404).json({ error: "Card not found" });
    }
    const company = await resolveUserCompany(req);
    if (company && card.companyId && card.companyId !== company.companyId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const deleted = await storage.deleteCard(param(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: "Card not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete card" });
  }
});

// Fund a virtual card from wallet
router.post("/cards/:id/fund", financialLimiter, requireAuth, requirePin, async (req, res) => {
  try {
    const { amount, sourceCurrency } = req.body;
    const userId = (req as any).user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: amountCheck.error });
    }

    const card = await storage.getCard(param(req.params.id));
    if (!card) {
      return res.status(404).json({ error: "Card not found" });
    }
    const company = await resolveUserCompany(req);
    if (company && card.companyId && card.companyId !== company.companyId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const cardCurrency = card.currency || 'USD';
    const fundingCurrency = sourceCurrency || cardCurrency;

    // Get user's wallet for the source currency
    const sourceWallet = await storage.getWalletByUserId(userId, fundingCurrency);
    if (!sourceWallet) {
      return res.status(400).json({
        error: `No ${fundingCurrency} wallet found. Please fund your wallet first.`
      });
    }

    const walletBalance = parseFloat(String(sourceWallet.balance || 0));

    // Calculate exchange rate if currencies differ
    let amountToDeduct = amount;
    let amountToCredit = amount;
    let exchangeRate = 1;

    if (fundingCurrency !== cardCurrency) {
      // Get exchange rate
      const rate = await storage.getExchangeRate(fundingCurrency, cardCurrency);
      if (!rate) {
        return res.status(400).json({
          error: `No exchange rate available for ${fundingCurrency} to ${cardCurrency}. Contact admin.`
        });
      }
      exchangeRate = parseFloat(String(rate.rate));
      // User provides amount in card currency, we calculate source currency needed
      amountToDeduct = amount / exchangeRate;
      amountToCredit = amount;
    }

    // Check wallet balance
    if (walletBalance < amountToDeduct) {
      return res.status(400).json({
        error: "Insufficient wallet balance",
        required: amountToDeduct,
        available: walletBalance,
        currency: fundingCurrency
      });
    }

    // Debit from wallet
    await storage.debitWallet(
      sourceWallet.id,
      amountToDeduct,
      'card_funding',
      `Fund card ${card.name} (****${card.last4})`,
      `CFUND-${Date.now()}`,
      { cardId: card.id, exchangeRate, cardCurrency }
    );

    // Update card balance
    const currentBalance = parseFloat(String(card.balance || 0));
    const newBalance = currentBalance + amountToCredit;
    const updated = await storage.updateCard(param(req.params.id), { balance: newBalance });

    // Create funding transaction
    await storage.createTransaction({
      description: `Card funding - ${card.name} (****${card.last4})`,
      amount: String(amountToCredit),
      fee: "0",
      type: 'funding',
      status: 'completed',
      date: new Date().toISOString().split('T')[0],
      currency: cardCurrency,
      reference: null,
      userId: (req as any).user?.uid || null,
      companyId: company?.companyId ?? null,
    });

    const currencySymbols: Record<string, string> = {
      USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'CA$',
      NGN: '₦', GHS: 'GH₵', KES: 'KSh', ZAR: 'R', EGP: 'E£', RWF: 'RF', XOF: 'CFA',
      CHF: 'CHF', SEK: 'kr', NOK: 'kr', DKK: 'kr',
    };
    const cardSymbol = currencySymbols[cardCurrency] || cardCurrency;

    res.json({
      success: true,
      card: updated,
      amountCredited: amountToCredit,
      amountDebited: amountToDeduct,
      exchangeRate: exchangeRate !== 1 ? exchangeRate : undefined,
      message: `${cardSymbol}${amountToCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })} funded to card`
    });
  } catch (error: any) {
    console.error('Card funding error:', error);
    const mapped = mapPaymentError(error, 'card');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// Make a payment with virtual card
router.post("/cards/:id/pay", requireAuth, requirePin, async (req, res) => {
  try {
    const { amount, merchant, category, description } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }
    if (!merchant) {
      return res.status(400).json({ error: "Merchant is required" });
    }

    const card = await storage.getCard(param(req.params.id));
    if (!card) {
      return res.status(404).json({ error: "Card not found" });
    }
    const company = await resolveUserCompany(req);
    if (company && card.companyId && card.companyId !== company.companyId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (card.status !== 'active') {
      return res.status(400).json({ error: "Card is not active" });
    }

    const cardBalance = parseFloat(card.balance);
    if (cardBalance < amount) {
      return res.status(400).json({ error: "Insufficient card balance" });
    }

    // Deduct from card balance
    const newBalance = cardBalance - amount;
    await storage.updateCard(param(req.params.id), { balance: String(newBalance) });

    // Create card transaction record
    const cardTx = await storage.createCardTransaction({
      cardId: param(req.params.id),
      companyId: card.companyId || null,
      amount: String(amount),
      currency: card.currency || 'USD',
      merchant,
      category: category || 'General',
      description: description || '',
      status: 'completed',
      date: new Date().toISOString(),
    });

    // Create expense record
    await storage.createExpense({
      merchant,
      amount: String(amount),
      currency: card.currency || 'USD',
      date: new Date().toISOString().split('T')[0],
      category: category || 'General',
      status: 'PAID',
      user: 'Card Payment',
      userId: '1',
      companyId: null,
      department: 'General',
      note: `Paid with virtual card ****${card.last4}`,
      receiptUrl: null,
      expenseType: 'spent',
      attachments: [],
      taggedReviewers: [],
      vendorId: null,
      payoutStatus: 'not_started',
      payoutId: null,
      reviewerComments: null,
    });

    res.json({
      success: true,
      transaction: cardTx,
      remainingBalance: newBalance,
      message: `$${amount.toLocaleString()} paid to ${merchant}`
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to process payment" });
  }
});

// Get card transactions
router.get("/cards/:id/transactions", requireAuth, async (req, res) => {
  try {
    const card = await storage.getCard(param(req.params.id));
    if (!card) {
      return res.status(404).json({ error: "Card not found" });
    }
    const company = await resolveUserCompany(req);
    if (company && card.companyId && card.companyId !== company.companyId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const transactions = await storage.getCardTransactions(param(req.params.id), company?.companyId);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch card transactions" });
  }
});

// ==================== STRIPE CARD MANAGEMENT ====================

// Freeze card
router.post("/cards/:id/freeze", requireAuth, async (req, res) => {
  try {
    const card = await storage.getCard(param(req.params.id));
    if (!card) {
      return res.status(404).json({ error: "Card not found" });
    }
    const company = await resolveUserCompany(req);
    if (company && card.companyId && card.companyId !== company.companyId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!card.stripeCardId) {
      return res.status(400).json({ error: "Card does not support freezing" });
    }

    try {
      await paymentService.updateCardStatus(card.stripeCardId, 'inactive');
      const updatedCard = await storage.updateCard(param(req.params.id), { status: 'frozen' });
      res.json(updatedCard);
    } catch (stripeError: any) {
      const mapped = mapPaymentError(stripeError, 'stripe');
      return res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to freeze card" });
  }
});

// Unfreeze card
router.post("/cards/:id/unfreeze", requireAuth, async (req, res) => {
  try {
    const card = await storage.getCard(param(req.params.id));
    if (!card) {
      return res.status(404).json({ error: "Card not found" });
    }
    const company = await resolveUserCompany(req);
    if (company && card.companyId && card.companyId !== company.companyId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!card.stripeCardId) {
      return res.status(400).json({ error: "Card does not support unfreezing" });
    }

    try {
      await paymentService.updateCardStatus(card.stripeCardId, 'active');
      const updatedCard = await storage.updateCard(param(req.params.id), { status: 'active' });
      res.json(updatedCard);
    } catch (stripeError: any) {
      const mapped = mapPaymentError(stripeError, 'stripe');
      return res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to unfreeze card" });
  }
});

// Get sensitive card details (card number, CVV) - Rate limited + PIN required
router.get("/cards/:id/details", sensitiveLimiter, requireAuth, requirePin, async (req, res) => {
  try {
    const card = await storage.getCard(param(req.params.id));
    if (!card) {
      return res.status(404).json({ error: "Card not found" });
    }
    const company = await resolveUserCompany(req);
    if (company && card.companyId && card.companyId !== company.companyId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!card.stripeCardId) {
      return res.status(400).json({ error: "Card details not available" });
    }

    try {
      const details = await paymentService.getCardDetails(card.stripeCardId);
      // Mask card number — show only last 4 digits for security
      const maskedNumber = details.number
        ? `${'*'.repeat(details.number.length - 4)}${details.number.slice(-4)}`
        : undefined;
      res.json({
        ...details,
        number: maskedNumber,
        // CVC is intentionally returned (PIN-protected) for card usage
      });
    } catch (stripeError: any) {
      const mapped = mapPaymentError(stripeError, 'stripe');
      return res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch card details" });
  }
});

// Update spending controls - PIN required (changes financial limits)
router.patch("/cards/:id/controls", requireAuth, requirePin, async (req, res) => {
  try {
    const { spendingLimit, spendingLimitInterval, allowedCategories, blockedCategories } = req.body;
    const card = await storage.getCard(param(req.params.id));
    if (!card) {
      return res.status(404).json({ error: "Card not found" });
    }
    const company = await resolveUserCompany(req);
    if (company && card.companyId && card.companyId !== company.companyId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!card.stripeCardId) {
      return res.status(400).json({ error: "Card does not support spending controls" });
    }

    try {
      await paymentService.updateCardSpendingControls(card.stripeCardId, {
        spendingLimit,
        spendingLimitInterval,
        allowedCategories,
        blockedCategories,
      });

      // Update local card limit if specified
      if (spendingLimit !== undefined) {
        await storage.updateCard(param(req.params.id), { limit: spendingLimit });
      }

      const updatedCard = await storage.getCard(param(req.params.id));
      res.json(updatedCard);
    } catch (stripeError: any) {
      const mapped = mapPaymentError(stripeError, 'stripe');
      return res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to update spending controls" });
  }
});

// Cancel card permanently
router.post("/cards/:id/cancel", requireAuth, async (req, res) => {
  try {
    const card = await storage.getCard(param(req.params.id));
    if (!card) {
      return res.status(404).json({ error: "Card not found" });
    }
    const company = await resolveUserCompany(req);
    if (company && card.companyId && card.companyId !== company.companyId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!card.stripeCardId) {
      return res.status(400).json({ error: "Card does not support cancellation" });
    }

    try {
      await paymentService.updateCardStatus(card.stripeCardId, 'canceled');
      const updatedCard = await storage.updateCard(param(req.params.id), { status: 'cancelled' });
      res.json(updatedCard);
    } catch (stripeError: any) {
      const mapped = mapPaymentError(stripeError, 'stripe');
      return res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to cancel card" });
  }
});

// Get card transactions from Stripe
// Note: This route handles Stripe-sourced transactions; the earlier /cards/:id/transactions
// route handles locally-stored card transactions. Both are preserved here as they appear
// in the original routes.ts with the same path but different implementation intent.
router.get("/cards/:id/stripe-transactions", requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 25;
    const card = await storage.getCard(param(req.params.id));
    if (!card) {
      return res.status(404).json({ error: "Card not found" });
    }
    const company = await resolveUserCompany(req);
    if (company && card.companyId && card.companyId !== company.companyId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!card.stripeCardId) {
      return res.json([]);
    }

    try {
      const transactions = await paymentService.listCardTransactions(card.stripeCardId, limit);
      res.json(transactions);
    } catch (stripeError: any) {
      const mapped = mapPaymentError(stripeError, 'stripe');
      return res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch card transactions" });
  }
});

export default router;
