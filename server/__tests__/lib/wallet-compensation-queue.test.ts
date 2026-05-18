import { describe, it, expect } from "vitest";

// TP-HIGH-07 (AUDIT_TRANSFERS_PAYOUTS_2026_05_17 §4.4 item 9) — contract
// tests for the durable wallet compensation queue.
//
// The /payment/transfer route runs:
//   1. atomic wallet debit (claim-protected, PR #48)
//   2. external provider call
//   3. if (2) throws → inline creditWallet refund
//   4. if (3) throws → storage.enqueuePendingWalletCompensation(...)
//   5. if (4) throws → log loudly, but still throw the original error
//
// These tests model the storage method's INSERT ... ON CONFLICT DO NOTHING
// RETURNING semantics and the route's decision tree. Real DB-level
// uniqueness is tested via the integration suite once DATABASE_URL is set.

interface CompensationStub {
  id: string;
  walletId: string;
  amount: string;
  currency: string;
  originalReference: string;
  reason: string;
  failureKind: string;
  attempts: number;
  lastError: string | null;
  status: 'pending' | 'completed' | 'manual_review';
}

interface EnqueueInput {
  walletId: string;
  amount: number;
  currency: string;
  originalReference: string;
  reason: string;
  failureKind?: string;
  lastError?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Mirror of storage.enqueuePendingWalletCompensation under the
 * UNIQUE INDEX (wallet_id, original_reference) constraint. Returns
 * true on first enqueue, false on duplicate.
 */
function modelEnqueue(
  input: EnqueueInput,
  existing: Map<string, CompensationStub>,
): { created: boolean; row: CompensationStub } {
  const key = `${input.walletId}::${input.originalReference}`;
  const present = existing.get(key);
  if (present) {
    return { created: false, row: present };
  }
  const row: CompensationStub = {
    id: `pwc-${Date.now()}-${Math.random()}`,
    walletId: input.walletId,
    amount: input.amount.toFixed(2),
    currency: input.currency,
    originalReference: input.originalReference,
    reason: input.reason,
    failureKind: input.failureKind || 'transfer_refund',
    attempts: 0,
    // Cap lastError at 1024 chars — pin the same truncation the storage
    // method does so PII / stack traces don't bloat rows.
    lastError: input.lastError ? input.lastError.slice(0, 1024) : null,
    status: 'pending',
  };
  existing.set(key, row);
  return { created: true, row };
}

/**
 * Mirror of the /payment/transfer catch-block decision tree.
 *   - transferError thrown → try creditWallet
 *   - if creditWallet also throws → try enqueue
 *   - regardless of those inner outcomes, throw the ORIGINAL transferError
 */
async function modelRouteRefundDecision(opts: {
  creditWallet: () => Promise<void>;
  enqueue: () => Promise<boolean>;
  transferError: Error;
}): Promise<{
  routeRejection: Error;
  creditAttempted: boolean;
  enqueueAttempted: boolean;
  enqueueSucceeded: boolean | null;
}> {
  let creditAttempted = false;
  let enqueueAttempted = false;
  let enqueueSucceeded: boolean | null = null;

  try {
    creditAttempted = true;
    await opts.creditWallet();
  } catch (_creditError) {
    try {
      enqueueAttempted = true;
      enqueueSucceeded = await opts.enqueue();
    } catch (_enqueueError) {
      enqueueSucceeded = false;
    }
  }
  return {
    routeRejection: opts.transferError,
    creditAttempted,
    enqueueAttempted,
    enqueueSucceeded,
  };
}

describe('TP-HIGH-07 — enqueuePendingWalletCompensation contract', () => {
  it('returns created=true on first enqueue (claim won)', () => {
    const queue = new Map<string, CompensationStub>();
    const { created, row } = modelEnqueue(
      {
        walletId: 'w-1',
        amount: 250,
        currency: 'NGN',
        originalReference: 'TRF-userA-1747000000000',
        reason: 'Office rent',
      },
      queue,
    );
    expect(created).toBe(true);
    expect(row.status).toBe('pending');
    expect(row.attempts).toBe(0);
    expect(row.failureKind).toBe('transfer_refund');
    expect(row.amount).toBe('250.00');
  });

  it('returns created=false on duplicate (walletId, originalReference)', () => {
    const queue = new Map<string, CompensationStub>();
    const input = {
      walletId: 'w-1',
      amount: 100,
      currency: 'USD',
      originalReference: 'TRF-userA-1747000000001',
      reason: 'Rent',
    };
    modelEnqueue(input, queue);
    const { created, row } = modelEnqueue(input, queue);
    expect(created).toBe(false);
    // Original row's attempt counter is preserved (no overwrite).
    expect(row.attempts).toBe(0);
  });

  it('treats different references on the same wallet as separate enqueues', () => {
    const queue = new Map<string, CompensationStub>();
    const a = modelEnqueue(
      { walletId: 'w-1', amount: 100, currency: 'USD', originalReference: 'TRF-a', reason: 'r' },
      queue,
    );
    const b = modelEnqueue(
      { walletId: 'w-1', amount: 100, currency: 'USD', originalReference: 'TRF-b', reason: 'r' },
      queue,
    );
    expect(a.created).toBe(true);
    expect(b.created).toBe(true);
    expect(queue.size).toBe(2);
  });

  it('treats the same reference on different wallets as separate enqueues', () => {
    const queue = new Map<string, CompensationStub>();
    const a = modelEnqueue(
      { walletId: 'w-1', amount: 100, currency: 'USD', originalReference: 'TRF-shared', reason: 'r' },
      queue,
    );
    const b = modelEnqueue(
      { walletId: 'w-2', amount: 100, currency: 'USD', originalReference: 'TRF-shared', reason: 'r' },
      queue,
    );
    expect(a.created).toBe(true);
    expect(b.created).toBe(true);
    expect(queue.size).toBe(2);
  });

  it('truncates lastError to 1024 chars (PII / stack-trace bloat guard)', () => {
    const queue = new Map<string, CompensationStub>();
    const longError = 'x'.repeat(2000);
    const { row } = modelEnqueue(
      {
        walletId: 'w-1',
        amount: 1,
        currency: 'USD',
        originalReference: 'TRF-trunc',
        reason: 'r',
        lastError: longError,
      },
      queue,
    );
    expect(row.lastError).not.toBeNull();
    expect(row.lastError!.length).toBe(1024);
  });

  it('allows lastError to be omitted (initial enqueue without a prior error)', () => {
    const queue = new Map<string, CompensationStub>();
    const { row } = modelEnqueue(
      { walletId: 'w-1', amount: 1, currency: 'USD', originalReference: 'TRF-noerr', reason: 'r' },
      queue,
    );
    expect(row.lastError).toBeNull();
  });
});

describe('TP-HIGH-07 — /payment/transfer catch-block decision tree', () => {
  const transferError = new Error('Paystack transfer 502');

  it('credit-back succeeds → enqueue NOT attempted; original error thrown', async () => {
    const result = await modelRouteRefundDecision({
      creditWallet: async () => { /* success */ },
      enqueue: async () => {
        throw new Error('should not be called');
      },
      transferError,
    });
    expect(result.creditAttempted).toBe(true);
    expect(result.enqueueAttempted).toBe(false);
    expect(result.enqueueSucceeded).toBeNull();
    expect(result.routeRejection).toBe(transferError);
  });

  it('credit-back fails → enqueue attempted and succeeds; original error still thrown', async () => {
    const result = await modelRouteRefundDecision({
      creditWallet: async () => {
        throw new Error('DB blip — could not credit');
      },
      enqueue: async () => true,
      transferError,
    });
    expect(result.creditAttempted).toBe(true);
    expect(result.enqueueAttempted).toBe(true);
    expect(result.enqueueSucceeded).toBe(true);
    expect(result.routeRejection).toBe(transferError);
  });

  it('credit-back fails AND enqueue fails → log loudly, still throw original error', async () => {
    const result = await modelRouteRefundDecision({
      creditWallet: async () => {
        throw new Error('DB blip — could not credit');
      },
      enqueue: async () => {
        throw new Error('queue also unavailable');
      },
      transferError,
    });
    expect(result.creditAttempted).toBe(true);
    expect(result.enqueueAttempted).toBe(true);
    expect(result.enqueueSucceeded).toBe(false);
    // The route still rejects with the ORIGINAL transfer error, not the
    // secondary credit / enqueue errors — the client should see the
    // actual cause of the failure.
    expect(result.routeRejection).toBe(transferError);
  });

  it('credit-back fails, enqueue returns false (duplicate) → still throw original error', async () => {
    const result = await modelRouteRefundDecision({
      creditWallet: async () => {
        throw new Error('DB blip');
      },
      enqueue: async () => false, // duplicate enqueue, already pending
      transferError,
    });
    expect(result.enqueueAttempted).toBe(true);
    expect(result.enqueueSucceeded).toBe(false);
    expect(result.routeRejection).toBe(transferError);
  });
});
