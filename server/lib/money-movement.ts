/**
 * STG3-B (AUDIT_TRANSFERS_PAYOUTS_2026_05_17 §4.4 item 11) — MoneyMovement
 * service SKELETON.
 *
 * Audit recommendation:
 *   "One module that exposes process(intent: MoneyIntent) → MoneyOutcome.
 *    MoneyIntent is a discriminated union of WalletTransfer |
 *    PayoutDisbursement | BillPayment | ExpenseReimbursement |
 *    PayrollDisbursement. Internally orchestrates claim → debit →
 *    external → compensate with a single set of audit-log + idempotency
 *    conventions. All routes become thin wrappers that build the intent."
 *
 * Why a skeleton in this PR (not the full migration)
 *   The full effort is a 3-week quarter-scope refactor (per the audit's
 *   own estimate). Shipping the skeleton in one PR:
 *     - locks in the intent / outcome contract so future per-route
 *       migrations have something to target
 *     - exercises the discriminated-union shape under typecheck + tests
 *     - keeps routes unchanged, so production risk is zero
 *     - lets the team migrate routes one at a time (WalletTransfer first
 *       since it has the most hardening from Stage 2)
 *
 * What's implemented today
 *   - Full type contract (MoneyIntent, MoneyOutcome, MoneyMovementService)
 *   - createMoneyMovementService(deps) factory with WalletTransfer wired
 *     end-to-end through existing storage methods (claim → debit →
 *     external → compensate). Routes can opt-in by replacing their
 *     inline orchestration with a single service.process(intent) call.
 *   - PayoutDisbursement / BillPayment / ExpenseReimbursement /
 *     PayrollDisbursement intent types are recognized but throw
 *     `MoneyMovementNotImplementedError` so callers fail fast (and
 *     loudly) until those variants land.
 *
 * Future PRs (one per intent variant)
 *   - STG3-B-2: PayoutDisbursement → migrate /payouts/:id/release
 *   - STG3-B-3: BillPayment → migrate /bills/pay (closes TP-CRIT-01 root)
 *   - STG3-B-4: ExpenseReimbursement → migrate /expenses/:id/reimburse
 *   - STG3-B-5: PayrollDisbursement → migrate /payroll/run
 *
 * Kept in server/lib/ so the test suite can import without pulling in
 * storage + db modules; the live service is constructed in
 * server/paymentService.ts (or a routes-level factory) where storage
 * is already in scope.
 */

import { paymentLogger } from '../utils/paymentUtils';

// -------------------------------------------------------------------------
// Intent types — every money-moving operation must build one of these.
// -------------------------------------------------------------------------

export interface WalletTransferIntent {
  kind: 'wallet_transfer';
  /** The wallet being debited. */
  walletId: string;
  /** Cognito sub of the user initiating the transfer. */
  userId: string;
  /** Tenant the transfer happens under. */
  companyId?: string;
  /** Major-unit amount (e.g. 100.00 = 100 USD). */
  amount: number;
  /** ISO 4217 currency code. */
  currency: string;
  /** Destination country (drives provider routing — stripe vs paystack). */
  countryCode: string;
  /** Free-text reason; populates transactions.description. */
  reason: string;
  /** Server-issued reference used for idempotency and webhook reconciliation. */
  reference: string;
  /** Bank-account / recipient details handed to the provider. */
  recipientDetails: {
    accountNumber?: string;
    bankCode?: string;
    accountName?: string;
    [key: string]: unknown;
  };
}

export interface PayoutDisbursementIntent {
  kind: 'payout_disbursement';
  payoutId: string;
  companyId: string;
  amount: number;
  currency: string;
}

export interface BillPaymentIntent {
  kind: 'bill_payment';
  billId: string;
  /** Human-readable bill name; populates transactions.description on success. */
  billName: string;
  companyId?: string;
  paidByUserId: string;
  amount: number;
  currency: string;
  /** The wallet being debited. STG3-B-3 implements wallet path only — the
   *  company-balance fallback path stays inline until a separate intent
   *  shape covers it (see DEFERRED.md DEF-STG3-BILL-COMPANY-FALLBACK). */
  walletId: string;
  /**
   * Stable per-bill reference for both the wallet ledger row AND
   * downstream transactions.reference. MUST be derived from billId
   * (no Date.now() salt) so a retry of the same /bills/pay request
   * is rejected by the (wallet_id, reference) UNIQUE constraint and
   * the claim returns null. Pattern: `BILL-${billId}`.
   */
  reference: string;
}

export interface ExpenseReimbursementIntent {
  kind: 'expense_reimbursement';
  expenseId: string;
  companyId: string;
  beneficiaryUserId: string;
  amount: number;
  currency: string;
}

export interface PayrollDisbursementIntent {
  kind: 'payroll_disbursement';
  payrollRunId: string;
  companyId: string;
  beneficiaryUserId: string;
  amount: number;
  currency: string;
}

export type MoneyIntent =
  | WalletTransferIntent
  | PayoutDisbursementIntent
  | BillPaymentIntent
  | ExpenseReimbursementIntent
  | PayrollDisbursementIntent;

// -------------------------------------------------------------------------
// Outcome — the discriminated result every caller handles. Designed so a
// route can route directly off `kind` to an HTTP status (e.g. 'claim_lost'
// → 409, 'compensated' → 502, etc.) without unpacking the message.
// -------------------------------------------------------------------------

export type MoneyOutcome =
  | {
      kind: 'succeeded';
      reference: string;
      providerReference: string;
      /**
       * Raw provider result (eg. the Paystack transfer object, Stripe
       * Transfer / Payout). Optional — callers that only need the
       * canonical providerReference can ignore it. Routes that pass
       * provider-specific fields back to the client read this to preserve
       * response shape during the per-route MoneyMovement migration.
       */
      providerResult?: unknown;
    }
  | { kind: 'claim_lost'; reference: string; reason: 'duplicate' }
  | {
      kind: 'compensated';
      reference: string;
      providerError: string;
      compensation: 'in_line' | 'enqueued' | 'enqueue_failed';
    };

// -------------------------------------------------------------------------
// Errors — throw, don't return, when the caller did something the
// contract forbids (vs. the runtime hitting a transient failure, which
// is reported via MoneyOutcome).
// -------------------------------------------------------------------------

export class MoneyMovementNotImplementedError extends Error {
  constructor(public readonly intentKind: MoneyIntent['kind']) {
    super(
      `MoneyMovement.process for intent kind "${intentKind}" is not yet implemented. ` +
      `See server/lib/money-movement.ts header for the migration roadmap.`,
    );
    this.name = 'MoneyMovementNotImplementedError';
  }
}

// -------------------------------------------------------------------------
// Service contract — routes interact with this interface only. The
// concrete impl wires it to storage + paymentService; tests construct
// it with stub deps.
// -------------------------------------------------------------------------

export interface MoneyMovementService {
  process(intent: MoneyIntent): Promise<MoneyOutcome>;
}

/**
 * Minimal storage surface the service needs. Mirrors the actual storage
 * methods used today by /payment/transfer (PRs #45, #48, #51) — we
 * declare a slimmed interface here so tests can stub it without
 * implementing the full IStorage.
 */
export interface MoneyMovementStorage {
  debitWalletIdempotent(
    walletId: string,
    amount: number,
    type: string,
    description: string,
    reference: string,
    metadata?: Record<string, unknown>,
  ): Promise<unknown | null>;

  creditWallet(
    walletId: string,
    amount: number,
    type: string,
    description: string,
    reference: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;

  enqueuePendingWalletCompensation(input: {
    walletId: string;
    amount: number;
    currency: string;
    originalReference: string;
    reason: string;
    failureKind?: string;
    lastError?: string;
    metadata?: Record<string, unknown>;
  }): Promise<boolean>;

  // STG3-B-3 — used by bill_payment intent to mark the bill as paid
  // after the wallet debit succeeds. Returning undefined is fine; the
  // service only cares whether it threw.
  updateBill(
    id: string,
    data: { status: string; [key: string]: unknown },
  ): Promise<unknown>;
}

/**
 * Minimal provider surface — just the entrypoint the WalletTransfer
 * path needs. Real call site uses paymentService.initiateTransfer; the
 * stub in tests can throw synthetic transient / permanent errors.
 */
export interface MoneyMovementProvider {
  initiateTransfer(
    amount: number,
    recipientDetails: Record<string, unknown>,
    countryCode: string,
    reason: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ reference?: string; transferId?: string }>;
}

// -------------------------------------------------------------------------
// Factory — wire the dependencies into a live service. Routes call this
// once at boot and then thread the service through into handlers.
// -------------------------------------------------------------------------

export function createMoneyMovementService(deps: {
  storage: MoneyMovementStorage;
  provider: MoneyMovementProvider;
}): MoneyMovementService {
  return {
    async process(intent: MoneyIntent): Promise<MoneyOutcome> {
      switch (intent.kind) {
        case 'wallet_transfer':
          return processWalletTransfer(deps, intent);
        case 'bill_payment':
          return processBillPayment(deps, intent);
        case 'payout_disbursement':
        case 'expense_reimbursement':
        case 'payroll_disbursement':
          // Skeleton: these intent kinds are recognized at the type
          // level but their orchestration hasn't been extracted from
          // the routes yet. See the file header for the migration
          // roadmap (one PR per intent kind).
          throw new MoneyMovementNotImplementedError(intent.kind);
        default: {
          // Exhaustiveness check — if a future intent kind is added to
          // the union and this switch isn't updated, TS errors here.
          const _exhaustive: never = intent;
          void _exhaustive;
          throw new Error(`Unknown MoneyIntent kind: ${(intent as MoneyIntent).kind}`);
        }
      }
    },
  };
}

// -------------------------------------------------------------------------
// WalletTransfer orchestration — the only intent the skeleton implements.
// Mirrors POST /payment/transfer's logic post-Stage-2:
//   1. atomic debit via claim pattern (TP-CRIT-04, PR #48)
//   2. provider call (no retry wrapping here — that's a paymentService
//      concern; this layer assumes the provider client already wraps
//      withProviderRetry)
//   3. on provider failure: in-line creditWallet refund, then enqueue
//      to pending_wallet_compensations if that also fails (TP-HIGH-07,
//      PR #51)
// -------------------------------------------------------------------------

async function processWalletTransfer(
  deps: { storage: MoneyMovementStorage; provider: MoneyMovementProvider },
  intent: WalletTransferIntent,
): Promise<MoneyOutcome> {
  // 1. Claim the debit. Returns null if (walletId, reference) is already
  // claimed by another in-flight request (TP-CRIT-04).
  const debitResult = await deps.storage.debitWalletIdempotent(
    intent.walletId,
    intent.amount,
    'transfer_out',
    `Transfer: ${intent.reason}`,
    intent.reference,
    {
      recipientName: intent.recipientDetails.accountName,
      countryCode: intent.countryCode,
    },
  );
  if (debitResult === null) {
    return { kind: 'claim_lost', reference: intent.reference, reason: 'duplicate' };
  }

  // 2. Provider call.
  let transferResult: { reference?: string; transferId?: string };
  try {
    transferResult = await deps.provider.initiateTransfer(
      intent.amount,
      intent.recipientDetails as Record<string, unknown>,
      intent.countryCode,
      intent.reason,
      {
        payoutId: intent.reference,
        companyId: intent.companyId,
        userId: intent.userId,
      },
    );
  } catch (transferError: any) {
    // 3. Provider failed. Try in-line compensate first.
    try {
      await deps.storage.creditWallet(
        intent.walletId,
        intent.amount,
        'transfer_refund',
        `Refund: transfer failed - ${intent.reason}`,
        `REFUND-${intent.reference}`,
        { reason: transferError.message },
      );
      return {
        kind: 'compensated',
        reference: intent.reference,
        providerError: transferError.message,
        compensation: 'in_line',
      };
    } catch (creditError: any) {
      // 4. In-line compensate failed. Enqueue durable compensation.
      try {
        await deps.storage.enqueuePendingWalletCompensation({
          walletId: intent.walletId,
          amount: intent.amount,
          currency: intent.currency,
          originalReference: intent.reference,
          reason: intent.reason,
          failureKind: 'transfer_refund',
          lastError: `creditWallet failed during transfer-error rollback: ${creditError.message}`,
          metadata: {
            transferError: transferError.message,
            userId: intent.userId,
            recipientName: intent.recipientDetails.accountName,
            countryCode: intent.countryCode,
          },
        });
        paymentLogger.error('wallet_compensation_enqueued', {
          walletId: intent.walletId,
          amount: intent.amount,
          currency: intent.currency,
          originalReference: intent.reference,
          transferError: transferError.message,
          creditError: creditError.message,
        });
        return {
          kind: 'compensated',
          reference: intent.reference,
          providerError: transferError.message,
          compensation: 'enqueued',
        };
      } catch (enqueueError: any) {
        paymentLogger.error('wallet_compensation_enqueue_failed', {
          walletId: intent.walletId,
          amount: intent.amount,
          currency: intent.currency,
          originalReference: intent.reference,
          transferError: transferError.message,
          creditError: creditError.message,
          enqueueError: enqueueError.message,
        });
        return {
          kind: 'compensated',
          reference: intent.reference,
          providerError: transferError.message,
          compensation: 'enqueue_failed',
        };
      }
    }
  }

  const providerReference =
    transferResult.reference || transferResult.transferId || intent.reference;
  return {
    kind: 'succeeded',
    reference: intent.reference,
    providerReference,
    providerResult: transferResult,
  };
}

// -------------------------------------------------------------------------
// BillPayment orchestration (STG3-B-3) — wallet path only.
//
// Shape is similar to wallet_transfer but the "effect" step is an
// internal DB write (mark bill paid) rather than an external provider
// call. The compensation contract mirrors wallet_transfer:
//   1. claim debit via debitWalletIdempotent (TP-CRIT-04 pattern;
//      stable per-bill reference means a retried /bills/pay returns
//      claim_lost instead of double-debiting)
//   2. mark bill status='paid' via storage.updateBill
//   3. on (2) failure → in-line creditWallet refund, then enqueue durable
//      compensation if that also fails (TP-HIGH-07 pattern)
//
// What this intent does NOT cover (and intentionally so):
//   - company-balance fallback path (when user has no personal wallet) —
//     uses companyBalances UPDATE rather than wallet-ledger insert; the
//     compensation queue is wallet-scoped so this would need either a
//     parallel company-compensations queue or a different intent shape.
//     Tracked in DEFERRED.md as DEF-STG3-BILL-COMPANY-FALLBACK.
//   - external-charge path (paymentMethod !== 'wallet') — that creates
//     a PaymentIntent for the user to pay, which is a CHARGE not a
//     transfer. Different domain; MoneyMovement is the
//     wallet/payout abstraction.
// -------------------------------------------------------------------------

async function processBillPayment(
  deps: { storage: MoneyMovementStorage; provider: MoneyMovementProvider },
  intent: BillPaymentIntent,
): Promise<MoneyOutcome> {
  // 1. Claim debit. Stable reference (`BILL-${billId}`) is the per-bill
  // idempotency key — combined with the UNIQUE index on
  // (wallet_id, reference) the second call returns null instead of
  // producing a duplicate debit.
  const debitResult = await deps.storage.debitWalletIdempotent(
    intent.walletId,
    intent.amount,
    'bill_payment',
    `Bill payment - ${intent.billName}`,
    intent.reference,
    { billId: intent.billId },
  );
  if (debitResult === null) {
    return { kind: 'claim_lost', reference: intent.reference, reason: 'duplicate' };
  }

  // 2. Effect: mark bill as paid. If this throws, we need to credit-back
  // (otherwise the wallet is debited but the bill is still unpaid).
  try {
    await deps.storage.updateBill(intent.billId, { status: 'paid' });
  } catch (markPaidError: any) {
    // Mirror wallet_transfer's two-tier compensation.
    try {
      await deps.storage.creditWallet(
        intent.walletId,
        intent.amount,
        'transfer_refund',
        `Refund: bill payment update failed - ${intent.billName}`,
        `REFUND-${intent.reference}`,
        { reason: markPaidError.message, billId: intent.billId },
      );
      return {
        kind: 'compensated',
        reference: intent.reference,
        providerError: markPaidError.message,
        compensation: 'in_line',
      };
    } catch (creditError: any) {
      try {
        await deps.storage.enqueuePendingWalletCompensation({
          walletId: intent.walletId,
          amount: intent.amount,
          currency: intent.currency,
          originalReference: intent.reference,
          reason: `Bill payment ${intent.billId} failed mid-process`,
          failureKind: 'bill_payment_refund',
          lastError: `creditWallet failed during bill-payment rollback: ${creditError.message}`,
          metadata: {
            billId: intent.billId,
            markPaidError: markPaidError.message,
            paidByUserId: intent.paidByUserId,
          },
        });
        paymentLogger.error('wallet_compensation_enqueued', {
          walletId: intent.walletId,
          amount: intent.amount,
          currency: intent.currency,
          originalReference: intent.reference,
          markPaidError: markPaidError.message,
          creditError: creditError.message,
          intentKind: 'bill_payment',
        });
        return {
          kind: 'compensated',
          reference: intent.reference,
          providerError: markPaidError.message,
          compensation: 'enqueued',
        };
      } catch (enqueueError: any) {
        paymentLogger.error('wallet_compensation_enqueue_failed', {
          walletId: intent.walletId,
          amount: intent.amount,
          currency: intent.currency,
          originalReference: intent.reference,
          markPaidError: markPaidError.message,
          creditError: creditError.message,
          enqueueError: enqueueError.message,
          intentKind: 'bill_payment',
        });
        return {
          kind: 'compensated',
          reference: intent.reference,
          providerError: markPaidError.message,
          compensation: 'enqueue_failed',
        };
      }
    }
  }

  // Success — no provider reference (bill payment is internal). Use the
  // intent.reference as both the canonical reference and the placeholder
  // "providerReference" so callers that read providerReference still get
  // a meaningful id.
  return {
    kind: 'succeeded',
    reference: intent.reference,
    providerReference: intent.reference,
    providerResult: { billId: intent.billId, billName: intent.billName },
  };
}
