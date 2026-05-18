import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  processPendingWalletCompensations,
  type WalletCompensationWorkerStorage,
} from "../../lib/wallet-compensation-worker";

// DEF-STG3-WALLET-WORKER — contract tests for the queue drain worker.
// The worker:
//   1. Atomically claims rows (one at a time, via FOR UPDATE SKIP LOCKED
//      in the real storage method — modeled here as sequential claim)
//   2. Calls creditWallet for each
//   3. On success → finalize('completed')
//   4. On creditWallet failure with attempts < max → finalize('pending')
//   5. On creditWallet failure with attempts >= max → finalize('manual_review')
//   6. On claim failure → exit the tick early
//   7. Bounded by maxRowsPerTick — never claims more than that per tick

interface FakeRow {
  id: string;
  walletId: string;
  amount: string;
  currency: string;
  originalReference: string;
  reason: string;
  failureKind: string;
  attempts: number;
  metadata: Record<string, unknown> | null;
}

function makeRow(overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    id: 'pwc-' + Math.random().toString(36).slice(2, 10),
    walletId: 'w-1',
    amount: '100.00',
    currency: 'NGN',
    originalReference: 'TRF-u1-1',
    reason: 'Test refund',
    failureKind: 'transfer_refund',
    attempts: 1, // claim already bumped from 0 → 1
    metadata: null,
    ...overrides,
  };
}

/**
 * Builds a fake storage that returns the given rows one at a time from
 * claimNextPendingWalletCompensation. Other methods are spies that
 * resolve by default and can be overridden.
 */
function makeFakeStorage(rows: FakeRow[], overrides: Partial<WalletCompensationWorkerStorage> = {}): WalletCompensationWorkerStorage {
  const queue = [...rows];
  return {
    claimNextPendingWalletCompensation: vi.fn(async () => queue.shift() ?? null),
    creditWallet: vi.fn(async () => undefined),
    finalizePendingWalletCompensation: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('processPendingWalletCompensations — empty queue', () => {
  it('returns all-zero counts and makes one claim call (to discover the queue is empty)', async () => {
    const storage = makeFakeStorage([]);
    const result = await processPendingWalletCompensations(storage);
    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0, movedToManualReview: 0 });
    expect(storage.claimNextPendingWalletCompensation).toHaveBeenCalledTimes(1);
    expect(storage.creditWallet).not.toHaveBeenCalled();
    expect(storage.finalizePendingWalletCompensation).not.toHaveBeenCalled();
  });
});

describe('processPendingWalletCompensations — happy path', () => {
  it('drains the queue, credit-backs each row, finalizes as completed', async () => {
    const rows = [makeRow({ id: 'a' }), makeRow({ id: 'b' }), makeRow({ id: 'c' })];
    const storage = makeFakeStorage(rows);

    const result = await processPendingWalletCompensations(storage);

    expect(result).toEqual({ processed: 3, succeeded: 3, failed: 0, movedToManualReview: 0 });
    expect(storage.creditWallet).toHaveBeenCalledTimes(3);
    expect(storage.finalizePendingWalletCompensation).toHaveBeenCalledTimes(3);
    expect(storage.finalizePendingWalletCompensation).toHaveBeenNthCalledWith(1, 'a', 'completed');
    expect(storage.finalizePendingWalletCompensation).toHaveBeenNthCalledWith(2, 'b', 'completed');
    expect(storage.finalizePendingWalletCompensation).toHaveBeenNthCalledWith(3, 'c', 'completed');
  });

  it('passes the canonical REFUND-{originalReference} as the credit-back reference', async () => {
    const row = makeRow({
      id: 'a',
      walletId: 'w-1',
      amount: '250.00',
      originalReference: 'TRF-u-7777',
      reason: 'Office rent',
      currency: 'NGN',
    });
    const storage = makeFakeStorage([row]);

    await processPendingWalletCompensations(storage);

    expect(storage.creditWallet).toHaveBeenCalledWith(
      'w-1',
      250,
      'transfer_refund',
      expect.stringContaining('Office rent'),
      'REFUND-TRF-u-7777',
      expect.objectContaining({
        workerRunOriginalReference: 'TRF-u-7777',
        attempts: 1,
      }),
    );
  });

  it('parses amount string → number for creditWallet (DB stores DECIMAL as string)', async () => {
    const storage = makeFakeStorage([makeRow({ amount: '1234.56' })]);
    await processPendingWalletCompensations(storage);
    expect(storage.creditWallet).toHaveBeenCalledWith(
      expect.any(String),
      1234.56,
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(Object),
    );
  });
});

describe('processPendingWalletCompensations — credit-back failures', () => {
  it('finalizes failed rows as pending (so the next tick retries) when attempts < max', async () => {
    const storage = makeFakeStorage(
      [makeRow({ id: 'a', attempts: 2 })], // < default max of 6
      { creditWallet: vi.fn().mockRejectedValue(new Error('DB blip')) },
    );

    const result = await processPendingWalletCompensations(storage);

    expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1, movedToManualReview: 0 });
    expect(storage.finalizePendingWalletCompensation).toHaveBeenCalledWith(
      'a',
      'pending',
      'DB blip',
    );
  });

  it('finalizes as manual_review when attempts >= max (terminal state)', async () => {
    const storage = makeFakeStorage(
      [makeRow({ id: 'a', attempts: 6 })], // == default max
      { creditWallet: vi.fn().mockRejectedValue(new Error('persistent failure')) },
    );

    const result = await processPendingWalletCompensations(storage);

    expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1, movedToManualReview: 1 });
    expect(storage.finalizePendingWalletCompensation).toHaveBeenCalledWith(
      'a',
      'manual_review',
      'persistent failure',
    );
  });

  it('respects a custom maxAttemptsPerRow override (e.g. for staging)', async () => {
    const storage = makeFakeStorage(
      [makeRow({ id: 'a', attempts: 3 })],
      { creditWallet: vi.fn().mockRejectedValue(new Error('boom')) },
    );

    const result = await processPendingWalletCompensations(storage, { maxAttemptsPerRow: 3 });

    expect(result.movedToManualReview).toBe(1);
    expect(storage.finalizePendingWalletCompensation).toHaveBeenCalledWith('a', 'manual_review', 'boom');
  });
});

describe('processPendingWalletCompensations — mixed batches', () => {
  it('counts succeeded/failed/manual_review separately across a heterogeneous tick', async () => {
    const rows = [
      makeRow({ id: 'a', attempts: 1 }), // success
      makeRow({ id: 'b', attempts: 2 }), // fail, retry (< max)
      makeRow({ id: 'c', attempts: 6 }), // fail, manual_review (== max)
      makeRow({ id: 'd', attempts: 1 }), // success
    ];
    const queue = [...rows];
    const creditCalls: string[] = [];
    const storage: WalletCompensationWorkerStorage = {
      claimNextPendingWalletCompensation: vi.fn(async () => queue.shift() ?? null),
      creditWallet: vi.fn(async (walletId, _amount, _type, description) => {
        creditCalls.push(`${walletId}:${description}`);
        // Fail rows b and c
        if (description.includes('Test refund') && (creditCalls.length === 2 || creditCalls.length === 3)) {
          throw new Error(`creditFail-${creditCalls.length}`);
        }
      }),
      finalizePendingWalletCompensation: vi.fn(),
    };

    const result = await processPendingWalletCompensations(storage);

    expect(result.processed).toBe(4);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(2);
    expect(result.movedToManualReview).toBe(1);
  });
});

describe('processPendingWalletCompensations — bounded by maxRowsPerTick', () => {
  it('processes at most maxRowsPerTick rows per call, regardless of queue depth', async () => {
    // 10 rows in the queue, cap at 3 per tick.
    const rows = Array.from({ length: 10 }, (_, i) => makeRow({ id: `r-${i}` }));
    const storage = makeFakeStorage(rows);

    const result = await processPendingWalletCompensations(storage, { maxRowsPerTick: 3 });

    expect(result.processed).toBe(3);
    expect(storage.claimNextPendingWalletCompensation).toHaveBeenCalledTimes(3);
    expect(storage.creditWallet).toHaveBeenCalledTimes(3);
  });

  it('exits early when claim returns null (queue drained) before hitting maxRowsPerTick', async () => {
    const storage = makeFakeStorage([makeRow({ id: 'a' }), makeRow({ id: 'b' })]);

    const result = await processPendingWalletCompensations(storage, { maxRowsPerTick: 10 });

    // Two real rows + one "drained" claim that returns null
    expect(storage.claimNextPendingWalletCompensation).toHaveBeenCalledTimes(3);
    expect(result.processed).toBe(2);
  });
});

describe('processPendingWalletCompensations — claim-side failure', () => {
  it('exits the tick early without throwing when claim throws (DB unavailable)', async () => {
    const storage = makeFakeStorage([], {
      claimNextPendingWalletCompensation: vi.fn().mockRejectedValue(new Error('connection refused')),
    });

    const result = await processPendingWalletCompensations(storage);

    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0, movedToManualReview: 0 });
    expect(storage.creditWallet).not.toHaveBeenCalled();
    expect(storage.finalizePendingWalletCompensation).not.toHaveBeenCalled();
  });

  it('exits with partial-processed counts when claim fails mid-tick', async () => {
    let calls = 0;
    const storage: WalletCompensationWorkerStorage = {
      claimNextPendingWalletCompensation: vi.fn(async () => {
        calls++;
        if (calls === 1) return makeRow({ id: 'a' });
        if (calls === 2) return makeRow({ id: 'b' });
        throw new Error('DB went away'); // 3rd claim fails
      }),
      creditWallet: vi.fn(),
      finalizePendingWalletCompensation: vi.fn(),
    };

    const result = await processPendingWalletCompensations(storage);

    expect(result.processed).toBe(2);
    expect(result.succeeded).toBe(2);
    // Worker exits cleanly instead of propagating the claim error.
  });
});

describe('processPendingWalletCompensations — finalize failure (worst case)', () => {
  it('logs but does not throw when finalize fails after a successful credit-back', async () => {
    const storage = makeFakeStorage([makeRow({ id: 'a' })], {
      finalizePendingWalletCompensation: vi.fn().mockRejectedValue(new Error('finalize-down')),
    });

    // creditWallet succeeded, but finalize failed → the worker should not
    // throw (otherwise one bad row breaks the whole tick). The row stays
    // in 'processing' state, but it'll be re-claimed next tick (storage's
    // claim filters by status='pending' only, so a stuck 'processing' row
    // is observable for ops — see DEFERRED.md for the cleanup tooling).
    const result = await processPendingWalletCompensations(storage);

    expect(result.processed).toBe(1);
    // credit-back call succeeded so succeeded is incremented even though
    // finalize threw — at-least-once delivery semantics.
    expect(result.succeeded).toBe(1);
  });

  it('logs but does not throw when finalize fails after a failed credit-back', async () => {
    const storage = makeFakeStorage([makeRow({ id: 'a', attempts: 2 })], {
      creditWallet: vi.fn().mockRejectedValue(new Error('credit-fail')),
      finalizePendingWalletCompensation: vi.fn().mockRejectedValue(new Error('finalize-down')),
    });

    const result = await processPendingWalletCompensations(storage);

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
    // Did not throw — caller sees the result counts and can decide.
  });
});

describe('processPendingWalletCompensations — defaults', () => {
  it('default maxRowsPerTick is 50 (bounded enough not to pin a connection for hours)', async () => {
    // 60 rows, no custom opts → only 50 processed
    const rows = Array.from({ length: 60 }, (_, i) => makeRow({ id: `r-${i}` }));
    const storage = makeFakeStorage(rows);
    const result = await processPendingWalletCompensations(storage);
    expect(result.processed).toBe(50);
  });

  it('default maxAttemptsPerRow is 6 (5 retries before manual_review)', async () => {
    // Row with attempts=6 should go to manual_review at default ceiling
    const storage = makeFakeStorage([makeRow({ attempts: 6 })], {
      creditWallet: vi.fn().mockRejectedValue(new Error('persistent')),
    });
    const result = await processPendingWalletCompensations(storage);
    expect(result.movedToManualReview).toBe(1);
  });
});
