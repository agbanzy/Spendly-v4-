import express from "express";
import { z } from "zod";
import { storage } from "../storage";
import {
  param,
  resolveUserCompany,
  getSettingsForRequest,
  logAudit,
  getAuditUserName,
} from "./shared";
import { requireAuth, requireAdmin, requirePin } from "../middleware/auth";
import { mapPaymentError } from "../utils/paymentUtils";
import { paymentService } from "../paymentService";
import { paystackClient } from "../paystackClient";
import { notificationService } from "../services/notification-service";

const router = express.Router();

// ==================== PAYOUT DESTINATIONS ROUTES ====================

router.get("/payout-destinations", requireAuth, async (req, res) => {
  try {
    const { userId, vendorId } = req.query;
    const destinations = await storage.getPayoutDestinations(
      userId as string,
      vendorId as string
    );
    res.json(destinations);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'payout');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

const payoutDestinationSchema = z.object({
  userId: z.string().optional(),
  vendorId: z.string().optional(),
  type: z.enum(['bank_account', 'mobile_money', 'card']).default('bank_account'),
  provider: z.string().min(1),
  bankName: z.string().optional(),
  bankCode: z.string().optional(),
  accountNumber: z.string().optional(),
  accountName: z.string().optional(),
  routingNumber: z.string().optional(),
  swiftCode: z.string().optional(),
  currency: z.string().min(3).max(3).default('USD'),
  country: z.string().min(2).max(2).default('US'),
  isDefault: z.boolean().optional().default(false),
  providerRecipientId: z.string().optional(),
}).refine(data => data.userId || data.vendorId, {
  message: "Either userId or vendorId must be provided",
});

router.post("/payout-destinations", requireAuth, async (req, res) => {
  try {
    const result = payoutDestinationSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid destination data", details: result.error.issues });
    }

    const data = result.data;
    let isVerified = false;
    let resolvedAccountName = data.accountName;

    // Auto-verify bank account with provider
    if (data.type === 'bank_account' && data.accountNumber && data.bankCode) {
      try {
        if (data.provider === 'paystack' && ['NG', 'GH', 'ZA', 'KE'].includes(data.country || '')) {
          // Paystack: resolve account number to verify it exists and get account name
          const resolved = await paystackClient.resolveAccountNumber(data.accountNumber, data.bankCode);
          if (resolved?.data?.account_name) {
            resolvedAccountName = resolved.data.account_name;
            isVerified = true;
          }
        } else if (data.provider === 'stripe' && data.accountNumber) {
          // Stripe: validate format (actual verification happens at transfer time)
          const { validateBankDetails: validateBank } = await import('../utils/bankValidation');
          const bankValidation = validateBank({
            countryCode: data.country || 'US',
            accountNumber: data.accountNumber,
            accountName: data.accountName || '',
            routingNumber: data.routingNumber,
          });
          if (bankValidation.valid) {
            isVerified = true;
          }
        }
      } catch (verifyErr: any) {
        // Verification failed — save as unverified so user can still proceed
        console.warn(`Bank verification failed: ${verifyErr.message}`);
      }
    }

    // Create Paystack transfer recipient upfront so transfers are instant
    let providerRecipientId = data.providerRecipientId;
    if (isVerified && data.provider === 'paystack' && data.accountNumber && data.bankCode && !providerRecipientId) {
      try {
        const recipient = await paystackClient.createTransferRecipient(
          resolvedAccountName || data.accountName || '',
          data.accountNumber,
          data.bankCode,
          data.currency || 'NGN',
          data.country || 'NG'
        );
        if (recipient?.data?.recipient_code) {
          providerRecipientId = recipient.data.recipient_code;
        }
      } catch (recipientErr: any) {
        console.warn(`Transfer recipient creation failed: ${recipientErr.message}`);
      }
    }

    const destination = await storage.createPayoutDestination({
      ...data,
      accountName: resolvedAccountName || data.accountName,
      isVerified,
      providerRecipientId,
    });
    res.status(201).json(destination);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'payout');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

router.put("/payout-destinations/:id", requireAuth, async (req, res) => {
  try {
    // Validate input
    const updateSchema = (payoutDestinationSchema as any).partial();
    const result = updateSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid destination data", details: result.error.issues });
    }

    // Check destination exists
    const existing = await storage.getPayoutDestination(param(req.params.id));
    if (!existing) {
      return res.status(404).json({ error: "Payout destination not found" });
    }

    // Ownership check
    const authUserId = (req as any).user?.cognitoSub;
    if (existing.userId && existing.userId !== authUserId) {
      return res.status(403).json({ error: "Not authorized to update this destination" });
    }

    const destination = await storage.updatePayoutDestination(param(req.params.id), result.data);
    res.json(destination);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'payout');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

router.delete("/payout-destinations/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await storage.deletePayoutDestination(param(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: "Payout destination not found" });
    }
    res.json({ success: true });
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'payout');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// ==================== PAYOUT ROUTES ====================

router.get("/payouts", requireAuth, async (req, res) => {
  try {
    const { recipientType, recipientId, status } = req.query;
    const payoutsCompany = await resolveUserCompany(req);
    const payoutsList = await storage.getPayouts({
      recipientType: recipientType as string,
      recipientId: recipientId as string,
      status: status as string,
      companyId: payoutsCompany?.companyId,
    });
    res.json(payoutsList);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'payout');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

router.get("/payouts/:id", requireAuth, async (req, res) => {
  try {
    const payout = await storage.getPayout(param(req.params.id));
    if (!payout) {
      return res.status(404).json({ error: "Payout not found" });
    }
    res.json(payout);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'payout');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// Initiate payout (expense reimbursement, payroll, vendor payment)
router.post("/payouts", requireAuth, async (req, res) => {
  try {
    const {
      type, amount, currency, recipientType, recipientId, recipientName,
      destinationId, relatedEntityType, relatedEntityId, initiatedBy
    } = req.body;

    // Get payout destination
    let destination: any = null;
    let provider = 'stripe';

    if (destinationId) {
      destination = await storage.getPayoutDestination(destinationId);
      if (destination) {
        provider = destination.provider;
      }
    }

    // Create payout record
    const payout = await storage.createPayout({
      type,
      amount: amount.toString(),
      currency: currency || 'USD',
      status: 'pending',
      recipientType,
      recipientId,
      recipientName,
      destinationId,
      provider,
      relatedEntityType,
      relatedEntityId,
      initiatedBy: (req as any).user?.cognitoSub || initiatedBy,
    });

    res.status(201).json(payout);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'payout');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// Payout approval (maker-checker for high-value)
router.post("/payouts/:id/approve", requireAuth, requireAdmin, requirePin, async (req, res) => {
  try {
    const userId = (req as any).user?.uid;
    const userName = await getAuditUserName(req);
    const payout = await storage.getPayout(param(req.params.id));

    if (!payout) {
      return res.status(404).json({ error: "Payout not found" });
    }

    if (!['pending', 'pending_second_approval'].includes(payout.status)) {
      return res.status(400).json({ error: "Payout is not in approvable status" });
    }

    const amount = parseFloat(payout.amount);
    const settings = await getSettingsForRequest(req);
    const dualApprovalThreshold = parseFloat((settings as any)?.dualApprovalThreshold?.toString() || '5000');

    // Check if dual approval is needed
    if (amount >= dualApprovalThreshold) {
      // Maker-checker: initiator cannot be the approver
      if (payout.initiatedBy === userId) {
        return res.status(403).json({
          error: "High-value payouts require approval from a different admin (maker-checker policy)",
          requiresDualApproval: true,
          threshold: dualApprovalThreshold,
        });
      }

      // Check if already has first approval
      const metadata = payout.metadata ? JSON.parse(JSON.stringify(payout.metadata)) : {};
      if (!metadata.firstApproval) {
        // First approval - store it, keep as pending_second_approval
        metadata.firstApproval = { by: userId, byName: userName, at: new Date().toISOString() };
        const updatedPayout = await storage.updatePayout(payout.id, {
          status: 'pending_second_approval',
          metadata: metadata as any,
        });

        await logAudit(
          'payout',
          payout.id,
          'first_approval',
          userId,
          userName,
          { status: payout.status },
          { status: 'pending_second_approval' },
          { amount, threshold: dualApprovalThreshold, makerChecker: true }
        );

        return res.json({
          status: 'pending_second_approval',
          message: `Payout of ${payout.currency} ${amount} requires second approval (threshold: ${dualApprovalThreshold})`,
          payout: updatedPayout,
        });
      }

      // Second approval - different person check
      if (metadata.firstApproval.by === userId) {
        return res.status(403).json({
          error: "Second approval must be from a different admin",
        });
      }

      metadata.secondApproval = { by: userId, byName: userName, at: new Date().toISOString() };
      const updatedPayout = await storage.updatePayout(payout.id, {
        status: 'approved',
        approvedBy: userId,
        metadata: metadata as any,
      });

      await logAudit(
        'payout',
        payout.id,
        'second_approval',
        userId,
        userName,
        { status: 'pending_second_approval' },
        { status: 'approved', approvedBy: userId },
        { amount, makerChecker: true, firstApprover: metadata.firstApproval.by }
      );

      // Notify the initiator their payout was approved
      if (payout.initiatedBy) {
        notificationService.notifyPayoutApproved(payout.initiatedBy, {
          amount, currency: payout.currency, recipientName: payout.recipientName || 'Recipient', approverName: userName,
        }).catch(console.error);
      }

      return res.json({
        status: 'approved',
        message: 'Payout approved with dual authorization. Ready for processing.',
        payout: updatedPayout,
      });
    }

    // Below threshold: single approval
    const updatedPayout = await storage.updatePayout(payout.id, {
      status: 'approved',
      approvedBy: userId,
    });

    await logAudit(
      'payout',
      payout.id,
      'approved',
      userId,
      userName,
      { status: payout.status },
      { status: 'approved', approvedBy: userId },
      { amount, singleApproval: true }
    );

    // Notify the initiator their payout was approved
    if (payout.initiatedBy && payout.initiatedBy !== userId) {
      notificationService.notifyPayoutApproved(payout.initiatedBy, {
        amount, currency: payout.currency, recipientName: payout.recipientName || 'Recipient', approverName: userName,
      }).catch(console.error);
    }

    res.json({
      status: 'approved',
      message: 'Payout approved. Ready for processing.',
      payout: updatedPayout,
    });
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'payout');
    res.status(mapped.statusCode).json({ error: mapped.userMessage });
  }
});

// Process payout (actually send money via Stripe/Paystack)
router.post("/payouts/:id/process", requireAuth, requireAdmin, requirePin, async (req, res) => {
  try {
    const payout = await storage.getPayout(param(req.params.id));
    if (!payout) {
      return res.status(404).json({ error: "Payout not found" });
    }

    if (!['pending', 'approved'].includes(payout.status)) {
      return res.status(400).json({ error: `Payout cannot be processed in '${payout.status}' status. Must be 'pending' or 'approved'.` });
    }

    const destination = payout.destinationId
      ? await storage.getPayoutDestination(payout.destinationId)
      : null;

    if (!destination) {
      return res.status(400).json({ error: "No payout destination configured" });
    }

    // Determine country for provider selection
    const countryCode = destination.country || 'US';

    try {
      // Initiate transfer via payment service
      const transferResult = await paymentService.initiateTransfer(
        parseFloat(payout.amount),
        {
          accountNumber: destination.accountNumber,
          bankCode: destination.bankCode,
          accountName: destination.accountName,
          stripeAccountId: destination.providerRecipientId,
          currency: destination.currency,
        },
        countryCode,
        `Payout: ${payout.type} - ${payout.id}`
      );

      // Update payout status
      const updatedPayout = await storage.updatePayout(payout.id, {
        status: 'processing',
        providerTransferId: transferResult.transferId || transferResult.transferCode,
        providerReference: transferResult.reference,
        processedAt: new Date().toISOString(),
      });

      // Log audit trail for payout processing
      const userId = (req as any).user?.uid;
      const userName = await getAuditUserName(req);
      await logAudit(
        'payout',
        payout.id,
        'processed',
        userId,
        userName,
        { status: 'pending' },
        { status: 'processing', providerTransferId: updatedPayout!.providerTransferId },
        { provider: destination.provider, amount: payout.amount, currency: payout.currency }
      );

      // If related to an expense, update expense payout status
      if (payout.relatedEntityType === 'expense' && payout.relatedEntityId) {
        await storage.updateExpense(payout.relatedEntityId, {
          payoutStatus: 'processing',
          payoutId: payout.id,
        });
      }

      // Credit recipient wallet if they have one
      if (payout.recipientType === 'employee' && payout.recipientId) {
        const recipientWallet = await storage.getWalletByUserId(payout.recipientId, payout.currency);
        if (recipientWallet) {
          await storage.creditWallet(
            recipientWallet.id,
            parseFloat(payout.amount),
            payout.type,
            `Payout received: ${payout.type}`,
            `PO-${payout.id}`,
            { payoutId: payout.id }
          );
        }

        // Send payout confirmation notification
        notificationService.notifyPayoutProcessed(payout.recipientId, {
          amount: parseFloat(payout.amount),
          currency: payout.currency,
          recipientName: payout.recipientName || 'Recipient',
          bankName: destination.bankName || undefined,
          reference: transferResult.reference,
        }).catch(err => console.error('Failed to send payout notification:', err));

        // Also send detailed payout confirmation email if user has email
        const recipientProfile = await storage.getUserProfileByCognitoSub(payout.recipientId);
        if (recipientProfile?.email) {
          notificationService.sendPayoutConfirmationEmail({
            email: recipientProfile.email,
            name: payout.recipientName || 'Recipient',
            amount: parseFloat(payout.amount),
            currency: payout.currency,
            recipientName: payout.recipientName || 'Recipient',
            recipientBank: destination.bankName || undefined,
            recipientAccount: destination.accountNumber || undefined,
            reference: transferResult.reference || payout.id,
            date: new Date().toLocaleDateString(),
          }).catch(err => console.error('Failed to send payout email:', err));
        }
      }

      res.json(updatedPayout);
    } catch (transferError: any) {
      // Update payout as failed
      await storage.updatePayout(payout.id, {
        status: 'failed',
        failureReason: transferError.message,
      });
      const mapped = mapPaymentError(transferError, 'payout');
      res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
    }
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'payout');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

router.post("/payouts/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = (req as any).user?.uid;
    const userName = await getAuditUserName(req);
    const { reason } = req.body;

    const payout = await storage.getPayout(param(req.params.id));
    if (!payout) {
      return res.status(404).json({ error: "Payout not found" });
    }

    if (!['pending', 'pending_second_approval', 'approved'].includes(payout.status)) {
      return res.status(400).json({ error: "Payout is not in a rejectable status" });
    }

    const updatedPayout = await storage.updatePayout(payout.id, {
      status: 'rejected',
      failureReason: reason || 'Rejected by admin',
    });

    await logAudit(
      'payout',
      payout.id,
      'rejected',
      userId,
      userName,
      { status: payout.status },
      { status: 'rejected' },
      { reason: reason || 'No reason provided', rejectedBy: userId, amount: payout.amount }
    );

    if (payout.relatedEntityType === 'expense' && payout.relatedEntityId) {
      await storage.updateExpense(payout.relatedEntityId, {
        payoutStatus: 'rejected',
      });
    }

    res.json(updatedPayout);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to reject payout" });
  }
});

export default router;
