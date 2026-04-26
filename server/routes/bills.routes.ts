import express from "express";
import { z } from "zod";
import { storage } from "../storage";
import {
  param,
  resolveUserCompany,
  verifyCompanyAccess,
  billSchema,
  billUpdateSchema,
  getSettingsForRequest,
  getAuditUserName,
  logAudit,
} from "./shared";
import { requireAuth, requireAdmin, requirePin } from "../middleware/auth";
import { financialLimiter } from "../middleware/rateLimiter";
import { paymentService } from "../paymentService";
import { notificationService } from "../services/notification-service";
import { mapPaymentError } from "../utils/paymentUtils";

const router = express.Router();

// ==================== BILLS ====================
router.get("/bills", requireAuth, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const bills = await storage.getBills(company?.companyId);
    res.json(bills);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bills" });
  }
});

router.get("/bills/:id", requireAuth, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const bill = await storage.getBill(param(req.params.id));
    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }
    if (company && !await verifyCompanyAccess(bill.companyId, company.companyId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bill" });
  }
});

router.post("/bills", requireAuth, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const result = billSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid bill data", details: result.error.issues });
    }
    const { name, provider, amount, dueDate, category, recurring, frequency, userId } = result.data;

    const settings = await getSettingsForRequest(req);
    const billCurrency = settings?.currency || 'USD';

    const bill = await storage.createBill({
      name,
      provider: provider || '',
      amount,
      dueDate,
      category: category || 'Other',
      status: 'unpaid',
      currency: billCurrency,
      logo: null,
      userId: userId || null,
      recurring: recurring || false,
      frequency: frequency || 'monthly',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      companyId: company?.companyId ?? null,
    });

    res.status(201).json(bill);
  } catch (error) {
    res.status(500).json({ error: "Failed to create bill" });
  }
});

router.patch("/bills/:id", requireAuth, async (req, res) => {
  try {
    const result = billUpdateSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid bill data", details: result.error.issues });
    }

    // SECURITY: Prevent setting status to paid via PATCH — use POST /api/bills/:id/pay instead
    if (result.data.status?.toLowerCase() === 'paid') {
      return res.status(400).json({ error: 'Use POST /api/bills/:id/pay to pay a bill through the wallet' });
    }

    const bill = await storage.updateBill(param(req.params.id), result.data as any);
    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    if (result.data.status?.toLowerCase() === 'paid') {
      try {
        const auditName = await getAuditUserName(req);
        await storage.createAuditLog({
          action: 'bill_payment',
          userId: (req as any).user?.uid || 'system',
          userName: auditName,
          entityType: 'bill',
          entityId: param(req.params.id),
          details: { billName: bill.name, amount: bill.amount, provider: bill.provider, category: bill.category },
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
          createdAt: new Date().toISOString(),
        } as any);
      } catch (e) { /* audit log failure should not block operation */ }
    }

    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: "Failed to update bill" });
  }
});

router.delete("/bills/:id", requireAuth, async (req, res) => {
  try {
    // AUD-DD-BILL-001: previously DELETE /bills/:id had no tenancy check —
    // any authenticated user could delete any tenant's bill. Now resolves
    // the caller's company and verifies the bill belongs to it before
    // deleting. Mirrors the same `verifyCompanyAccess` pattern used by
    // GET /bills/:id and PATCH /bills/:id.
    const bill = await storage.getBill(param(req.params.id));
    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }
    const company = await resolveUserCompany(req);
    if (company && !await verifyCompanyAccess(bill.companyId, company.companyId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const deleted = await storage.deleteBill(param(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: "Bill not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete bill" });
  }
});

// ==================== BILL APPROVAL WORKFLOW ====================

const billApprovalSchema = z.object({
  approvedBy: z.string().optional(),
  reason: z.string().optional(),
});

router.post("/bills/:id/approve", requireAuth, requireAdmin, requirePin, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const bill = await storage.getBill(param(req.params.id));
    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }
    if (company && !await verifyCompanyAccess(bill.companyId, company.companyId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!['pending', 'overdue', 'changes_requested'].includes(bill.status.toLowerCase())) {
      return res.status(400).json({ error: "Bill is not in a state that can be approved" });
    }

    const userId = (req as any).user?.uid || 'system';
    const userName = await getAuditUserName(req);

    const updatedBill = await storage.updateBill(bill.id, {
      status: 'approved',
      approvedBy: userId,
      approvedAt: new Date().toISOString(),
      reviewerComments: null,
    });

    await logAudit('bill', bill.id, 'approved', userId, userName,
      { status: bill.status },
      { status: 'approved' },
      { approvedBy: userId, billName: bill.name, amount: bill.amount }
    );

    res.json(updatedBill);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to approve bill" });
  }
});

// AUD-DD-BILL-002: PIN now required on reject (state-only change but
// the action is consequential — we pair it with PIN to match the
// posture of approve / pay / request-changes).
router.post("/bills/:id/reject", requireAuth, requireAdmin, requirePin, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const { reason } = req.body;

    const bill = await storage.getBill(param(req.params.id));
    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }
    if (company && !await verifyCompanyAccess(bill.companyId, company.companyId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!['pending', 'changes_requested'].includes(bill.status.toLowerCase())) {
      return res.status(400).json({ error: "Only pending bills can be rejected" });
    }

    const userId = (req as any).user?.uid || 'system';
    const userName = await getAuditUserName(req);

    const updatedBill = await storage.updateBill(bill.id, {
      status: 'rejected',
    });

    await logAudit('bill', bill.id, 'rejected', userId, userName,
      { status: bill.status },
      { status: 'rejected' },
      { reason: reason || 'No reason', rejectedBy: userId }
    );

    res.json(updatedBill);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to reject bill" });
  }
});

// Request changes on a bill
// AUD-DD-BILL-010: PIN now required on request-changes for the same
// reason as reject — pair the state mutation with PIN.
router.post("/bills/:id/request-changes", requireAuth, requireAdmin, requirePin, async (req, res) => {
  try {
    const { comments } = req.body;
    if (!comments || !comments.trim()) {
      return res.status(400).json({ error: "Comments are required when requesting changes" });
    }

    const company = await resolveUserCompany(req);
    const bill = await storage.getBill(param(req.params.id));
    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }
    if (company && !await verifyCompanyAccess(bill.companyId, company.companyId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (bill.status.toLowerCase() !== 'pending') {
      return res.status(400).json({ error: "Only pending bills can have changes requested" });
    }

    const userId = (req as any).user?.uid || 'system';
    const userName = await getAuditUserName(req);

    const updatedBill = await storage.updateBill(bill.id, {
      status: 'changes_requested',
      reviewerComments: comments.trim(),
    });

    await logAudit('bill', bill.id, 'changes_requested', userId, userName,
      { status: bill.status },
      { status: 'changes_requested', reviewerComments: comments.trim() },
      { requestedBy: userId, billName: bill.name }
    );

    res.json(updatedBill);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to request changes on bill" });
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

// ==================== BILL PAYMENT FROM WALLET ====================

router.post("/bills/:id/pay", financialLimiter, requireAuth, requirePin, async (req, res) => {
  try {
    const { walletId } = req.body;
    const company = await resolveUserCompany(req);

    const bill = await storage.getBill(param(req.params.id));
    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }
    if (company && !await verifyCompanyAccess(bill.companyId, company.companyId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (bill.status?.toLowerCase() === 'paid') {
      return res.status(400).json({ error: "Bill already paid" });
    }

    const wallet = await storage.getWallet(walletId);
    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Validate wallet currency matches bill currency
    const billCurrency = bill.currency || 'USD';
    if (wallet.currency && wallet.currency.toUpperCase() !== billCurrency.toUpperCase()) {
      return res.status(400).json({
        error: `Currency mismatch: bill is in ${billCurrency} but wallet is in ${wallet.currency}. Please use a ${billCurrency} wallet.`,
        billCurrency,
        walletCurrency: wallet.currency,
      });
    }

    const billAmount = parseFloat(bill.amount);
    const userId = (req as any).user?.uid || 'system';

    // Use atomic bill payment - debit + bill update in single transaction
    const { walletTx, bill: updatedBill } = await storage.atomicBillPayment({
      walletId,
      billId: bill.id,
      amount: billAmount,
      reference: `BILL-${bill.id}`,
      paidBy: userId,
    });

    // Create a transaction record (outside atomic - informational only)
    await storage.createTransaction({
      type: 'bill',
      amount: bill.amount,
      fee: '0',
      status: 'completed',
      date: new Date().toISOString(),
      description: `Bill payment: ${bill.name}`,
      currency: billCurrency,
      reference: `BILL-${bill.id}`,
      userId: userId !== 'system' ? userId : null,
      companyId: company?.companyId || null,
    });

    // Send bill payment confirmation email
    try {
      if (userId !== 'system') {
        const userSettings = await storage.getNotificationSettings(userId);
        const userProfile = await storage.getUser(userId);
        const userName = (userProfile as any)?.displayName || userProfile?.name || userProfile?.email?.split('@')[0] || 'User';
        if (userSettings?.email) {
          await notificationService.sendBillPaymentEmail({
            email: userSettings.email,
            name: userName,
            billName: bill.name,
            amount: billAmount,
            currency: billCurrency,
            provider: bill.provider || 'Direct',
            paymentDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            reference: `BILL-${bill.id}`,
          });
        }
      }
    } catch (emailErr) {
      console.error('Failed to send bill payment email:', emailErr);
    }

    res.json({ bill: updatedBill, walletTransaction: walletTx });
  } catch (error: any) {
    // AUD-DD-BILL-003 — surface the new BILL_ALREADY_PAID race-loser
    // error from atomicBillPayment as a clean 409 instead of a generic 500.
    if (error?.message === 'BILL_ALREADY_PAID') {
      return res.status(409).json({ error: 'Bill already paid' });
    }
    const mapped = mapPaymentError(error, 'bill_payment');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

export default router;
