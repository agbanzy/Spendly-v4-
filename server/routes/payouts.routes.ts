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

// ==================== PAYOUT CURRENCY VALIDATION ====================

/**
 * Mapping of country codes to their expected currencies.
 * Used to validate that payout currency matches the destination country.
 */
const COUNTRY_CURRENCY_MAP: Record<string, string[]> = {
  US: ['USD'],
  CA: ['CAD'],
  GB: ['GBP'],
  NG: ['NGN'],
  GH: ['GHS'],
  KE: ['KES'],
  ZA: ['ZAR'],
  EG: ['EGP'],
  RW: ['RWF'],
  AU: ['AUD'],
  EU: ['EUR'], // Eurozone placeholder
  DE: ['EUR'],
  FR: ['EUR'],
  IT: ['EUR'],
  ES: ['EUR'],
  NL: ['EUR'],
  IE: ['EUR'],
  PT: ['EUR'],
  AT: ['EUR'],
  BE: ['EUR'],
  FI: ['EUR'],
  GR: ['EUR'],
  SE: ['SEK'],
  NO: ['NOK'],
  DK: ['DKK'],
  CH: ['CHF'],
  JP: ['JPY'],
  IN: ['INR'],
  CN: ['CNY'],
};

interface CurrencyValidationResult {
  valid: boolean;
  error?: string;
  expectedCurrencies?: string[];
  country?: string;
}

/**
 * Validate that the payout currency matches the destination country's expected currency.
 * Returns an error if there is a mismatch.
 */
function validatePayoutCurrency(currency: string, countryCode: string): CurrencyValidationResult {
  const normalizedCountry = countryCode.toUpperCase();
  const normalizedCurrency = currency.toUpperCase();

  const expectedCurrencies = COUNTRY_CURRENCY_MAP[normalizedCountry];

  // If country is not in our map, we allow any currency (unknown territory)
  if (!expectedCurrencies) {
    return { valid: true };
  }

  if (!expectedCurrencies.includes(normalizedCurrency)) {
    return {
      valid: false,
      error: `Currency ${normalizedCurrency} does not match destination country ${normalizedCountry}. Expected: ${expectedCurrencies.join(' or ')}.`,
      expectedCurrencies,
      country: normalizedCountry,
    };
  }

  return { valid: true };
}

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

        // Validate currency matches destination country
        const payoutCurrency = currency || 'USD';
        const countryCode = destination.country || 'US';
        const currencyCheck = validatePayoutCurrency(payoutCurrency, countryCode);
        if (!currencyCheck.valid) {
          return res.status(400).json({
            error: currencyCheck.error,
            expectedCurrencies: currencyCheck.expectedCurrencies,
            destinationCountry: currencyCheck.country,
          });
        }
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
// LU-DD-5 / AUD-DD-PAY-002 — Debit-first payout processing.
//
// The previous flow called the external Stripe / Paystack transfer FIRST and
// only then updated local state. If the external call succeeded but a later
// step crashed (DB outage, container kill, network blip), money left the
// bank account without any local ledger entry. This route now matches the
// scheduler's "FIX P4" pattern:
//
//   1. Atomically claim the payout (status pending|approved → processing)
//      so two concurrent /process calls cannot both proceed.
//   2. Validate destination + currency.
//   3. Lock company_balances FOR UPDATE, debit the appropriate column,
//      insert a 'Processing' transactions row — all in ONE DB transaction.
//   4. Call paymentService.initiateTransfer (external).
//   5a. Success → update payout providerTransferId/Reference + processedAt;
//       leave the local txn at 'Processing' (a webhook later flips it to
//       'Completed' once the bank settles).
//   5b. Failure → compensating credit (DB transaction), mark local txn
//       'Failed', mark payout 'failed' with a failureReason.
router.post("/payouts/:id/process", requireAuth, requireAdmin, requirePin, async (req, res) => {
  // Pre-claim phase — read the row, then atomically claim it.
  let payout: Awaited<ReturnType<typeof storage.getPayout>> | null = null;
  try {
    payout = await storage.getPayout(param(req.params.id));
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

    const countryCode = destination.country || 'US';
    const currencyCheck = validatePayoutCurrency(payout.currency, countryCode);
    if (!currencyCheck.valid) {
      return res.status(400).json({
        error: currencyCheck.error,
        expectedCurrencies: currencyCheck.expectedCurrencies,
        destinationCountry: currencyCheck.country,
      });
    }

    if (!payout.companyId) {
      return res.status(400).json({ error: "Payout has no companyId; refusing to process" });
    }
    // Hoist into a local so TypeScript carries the narrowed type past the
    // `payout = claimed` reassignment below.
    const companyIdForDebit: string = payout.companyId;

    // Step 1 — atomically claim the payout. If a concurrent caller
    // already moved status off pending/approved, claim returns null and
    // we reject without doing anything.
    const claimed = await storage.claimPayoutForProcessing(payout.id);
    if (!claimed) {
      return res.status(409).json({ error: "Payout was claimed by another process or is no longer in a processable state." });
    }

    const previousStatus = payout.status;
    payout = claimed;

    const userId = (req as any).user?.uid;
    const userName = await getAuditUserName(req);

    // Step 2 — local debit FIRST (DB transaction). If this throws (e.g.
    // insufficient funds), we still need to release the claim so the
    // caller can retry after topping up.
    let debitResult: Awaited<ReturnType<typeof storage.atomicPayoutDebit>>;
    try {
      debitResult = await storage.atomicPayoutDebit({
        payoutId: payout.id,
        companyId: companyIdForDebit,
        amount: parseFloat(payout.amount),
        currency: payout.currency,
        description: `Payout: ${payout.type} - ${payout.id}`,
        reference: payout.id,
        userId: userId ?? null,
      });
    } catch (debitError: any) {
      // Release the claim so the caller can retry.
      await storage.updatePayout(payout.id, {
        status: previousStatus,
      });
      return res.status(422).json({
        error: debitError?.message || "Local payout debit failed",
        code: 'PAYOUT_DEBIT_FAILED',
      });
    }

    // Audit log: payout has now committed to a local debit. The state
    // transition we record is previousStatus → 'processing'.
    await logAudit(
      'payout',
      payout.id,
      'debited',
      userId,
      userName,
      { status: previousStatus },
      { status: 'processing', localTransactionId: debitResult.transactionId, balanceField: debitResult.balanceField },
      { provider: destination.provider, amount: payout.amount, currency: payout.currency }
    );

    // Step 3 — external transfer.
    let transferResult;
    try {
      transferResult = await paymentService.initiateTransfer(
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
    } catch (transferError: any) {
      // External call failed — run the compensating credit and mark the
      // payout failed. Don't propagate the compensation error; if it
      // fails too we want the original transferError reaching the client.
      try {
        await storage.atomicPayoutCompensateOnFailure({
          transactionId: debitResult.transactionId,
          companyId: companyIdForDebit,
          amount: parseFloat(payout.amount),
          currency: payout.currency,
          reason: transferError?.message || 'external transfer failed',
        });
      } catch (compErr: any) {
        // Compensation must not silently fail. Log loudly so ops can
        // manually reconcile if needed.
        console.error('PAYOUT COMPENSATION FAILED — manual reconciliation required', {
          payoutId: payout.id,
          companyId: companyIdForDebit,
          amount: payout.amount,
          currency: payout.currency,
          transactionId: debitResult.transactionId,
          compensationError: compErr?.message,
          originalError: transferError?.message,
        });
      }
      await storage.updatePayout(payout.id, {
        status: 'failed',
        failureReason: transferError?.message?.slice(0, 500),
      });
      await logAudit(
        'payout',
        payout.id,
        'failed',
        userId,
        userName,
        { status: 'processing' },
        { status: 'failed', failureReason: transferError?.message?.slice(0, 500) },
        { provider: destination.provider, transferError: transferError?.message }
      );
      const mapped = mapPaymentError(transferError, 'payout');
      return res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
    }

    // Step 4 — external transfer accepted. Update payout with provider
    // identifiers; leave local txn at 'Processing' until webhook
    // confirms settlement.
    const updatedPayout = await storage.updatePayout(payout.id, {
      providerTransferId: transferResult.transferId || transferResult.transferCode,
      providerReference: transferResult.reference,
      processedAt: new Date().toISOString(),
    });

    await logAudit(
      'payout',
      payout.id,
      'processed',
      userId,
      userName,
      { status: 'processing' },
      { providerTransferId: updatedPayout!.providerTransferId },
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

      notificationService.notifyPayoutProcessed(payout.recipientId, {
        amount: parseFloat(payout.amount),
        currency: payout.currency,
        recipientName: payout.recipientName || 'Recipient',
        bankName: destination.bankName || undefined,
        reference: transferResult.reference,
      }).catch(err => console.error('Failed to send payout notification:', err));

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
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'payout');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// ==================== BATCH PAYOUT PROCESSING ====================

router.post("/payouts/batch", requireAuth, requireAdmin, requirePin, async (req, res) => {
  try {
    const { payoutIds } = req.body;

    if (!Array.isArray(payoutIds) || payoutIds.length === 0) {
      return res.status(400).json({ error: "payoutIds must be a non-empty array" });
    }

    if (payoutIds.length > 50) {
      return res.status(400).json({ error: "Maximum 50 payouts per batch" });
    }

    const userId = (req as any).user?.uid;
    const userName = await getAuditUserName(req);

    const results: Array<{
      payoutId: string;
      status: 'processed' | 'failed' | 'skipped';
      error?: string;
      providerReference?: string;
    }> = [];

    let processed = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    // LU-DD-5 / AUD-DD-PAY-002 — same debit-first pattern as the
    // single /payouts/:id/process flow, applied per item.
    for (const payoutId of payoutIds) {
      try {
        const payout = await storage.getPayout(payoutId);
        if (!payout) {
          results.push({ payoutId, status: 'skipped', error: 'Payout not found' });
          skipped++;
          continue;
        }

        if (!['pending', 'approved'].includes(payout.status)) {
          results.push({ payoutId, status: 'skipped', error: `Cannot process payout in '${payout.status}' status` });
          skipped++;
          continue;
        }

        const destination = payout.destinationId
          ? await storage.getPayoutDestination(payout.destinationId)
          : null;

        if (!destination) {
          results.push({ payoutId, status: 'failed', error: 'No payout destination configured' });
          failed++;
          errors.push(`${payoutId}: No destination`);
          continue;
        }

        const countryCode = destination.country || 'US';

        const currencyCheck = validatePayoutCurrency(payout.currency, countryCode);
        if (!currencyCheck.valid) {
          results.push({ payoutId, status: 'failed', error: currencyCheck.error });
          failed++;
          errors.push(`${payoutId}: ${currencyCheck.error}`);
          continue;
        }

        if (!payout.companyId) {
          results.push({ payoutId, status: 'failed', error: 'No companyId on payout' });
          failed++;
          errors.push(`${payoutId}: No companyId`);
          continue;
        }
        const companyIdForDebit: string = payout.companyId;

        // Atomic claim — skip silently if the row was already taken.
        const claimed = await storage.claimPayoutForProcessing(payout.id);
        if (!claimed) {
          results.push({ payoutId, status: 'skipped', error: 'Already claimed by another process' });
          skipped++;
          continue;
        }
        const previousStatus = payout.status;

        // Local debit FIRST.
        let debitResult: Awaited<ReturnType<typeof storage.atomicPayoutDebit>>;
        try {
          debitResult = await storage.atomicPayoutDebit({
            payoutId: payout.id,
            companyId: companyIdForDebit,
            amount: parseFloat(payout.amount),
            currency: payout.currency,
            description: `Batch Payout: ${payout.type} - ${payout.id}`,
            reference: payout.id,
            userId: userId ?? null,
          });
        } catch (debitError: any) {
          // Release the claim so the user can retry once funded.
          await storage.updatePayout(payout.id, { status: previousStatus });
          results.push({ payoutId, status: 'failed', error: debitError?.message || 'debit failed' });
          failed++;
          errors.push(`${payoutId}: ${debitError?.message}`);
          continue;
        }

        // External transfer.
        let transferResult;
        try {
          transferResult = await paymentService.initiateTransfer(
            parseFloat(payout.amount),
            {
              accountNumber: destination.accountNumber,
              bankCode: destination.bankCode,
              accountName: destination.accountName,
              stripeAccountId: destination.providerRecipientId,
              currency: destination.currency,
            },
            countryCode,
            `Batch Payout: ${payout.type} - ${payout.id}`
          );
        } catch (transferErr: any) {
          // Compensate locally and continue with the next item.
          try {
            await storage.atomicPayoutCompensateOnFailure({
              transactionId: debitResult.transactionId,
              companyId: companyIdForDebit,
              amount: parseFloat(payout.amount),
              currency: payout.currency,
              reason: transferErr?.message || 'external transfer failed',
            });
          } catch (compErr: any) {
            console.error('BATCH PAYOUT COMPENSATION FAILED — manual reconciliation required', {
              payoutId, companyId: companyIdForDebit, transactionId: debitResult.transactionId,
              compensationError: compErr?.message, originalError: transferErr?.message,
            });
          }
          await storage.updatePayout(payoutId, {
            status: 'failed',
            failureReason: transferErr?.message?.slice(0, 500),
          });
          results.push({ payoutId, status: 'failed', error: transferErr?.message });
          failed++;
          errors.push(`${payoutId}: ${transferErr?.message}`);
          continue;
        }

        await storage.updatePayout(payout.id, {
          providerTransferId: transferResult.transferId || transferResult.transferCode,
          providerReference: transferResult.reference,
          processedAt: new Date().toISOString(),
        });

        results.push({ payoutId, status: 'processed', providerReference: transferResult.reference });
        processed++;

        // Credit recipient wallet if applicable
        if (payout.recipientType === 'employee' && payout.recipientId) {
          const recipientWallet = await storage.getWalletByUserId(payout.recipientId, payout.currency);
          if (recipientWallet) {
            await storage.creditWallet(
              recipientWallet.id,
              parseFloat(payout.amount),
              payout.type,
              `Batch payout received: ${payout.type}`,
              `BPO-${payout.id}`,
              { payoutId: payout.id, batch: true }
            );
          }
        }
      } catch (err: any) {
        // Catch-all for non-debit, non-transfer failures (DB outage, etc.)
        try {
          await storage.updatePayout(payoutId, {
            status: 'failed',
            failureReason: err?.message?.slice(0, 500),
          });
        } catch {}

        results.push({ payoutId, status: 'failed', error: err.message });
        failed++;
        errors.push(`${payoutId}: ${err.message}`);
      }
    }

    // Log audit entry for the batch operation
    await logAudit(
      'payout',
      'batch',
      'batch_process',
      userId,
      userName,
      { payoutIds },
      { processed, failed, skipped },
      { totalRequested: payoutIds.length, errors: errors.slice(0, 10) }
    );

    res.json({
      processed,
      failed,
      skipped,
      total: payoutIds.length,
      errors: errors.slice(0, 20), // Limit error list
      results,
    });
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'payout');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// ==================== PAYOUT CANCELLATION ====================

router.post("/payouts/:id/cancel", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = (req as any).user?.uid;
    const userName = await getAuditUserName(req);
    const { reason } = req.body;

    const payout = await storage.getPayout(param(req.params.id));
    if (!payout) {
      return res.status(404).json({ error: "Payout not found" });
    }

    // Only allow cancellation if not yet processing/completed
    const cancellableStatuses = ['pending', 'approved', 'pending_second_approval'];
    if (!cancellableStatuses.includes(payout.status)) {
      return res.status(400).json({
        error: `Payout cannot be cancelled in '${payout.status}' status. Only payouts with status: ${cancellableStatuses.join(', ')} can be cancelled.`,
        currentStatus: payout.status,
      });
    }

    const previousStatus = payout.status;

    // If the payout was approved, the balance may have been debited — refund it
    let balanceRefunded = false;
    if (payout.status === 'approved' && payout.recipientType === 'employee' && payout.recipientId) {
      try {
        // Check if a wallet debit was made for this payout
        const recipientWallet = await storage.getWalletByUserId(payout.recipientId, payout.currency);
        if (recipientWallet) {
          // Credit back the amount (reverse the debit)
          await storage.creditWallet(
            recipientWallet.id,
            parseFloat(payout.amount),
            'payout_cancellation_refund',
            `Refund for cancelled payout: ${payout.id}`,
            `CANCEL-${payout.id}`,
            { payoutId: payout.id, cancelledBy: userId }
          );
          balanceRefunded = true;
        }
      } catch (refundErr: any) {
        console.error(`Failed to refund balance for cancelled payout ${payout.id}:`, refundErr.message);
        // Continue with cancellation even if refund fails — log for manual review
      }
    }

    // Update payout status to cancelled
    const updatedPayout = await storage.updatePayout(payout.id, {
      status: 'cancelled',
      failureReason: reason || 'Cancelled by admin',
      metadata: {
        ...(payout.metadata ? JSON.parse(JSON.stringify(payout.metadata)) : {}),
        cancelledBy: userId,
        cancelledByName: userName,
        cancelledAt: new Date().toISOString(),
        cancellationReason: reason || 'No reason provided',
        balanceRefunded,
      } as any,
    });

    // Log audit trail
    await logAudit(
      'payout',
      payout.id,
      'cancelled',
      userId,
      userName,
      { status: previousStatus },
      { status: 'cancelled' },
      {
        reason: reason || 'No reason provided',
        amount: payout.amount,
        currency: payout.currency,
        balanceRefunded,
        recipientName: payout.recipientName,
      }
    );

    // Update related entity if applicable
    if (payout.relatedEntityType === 'expense' && payout.relatedEntityId) {
      await storage.updateExpense(payout.relatedEntityId, {
        payoutStatus: 'cancelled',
      });
    }

    res.json({
      success: true,
      payout: updatedPayout,
      balanceRefunded,
      message: `Payout ${payout.id} cancelled successfully.${balanceRefunded ? ' Balance has been refunded.' : ''}`,
    });
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'payout');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// ==================== PAYOUT REJECTION ====================

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
