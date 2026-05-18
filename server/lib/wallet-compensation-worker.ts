/**
 * DEF-STG3-WALLET-WORKER (AUDIT_TRANSFERS_PAYOUTS_2026_05_17 §6 Stage 2,
 * closes the loop on TP-HIGH-07) — drain the pending_wallet_compensations
 * queue.
 *
 * Background:
 *   PR #51 added a durable queue for wallet credit-backs that couldn't
 *   apply in-line (DB blip mid-route, lock contention, etc.). Without
 *   a worker the queue grows forever and ops has to manually credit
 *   each affected wallet. This module is the drain.
 *
 * Design choices:
 *   - **Per-row atomic claim** via storage.claimNextPendingWalletCompensation
 *     which uses FOR UPDATE SKIP LOCKED. Two worker instances on different
 *     ECS tasks can run in parallel without double-processing — no
 *     leader-election needed at the current queue size.
 *   - **Exponential backoff via attempt cap, NOT delay.** Each call
 *     attempts every claimable row once. The cron schedule is the
 *     "delay between attempts". This keeps the worker stateless and
 *     simple; the trade-off is the retry granularity equals the cron
 *     interval (currently 5 min — see recurringScheduler.ts integration
 *     in a follow-up PR).
 *   - **Bounded work per tick** via maxRowsPerTick. Prevents one bad
 *     batch from holding the worker for hours and pinning DB
 *     connections. Default 50 — at 5-min ticks that's 14,400 rows/day
 *     of capacity, comfortable for the current scale.
 *
 * Future work (out of scope for this PR — flagged in DEFERRED.md):
 *   - Wire into recurringScheduler.ts as a separate cron entry.
 *   - Admin endpoint GET /api/admin/wallet-compensations for the queue
 *     view (status, attempts, lastError) so ops can spot stuck rows.
 *   - Real leader election once the queue scales past the per-row
 *     FOR UPDATE SKIP LOCKED comfort zone (~10k rows in flight).
 */

import { paymentLogger } from '../utils/paymentUtils';

/** Storage surface the worker needs — slimmed for testability. */
export interface WalletCompensationWorkerStorage {
  claimNextPendingWalletCompensation(maxAttempts: number): Promise<{
    id: string;
    walletId: string;
    amount: string;
    currency: string;
    originalReference: string;
    reason: string;
    failureKind: string;
    attempts: number;
    metadata: Record<string, unknown> | null;
  } | null>;

  creditWallet(
    walletId: string,
    amount: number,
    type: string,
    description: string,
    reference: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;

  finalizePendingWalletCompensation(
    id: string,
    outcome: 'completed' | 'pending' | 'manual_review',
    lastError?: string,
  ): Promise<void>;
}

export interface WorkerTickResult {
  processed: number;
  succeeded: number;
  failed: number;
  movedToManualReview: number;
}

export interface WorkerTickOptions {
  /** Stop ceiling — never claim more rows than this per tick. Default 50. */
  maxRowsPerTick?: number;
  /** Per-row attempt ceiling — at this count the row moves to manual_review. Default 6. */
  maxAttemptsPerRow?: number;
}

/**
 * Drain the queue once. Returns counts so the caller (cron, admin
 * endpoint, integration test) can log/assert. Never throws — every
 * row-level failure is captured into the row's last_error column;
 * a system-level failure (e.g. DB unavailable) is logged + counted
 * and the tick exits early.
 */
export async function processPendingWalletCompensations(
  storage: WalletCompensationWorkerStorage,
  opts: WorkerTickOptions = {},
): Promise<WorkerTickResult> {
  const maxRowsPerTick = opts.maxRowsPerTick ?? 50;
  const maxAttemptsPerRow = opts.maxAttemptsPerRow ?? 6;

  const result: WorkerTickResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    movedToManualReview: 0,
  };

  paymentLogger.info('wallet_compensation_worker_tick_start', {
    maxRowsPerTick,
    maxAttemptsPerRow,
  });

  for (let i = 0; i < maxRowsPerTick; i++) {
    let row: Awaited<ReturnType<typeof storage.claimNextPendingWalletCompensation>>;
    try {
      row = await storage.claimNextPendingWalletCompensation(maxAttemptsPerRow);
    } catch (claimError: any) {
      // DB-level failure during claim — exit the tick. Next cron fires
      // we'll try again from a fresh connection.
      paymentLogger.error('wallet_compensation_worker_claim_failed', {
        error: claimError.message,
        processedBeforeFailure: result.processed,
      });
      return result;
    }

    if (!row) {
      // Queue drained for this tick.
      break;
    }

    result.processed++;
    const amountMajor = parseFloat(row.amount);

    // Two-phase try blocks so a finalize-after-success-credit failure
    // (the credit succeeded, the row-status update failed) is counted
    // as succeeded — the money DID get credited back — while still
    // surfacing the finalize failure in logs for ops to clean up the
    // stuck 'processing' row.

    let creditSucceeded = false;
    let creditError: any = null;
    try {
      // The credit-back uses REFUND-{originalReference} as the wallet_transactions
      // reference. Combined with PR #48's UNIQUE index on (wallet_id, reference)
      // (when promoted from migrations-deferred/0017_*), a retry that lands after
      // a partial-success cannot produce a duplicate ledger row — the unique
      // index rejects it and creditWallet throws, which we then handle below.
      await storage.creditWallet(
        row.walletId,
        amountMajor,
        'transfer_refund',
        `Worker compensation: ${row.reason}`,
        `REFUND-${row.originalReference}`,
        {
          workerRunOriginalReference: row.originalReference,
          attempts: row.attempts,
          ...((row.metadata as Record<string, unknown> | null) ?? {}),
        },
      );
      creditSucceeded = true;
    } catch (err: any) {
      creditError = err;
    }

    if (creditSucceeded) {
      // Phase 2: finalize as completed. If THIS fails, the money is
      // already back in the wallet — count as succeeded, log loudly so
      // ops can manually move the stuck 'processing' row to 'completed'
      // (or accept it being re-credited if the unique-index is enforced).
      try {
        await storage.finalizePendingWalletCompensation(row.id, 'completed');
      } catch (finalizeError: any) {
        paymentLogger.error('wallet_compensation_worker_finalize_after_success_failed', {
          id: row.id,
          walletId: row.walletId,
          originalReference: row.originalReference,
          finalizeError: finalizeError.message ?? String(finalizeError),
        });
      }
      result.succeeded++;
      paymentLogger.info('wallet_compensation_worker_row_completed', {
        id: row.id,
        walletId: row.walletId,
        amount: amountMajor,
        currency: row.currency,
        originalReference: row.originalReference,
        attempts: row.attempts,
      });
      continue;
    }

    // Phase 2 (credit failure path): finalize as pending or manual_review.
    result.failed++;
    const isFinal = row.attempts >= maxAttemptsPerRow;
    const outcome = isFinal ? 'manual_review' : 'pending';
    if (isFinal) result.movedToManualReview++;

    try {
      await storage.finalizePendingWalletCompensation(
        row.id,
        outcome,
        creditError?.message ?? String(creditError),
      );
    } catch (finalizeError: any) {
      paymentLogger.error('wallet_compensation_worker_finalize_failed', {
        id: row.id,
        walletId: row.walletId,
        originalReference: row.originalReference,
        creditError: creditError?.message ?? String(creditError),
        finalizeError: finalizeError.message ?? String(finalizeError),
      });
    }

    paymentLogger.warn('wallet_compensation_worker_row_failed', {
      id: row.id,
      walletId: row.walletId,
      amount: amountMajor,
      currency: row.currency,
      originalReference: row.originalReference,
      attempts: row.attempts,
      outcome,
      error: creditError?.message ?? String(creditError),
    });
  }

  paymentLogger.info('wallet_compensation_worker_tick_done', result);
  return result;
}
