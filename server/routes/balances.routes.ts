import express from "express";
import { storage } from "../storage";
import { requireAuth, requireAdmin, requirePin } from "../middleware/auth";
import { financialLimiter } from "../middleware/rateLimiter";
import { paymentService } from "../paymentService";
import {
  validateAmount,
  resolveUserCompany,
  getSettingsForRequest,
  getAuditUserName,
} from "./shared";

const router = express.Router();

// ==================== BALANCES ====================
router.get("/balances", requireAuth, async (req, res) => {
  try {
    const balances = await storage.getBalances();
    res.json(balances);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch balances" });
  }
});

router.patch("/balances", requireAuth, requireAdmin, async (req, res) => {
  try {
    const balances = await storage.updateBalances(req.body);
    res.json(balances);
  } catch (error) {
    res.status(500).json({ error: "Failed to update balances" });
  }
});

router.post("/balances/fund", financialLimiter, requireAuth, requirePin, async (req, res) => {
  try {
    const { amount, reference, provider } = req.body;
    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: amountCheck.error });
    }
    const parsedAmount = amountCheck.parsed;

    // SECURITY: Require a payment reference and verify with provider before crediting
    if (!reference) {
      return res.status(400).json({ error: "Payment reference is required for balance funding" });
    }
    const fundingProvider = provider || 'stripe';
    try {
      const verification = await paymentService.verifyPayment(reference, fundingProvider);
      if (verification.status !== 'succeeded' && verification.status !== 'success') {
        return res.status(400).json({ error: "Payment not confirmed. Balance will be credited via webhook." });
      }
    } catch (verifyErr: any) {
      console.error(`[Balance Fund] Payment verification failed for ref ${reference}:`, verifyErr.message);
      return res.status(400).json({ error: "Payment verification failed. Balance will be credited via webhook if payment succeeds." });
    }

    const fundCompany = await resolveUserCompany(req);
    const currentBalances = await storage.getBalances();
    const currentLocal = parseFloat(String(currentBalances?.local || 0));
    const newLocal = currentLocal + parsedAmount;

    const settings = await getSettingsForRequest(req);
    const currency = settings.currency || 'USD';

    await storage.createTransaction({
      type: "funding",
      amount: String(parsedAmount),
      fee: "0",
      status: 'completed',
      date: new Date().toISOString().split('T')[0],
      description: "Wallet Funding",
      currency,
      reference: reference,
      userId: (req as any).user?.uid || null,
      companyId: fundCompany?.companyId ?? null,
    });

    const updatedBalances = await storage.updateBalances({ local: String(newLocal) });

    try {
      const auditName = await getAuditUserName(req);
      await storage.createAuditLog({
        action: 'wallet_funding',
        userId: (req as any).user?.uid || 'system',
        userName: auditName,
        entityType: 'wallet',
        entityId: 'company-balance',
        details: { amount: parsedAmount, currency, newBalance: newLocal },
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
        createdAt: new Date().toISOString(),
      } as any);
    } catch (e) { /* audit log failure should not block operation */ }

    res.json(updatedBalances);
  } catch (error) {
    res.status(500).json({ error: "Failed to fund wallet" });
  }
});

router.post("/balances/withdraw", financialLimiter, requireAuth, requirePin, async (req, res) => {
  try {
    const { amount } = req.body;
    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: amountCheck.error });
    }
    const parsedAmount = amountCheck.parsed;

    const withdrawCompany = await resolveUserCompany(req);
    const currentBalances = await storage.getBalances();
    const currentLocal = parseFloat(String(currentBalances?.local || 0));

    if (parsedAmount > currentLocal) {
      return res.status(400).json({ error: "Insufficient funds" });
    }

    const newLocal = currentLocal - parsedAmount;

    const settings = await getSettingsForRequest(req);
    const currency = settings.currency || 'USD';

    await storage.createTransaction({
      type: "payout",
      amount: String(parsedAmount),
      fee: "0",
      status: 'completed',
      date: new Date().toISOString().split('T')[0],
      description: "Wallet Withdrawal",
      currency,
      reference: null,
      userId: (req as any).user?.uid || null,
      companyId: withdrawCompany?.companyId ?? null,
    });

    const updatedBalances = await storage.updateBalances({ local: String(newLocal) });

    try {
      const auditName = await getAuditUserName(req);
      await storage.createAuditLog({
        action: 'wallet_withdrawal',
        userId: (req as any).user?.uid || 'system',
        userName: auditName,
        entityType: 'wallet',
        entityId: 'company-balance',
        details: { amount: parsedAmount, currency, newBalance: newLocal },
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
        createdAt: new Date().toISOString(),
      } as any);
    } catch (e) { /* audit log failure should not block operation */ }

    res.json(updatedBalances);
  } catch (error) {
    res.status(500).json({ error: "Failed to withdraw" });
  }
});

router.post("/balances/send", financialLimiter, requireAuth, requirePin, async (req, res) => {
  try {
    const { amount, recipient, note } = req.body;
    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: amountCheck.error });
    }
    const parsedAmount = amountCheck.parsed;

    if (!recipient) {
      return res.status(400).json({ error: "Recipient required" });
    }

    const sendCompany = await resolveUserCompany(req);
    const currentBalances = await storage.getBalances();
    const currentLocal = parseFloat(String(currentBalances?.local || 0));

    if (parsedAmount > currentLocal) {
      return res.status(400).json({ error: "Insufficient funds" });
    }

    const newLocal = currentLocal - parsedAmount;

    const settings = await getSettingsForRequest(req);
    const currency = settings.currency || 'USD';

    await storage.createTransaction({
      type: "payout",
      amount: String(parsedAmount),
      fee: "0",
      status: 'completed',
      date: new Date().toISOString().split('T')[0],
      description: `Payment to ${recipient}${note ? ` - ${note}` : ''}`,
      currency,
      reference: null,
      userId: (req as any).user?.uid || null,
      companyId: sendCompany?.companyId ?? null,
    });

    const updatedBalances = await storage.updateBalances({ local: String(newLocal) });
    res.json(updatedBalances);
  } catch (error) {
    res.status(500).json({ error: "Failed to send money" });
  }
});

export default router;
