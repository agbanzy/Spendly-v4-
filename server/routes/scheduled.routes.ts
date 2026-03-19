import express from "express";
import { z } from "zod";
import { storage } from "../storage";
import { param, resolveUserCompany, logAudit, getAuditUserName } from "./shared";
import { requireAuth, requireAdmin, requirePin } from "../middleware/auth";
import { mapPaymentError } from "../utils/paymentUtils";
import { paymentService } from "../paymentService";
import { paystackClient } from "../paystackClient";
import { runRecurringScheduler } from "../recurringScheduler";

const router = express.Router();

// ==================== SCHEDULED PAYMENTS ====================

const scheduledPaymentSchema = z.object({
  type: z.enum(['bill', 'payout', 'payroll', 'transfer']),
  sourceType: z.string().min(1),
  sourceId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']).default('monthly'),
  nextRunDate: z.string().min(1),
  recipientType: z.string().optional(),
  recipientId: z.string().optional(),
  recipientName: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

router.get("/scheduled-payments", requireAuth, requireAdmin, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const { status, type } = req.query;
    const payments = await storage.getScheduledPayments({
      status: status as string,
      type: type as string,
      companyId: company?.companyId,
    });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch scheduled payments" });
  }
});

router.post("/scheduled-payments", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = scheduledPaymentSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid scheduled payment data", details: result.error.issues });
    }

    const company = await resolveUserCompany(req);
    const userId = (req as any).user?.uid || 'system';

    const payment = await storage.createScheduledPayment({
      ...result.data,
      amount: String(result.data.amount),
      status: 'active',
      companyId: company?.companyId,
      createdBy: userId,
    } as any);

    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ error: "Failed to create scheduled payment" });
  }
});

router.patch("/scheduled-payments/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const payment = await storage.updateScheduledPayment(param(req.params.id), req.body);
    if (!payment) {
      return res.status(404).json({ error: "Scheduled payment not found" });
    }
    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: "Failed to update scheduled payment" });
  }
});

router.delete("/scheduled-payments/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const deleted = await storage.deleteScheduledPayment(param(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: "Scheduled payment not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete scheduled payment" });
  }
});

router.post("/scheduled-payments/:id/pause", requireAuth, requireAdmin, async (req, res) => {
  try {
    const payment = await storage.updateScheduledPayment(param(req.params.id), { status: 'paused' });
    if (!payment) {
      return res.status(404).json({ error: "Scheduled payment not found" });
    }
    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: "Failed to pause scheduled payment" });
  }
});

router.post("/scheduled-payments/:id/resume", requireAuth, requireAdmin, async (req, res) => {
  try {
    const payment = await storage.updateScheduledPayment(param(req.params.id), { status: 'active' });
    if (!payment) {
      return res.status(404).json({ error: "Scheduled payment not found" });
    }
    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: "Failed to resume scheduled payment" });
  }
});

router.post("/admin/run-scheduler", requireAuth, requireAdmin, async (req, res) => {
  try {
    await runRecurringScheduler();
    res.json({ success: true, message: "Recurring scheduler executed successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to run scheduler", detail: error.message });
  }
});

// ==================== BATCH DISBURSEMENT ====================

// Batch disbursement (process multiple approved payouts)
router.post("/payouts/batch-process", requireAuth, requireAdmin, requirePin, async (req, res) => {
  try {
    const userId = (req as any).user?.uid;
    const userName = await getAuditUserName(req);
    const { payoutIds } = req.body;

    if (!Array.isArray(payoutIds) || payoutIds.length === 0) {
      return res.status(400).json({ error: "Payout IDs array required" });
    }

    if (payoutIds.length > 50) {
      return res.status(400).json({ error: "Maximum 50 payouts per batch" });
    }

    const results: any[] = [];
    const paystackBatch: any[] = [];

    for (const payoutId of payoutIds) {
      try {
        const payout = await storage.getPayout(payoutId);
        if (!payout || !['pending', 'approved'].includes(payout.status)) {
          results.push({ payoutId, status: 'skipped', reason: 'Not pending/approved' });
          continue;
        }

        const destination = payout.destinationId
          ? await storage.getPayoutDestination(payout.destinationId)
          : null;

        if (!destination) {
          results.push({ payoutId, status: 'failed', reason: 'No destination configured' });
          continue;
        }

        // Group Paystack transfers for bulk
        if (destination.provider === 'paystack') {
          paystackBatch.push({ payout, destination });
        } else {
          // Process Stripe individually
          try {
            const transferResult = await paymentService.initiateTransfer(
              parseFloat(payout.amount),
              {
                accountNumber: destination.accountNumber,
                bankCode: destination.bankCode,
                accountName: destination.accountName,
                stripeAccountId: destination.providerRecipientId,
                currency: destination.currency,
              },
              destination.country || 'US',
              `Batch payout: ${payout.type} - ${payout.id}`
            );

            await storage.updatePayout(payout.id, {
              status: transferResult.status === 'completed' ? 'completed' : 'processing',
              providerTransferId: transferResult.transferId || transferResult.reference,
              processedAt: new Date().toISOString(),
            });

            await logAudit(
              'payout',
              payout.id,
              'batch_processed',
              userId,
              userName,
              { status: payout.status },
              { status: 'processing', batch: true }
            );

            results.push({ payoutId, status: 'processing', transferId: transferResult.transferId });
          } catch (err: any) {
            await storage.updatePayout(payout.id, {
              status: 'failed',
              failureReason: err.message,
            });
            results.push({ payoutId, status: 'failed', error: err.message });
          }
        }
      } catch (err: any) {
        results.push({ payoutId, status: 'error', error: err.message });
      }
    }

    // Process Paystack batch if any
    if (paystackBatch.length > 0) {
      try {
        const bulkTransfers: any[] = [];
        for (const { payout, destination } of paystackBatch) {
          // Create recipient first
          const recipientResult = await paystackClient.createTransferRecipient(
            destination.accountName || 'Recipient',
            destination.accountNumber,
            destination.bankCode,
            destination.currency || 'NGN'
          );

          bulkTransfers.push({
            amount: parseFloat(payout.amount),
            recipient: recipientResult.data.recipient_code,
            reason: `${payout.type}: ${payout.id}`,
            reference: `batch_${payout.id}_${Date.now()}`,
          });
        }

        const bulkResult = await paystackClient.bulkTransfer(bulkTransfers);

        for (let i = 0; i < paystackBatch.length; i++) {
          const { payout } = paystackBatch[i];
          await storage.updatePayout(payout.id, {
            status: 'processing',
            processedAt: new Date().toISOString(),
          });

          await logAudit(
            'payout',
            payout.id,
            'batch_processed',
            userId,
            userName,
            { status: payout.status },
            { status: 'processing', batch: true, provider: 'paystack' }
          );

          results.push({ payoutId: payout.id, status: 'processing', provider: 'paystack' });
        }
      } catch (err: any) {
        for (const { payout } of paystackBatch) {
          results.push({ payoutId: payout.id, status: 'failed', error: err.message });
        }
      }
    }

    res.json({
      total: payoutIds.length,
      processed: results.filter(r => ['processing', 'completed'].includes(r.status)).length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      results,
    });
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'payout');
    res.status(mapped.statusCode).json({ error: mapped.userMessage });
  }
});

// ==================== TRIAL EXPIRY SCHEDULER ====================
// Check for expired trials every hour
async function checkTrialExpiry() {
  try {
    const { subscriptions: subTable } = await import('@shared/schema');
    const { lt, and: andOp, eq: eqOp } = await import('drizzle-orm');
    const { db: database } = await import('../db');
    const now = new Date().toISOString();

    // Find all trialing subscriptions where trial has ended
    const expiredTrials = await database
      .select()
      .from(subTable)
      .where(andOp(
        eqOp(subTable.status, 'trialing'),
        lt(subTable.trialEndDate, now)
      ));

    for (const sub of expiredTrials) {
      await storage.updateSubscription(sub.id, {
        status: 'expired',
        updatedAt: now,
      });
      // Update company settings too
      try {
        await storage.updateCompanyAsSettings(sub.companyId, {
          subscriptionStatus: 'expired',
        } as any);
      } catch (err) {
        console.error(`Failed to update company settings for expired trial ${sub.companyId}:`, err);
      }
      console.log(`Trial expired for company ${sub.companyId}`);
    }

    if (expiredTrials.length > 0) {
      console.log(`Processed ${expiredTrials.length} expired trials`);
    }
  } catch (err) {
    console.error('Trial expiry check failed:', err);
  }
}

// Run every hour
setInterval(checkTrialExpiry, 60 * 60 * 1000);
// Also run once on startup after a short delay
setTimeout(checkTrialExpiry, 30_000);

export default router;
