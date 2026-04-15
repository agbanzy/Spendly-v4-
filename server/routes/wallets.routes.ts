import express from "express";
import { storage } from "../storage";
import { param, validateAmount } from "./shared";
import { requireAuth, requireAdmin, requirePin } from "../middleware/auth";
import { financialLimiter } from "../middleware/rateLimiter";
import { mapPaymentError } from "../utils/paymentUtils";
import { paymentService } from "../paymentService";

const router = express.Router();

// ==================== WALLET ROUTES ====================

// Get all wallets (admin) or user's wallets
router.get("/wallets", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.cognitoSub;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const walletsList = await storage.getWallets(userId);
    res.json(walletsList);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'wallet');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// Get wallet by ID
router.get("/wallets/:id", requireAuth, async (req, res) => {
  try {
    const wallet = await storage.getWallet(param(req.params.id));
    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }
    // SECURITY: Verify wallet belongs to authenticated user
    const authUserId = (req as any).user?.cognitoSub;
    if (wallet.userId !== authUserId) {
      return res.status(403).json({ error: "Not authorized to access this wallet" });
    }
    res.json(wallet);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'wallet');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// Create wallet
router.post("/wallets", requireAuth, async (req, res) => {
  try {
    // SECURITY: Always use authenticated user's ID, never client-provided
    const userId = (req as any).user?.cognitoSub;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { currency, type } = req.body;

    // Check if wallet already exists for this user/currency
    const existing = await storage.getWalletByUserId(userId, currency);
    if (existing) {
      return res.status(400).json({ error: "Wallet already exists for this currency" });
    }

    const wallet = await storage.createWallet({
      userId,
      currency: currency || 'USD',
      type: type || 'personal',
      balance: '0',
      availableBalance: '0',
      pendingBalance: '0',
      status: 'active',
    });
    res.status(201).json(wallet);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'wallet');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// Get wallet transactions
router.get("/wallets/:id/transactions", requireAuth, async (req, res) => {
  try {
    // SECURITY: Verify wallet ownership before returning transactions
    const wallet = await storage.getWallet(param(req.params.id));
    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }
    const authUserId = (req as any).user?.cognitoSub;
    if (wallet.userId !== authUserId) {
      return res.status(403).json({ error: "Not authorized to view these transactions" });
    }

    const transactions = await storage.getWalletTransactions(param(req.params.id));
    res.json(transactions);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'wallet');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// Fund wallet (credit)
router.post("/wallets/:id/fund", financialLimiter, requireAuth, requirePin, async (req, res) => {
  try {
    const { amount, reference, description, metadata, provider } = req.body;

    // Input validation
    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: amountCheck.error });
    }
    const parsedAmount = amountCheck.parsed;

    // SECURITY: Verify wallet ownership
    const wallet = await storage.getWallet(param(req.params.id));
    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }
    const authUserId = (req as any).user?.cognitoSub;
    if (wallet.userId !== authUserId) {
      return res.status(403).json({ error: "Not authorized to fund this wallet" });
    }

    // SECURITY: Verify payment with the provider before crediting to prevent self-crediting
    if (!reference) {
      return res.status(400).json({ error: "Payment reference is required for wallet funding" });
    }
    const fundingProvider = provider || 'stripe';
    try {
      const verification = await paymentService.verifyPayment(reference, fundingProvider);
      if (verification.status !== 'succeeded' && verification.status !== 'success') {
        return res.status(400).json({ error: 'Payment not confirmed. Wallet will be credited via webhook.' });
      }
    } catch (verifyErr: any) {
      console.error(`[Wallet Fund] Payment verification failed for ref ${reference}:`, verifyErr.message);
      return res.status(400).json({ error: 'Payment verification failed. Wallet will be credited via webhook if payment succeeds.' });
    }

    const transaction = await storage.creditWallet(
      param(req.params.id),
      parsedAmount,
      'funding',
      description || 'Wallet funding',
      reference,
      metadata
    );
    res.json(transaction);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'wallet');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// Withdraw from wallet (debit)
router.post("/wallets/:id/withdraw", financialLimiter, requireAuth, requirePin, async (req, res) => {
  try {
    const { amount, reference, description, metadata } = req.body;

    // Input validation
    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: amountCheck.error });
    }
    const parsedAmount = amountCheck.parsed;

    // SECURITY: Verify wallet ownership
    const wallet = await storage.getWallet(param(req.params.id));
    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }
    const authUserId = (req as any).user?.cognitoSub;
    if (wallet.userId !== authUserId) {
      return res.status(403).json({ error: "Not authorized to withdraw from this wallet" });
    }

    const transaction = await storage.debitWallet(
      param(req.params.id),
      parsedAmount,
      'withdrawal',
      description || 'Wallet withdrawal',
      reference || `WD-${Date.now()}`,
      metadata
    );
    res.json(transaction);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'wallet');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// ==================== EXCHANGE RATES ROUTES ====================

router.get("/exchange-rates", requireAuth, async (req, res) => {
  try {
    const rates = await storage.getExchangeRates();
    res.json(rates);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'exchange');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

router.post("/exchange-rates", requireAdmin, async (req, res) => {
  try {
    const { baseCurrency, targetCurrency, rate, source } = req.body;
    const exchangeRate = await storage.createExchangeRate({
      baseCurrency,
      targetCurrency,
      rate: rate.toString(),
      source: source || 'manual',
      validFrom: new Date().toISOString(),
    });
    res.status(201).json(exchangeRate);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'exchange');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

router.get("/exchange-rates/:base/:target", requireAuth, async (req, res) => {
  try {
    const base = param(req.params.base);
    const target = param(req.params.target);
    const rate = await storage.getExchangeRate(base, target);
    if (!rate) {
      return res.status(404).json({ error: "Exchange rate not found" });
    }
    res.json(rate);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'exchange');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// Seed default exchange rates (admin only)
router.post("/exchange-rates/seed", requireAdmin, async (req, res) => {
  try {
    const defaultRates = [
      { baseCurrency: 'USD', targetCurrency: 'NGN', rate: '1550.00' },
      { baseCurrency: 'USD', targetCurrency: 'EUR', rate: '0.92' },
      { baseCurrency: 'USD', targetCurrency: 'GBP', rate: '0.79' },
      { baseCurrency: 'USD', targetCurrency: 'GHS', rate: '15.50' },
      { baseCurrency: 'USD', targetCurrency: 'KES', rate: '152.50' },
      { baseCurrency: 'USD', targetCurrency: 'ZAR', rate: '18.50' },
      { baseCurrency: 'NGN', targetCurrency: 'USD', rate: '0.000645' },
      { baseCurrency: 'EUR', targetCurrency: 'USD', rate: '1.087' },
      { baseCurrency: 'GBP', targetCurrency: 'USD', rate: '1.266' },
      { baseCurrency: 'EUR', targetCurrency: 'NGN', rate: '1685.00' },
      { baseCurrency: 'GBP', targetCurrency: 'NGN', rate: '1961.00' },
    ];

    const createdRates: any[] = [];
    for (const rateData of defaultRates) {
      // Check if rate already exists
      const existing = await storage.getExchangeRate(rateData.baseCurrency, rateData.targetCurrency);
      if (!existing) {
        const rate = await storage.createExchangeRate({
          ...rateData,
          source: 'system',
          validFrom: new Date().toISOString(),
        });
        createdRates.push(rate);
      }
    }

    res.json({
      message: `Seeded ${createdRates.length} exchange rates`,
      rates: createdRates
    });
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'exchange');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// Get exchange rate settings (markup percentages)
router.get("/exchange-rates/settings", requireAuth, async (req, res) => {
  try {
    let settings = await storage.getExchangeRateSettings();
    if (!settings) {
      // Create default settings with 10% markup
      settings = await storage.updateExchangeRateSettings('10.00', '10.00');
    }
    res.json(settings);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'exchange');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// Update exchange rate settings (admin only)
router.put("/exchange-rates/settings", requireAdmin, async (req, res) => {
  try {
    const { buyMarkupPercent, sellMarkupPercent } = req.body;

    if (buyMarkupPercent === undefined || sellMarkupPercent === undefined) {
      return res.status(400).json({ error: "buyMarkupPercent and sellMarkupPercent are required" });
    }

    const buyMarkup = parseFloat(buyMarkupPercent);
    const sellMarkup = parseFloat(sellMarkupPercent);

    if (isNaN(buyMarkup) || isNaN(sellMarkup) || buyMarkup < 0 || sellMarkup < 0 || buyMarkup > 50 || sellMarkup > 50) {
      return res.status(400).json({ error: "Markup percentages must be between 0 and 50" });
    }

    const adminId = (req as any).adminId || 'admin';
    const settings = await storage.updateExchangeRateSettings(
      buyMarkup.toFixed(2),
      sellMarkup.toFixed(2),
      adminId
    );

    res.json(settings);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'exchange');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// Fetch live exchange rates from external API and store with markup
router.post("/exchange-rates/fetch-live", requireAdmin, async (req, res) => {
  try {
    const baseCurrencies = ['USD', 'EUR', 'GBP'];
    const targetCurrencies = ['USD', 'EUR', 'GBP', 'NGN', 'GHS', 'KES', 'ZAR'];

    // Fetch live rates from exchangerate-api (free tier)
    const fetchedRates: any[] = [];

    for (const base of baseCurrencies) {
      try {
        const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${base}`);
        if (response.ok) {
          const data = await response.json();

          for (const target of targetCurrencies) {
            if (base !== target && data.rates[target]) {
              const rate = data.rates[target];

              // Check if rate already exists, update or create
              const existing = await storage.getExchangeRate(base, target);
              if (existing) {
                await storage.updateExchangeRate(existing.id, {
                  rate: rate.toFixed(6),
                  source: 'live_api',
                  validFrom: new Date().toISOString(),
                });
              } else {
                await storage.createExchangeRate({
                  baseCurrency: base,
                  targetCurrency: target,
                  rate: rate.toFixed(6),
                  source: 'live_api',
                  validFrom: new Date().toISOString(),
                });
              }

              fetchedRates.push({ base, target, rate: rate.toFixed(6) });
            }
          }
        }
      } catch (fetchError) {
        console.error(`Failed to fetch rates for ${base}:`, fetchError);
      }
    }

    res.json({
      message: `Fetched ${fetchedRates.length} live exchange rates`,
      rates: fetchedRates
    });
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'exchange');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// Get exchange rate with markup applied (for customer-facing transactions)
router.get("/exchange-rates/:base/:target/with-markup", requireAuth, async (req, res) => {
  try {
    const base = param(req.params.base);
    const target = param(req.params.target);
    const { type = 'buy' } = req.query; // 'buy' or 'sell'

    const rate = await storage.getExchangeRate(base, target);
    if (!rate) {
      return res.status(404).json({ error: "Exchange rate not found" });
    }

    // Get markup settings
    let settings = await storage.getExchangeRateSettings();
    if (!settings) {
      settings = await storage.updateExchangeRateSettings('10.00', '10.00');
    }

    const baseRate = parseFloat(String(rate.rate));
    const markupPercent = type === 'sell'
      ? parseFloat(String(settings.sellMarkupPercent))
      : parseFloat(String(settings.buyMarkupPercent));

    // Apply markup: for buying foreign currency, increase rate; for selling, decrease rate
    // Customer buys foreign currency at higher rate (pays more)
    // Customer sells foreign currency at lower rate (receives less)
    let adjustedRate: number;
    if (type === 'buy') {
      // Customer buying target currency - they pay more
      adjustedRate = baseRate * (1 + markupPercent / 100);
    } else {
      // Customer selling target currency - they receive less
      adjustedRate = baseRate * (1 - markupPercent / 100);
    }

    res.json({
      baseCurrency: base,
      targetCurrency: target,
      marketRate: baseRate,
      markupPercent,
      type,
      customerRate: parseFloat(adjustedRate.toFixed(6)),
      source: rate.source,
      validFrom: rate.validFrom,
    });
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'exchange');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

export default router;
