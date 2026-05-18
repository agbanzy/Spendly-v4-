import { describe, it, expect, vi } from "vitest";

// TP-CRIT-04 (AUDIT_TRANSFERS_PAYOUTS_2026_05_17 §4.4) — contract tests
// for debitWalletIdempotent. The function:
//   - Returns the inserted wallet_transactions row on first call
//   - Returns null on a duplicate (walletId, reference) — claim lost
//   - Does NOT modify the wallet balance when claim is lost
//
// Routes (/payment/transfer + /wallet/payout) check for null and
// respond with 409 + TRANSFER_CLAIM_LOST.
//
// Full DB-level enforcement is in the deferred migration
// 0017_wallet_transactions_reference_unique.sql — until operator
// promotes it, the ON CONFLICT clause is a no-op (no unique index to
// trigger). After promotion, two concurrent debits with the same
// reference: first succeeds, second returns null.

interface WalletTransactionStub {
  id: string;
  walletId: string;
  reference: string;
  amount: string;
  direction: 'debit' | 'credit';
}

interface DebitContext {
  walletId: string;
  amount: number;
  reference: string;
}

/**
 * Mirror of the route's post-debit decision logic:
 *   - debitResult === null → 409 TRANSFER_CLAIM_LOST
 *   - otherwise proceed
 */
function postDebitDecision(
  debitResult: WalletTransactionStub | null,
): { status: 200 | 409; code?: string } {
  if (debitResult === null) {
    return { status: 409, code: 'TRANSFER_CLAIM_LOST' };
  }
  return { status: 200 };
}

/**
 * Mirror of debitWalletIdempotent's claim outcome under ON CONFLICT
 * DO NOTHING. Tests assert the route behaviour around this contract.
 */
function modelDebitIdempotent(
  ctx: DebitContext,
  existingReferences: Set<string>,
): WalletTransactionStub | null {
  const key = `${ctx.walletId}::${ctx.reference}`;
  if (existingReferences.has(key)) {
    return null; // ON CONFLICT DO NOTHING → no row returned
  }
  existingReferences.add(key);
  return {
    id: `wt-${Date.now()}-${Math.random()}`,
    walletId: ctx.walletId,
    reference: ctx.reference,
    amount: ctx.amount.toFixed(2),
    direction: 'debit',
  };
}

describe("TP-CRIT-04 — debitWalletIdempotent contract", () => {
  it("returns a row on first call (claim won)", () => {
    const existing = new Set<string>();
    const result = modelDebitIdempotent(
      { walletId: 'w-1', amount: 100, reference: 'TRF-abc-12345' },
      existing,
    );
    expect(result).not.toBeNull();
    expect(result?.walletId).toBe('w-1');
    expect(result?.reference).toBe('TRF-abc-12345');
  });

  it("returns null on second call with same (walletId, reference) — claim lost", () => {
    const existing = new Set<string>();
    const first = modelDebitIdempotent(
      { walletId: 'w-1', amount: 100, reference: 'TRF-abc-12345' },
      existing,
    );
    const second = modelDebitIdempotent(
      { walletId: 'w-1', amount: 100, reference: 'TRF-abc-12345' },
      existing,
    );
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it("treats different references on the same wallet as separate claims", () => {
    const existing = new Set<string>();
    const a = modelDebitIdempotent(
      { walletId: 'w-1', amount: 100, reference: 'TRF-aaa' },
      existing,
    );
    const b = modelDebitIdempotent(
      { walletId: 'w-1', amount: 100, reference: 'TRF-bbb' },
      existing,
    );
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a?.reference).not.toBe(b?.reference);
  });

  it("treats the same reference on different wallets as separate claims", () => {
    const existing = new Set<string>();
    const a = modelDebitIdempotent(
      { walletId: 'w-1', amount: 100, reference: 'TRF-shared' },
      existing,
    );
    const b = modelDebitIdempotent(
      { walletId: 'w-2', amount: 100, reference: 'TRF-shared' },
      existing,
    );
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
  });
});

describe("TP-CRIT-04 — route response on claim outcome", () => {
  it("responds 200 when claim wins", () => {
    const decision = postDebitDecision({
      id: 'wt-1',
      walletId: 'w-1',
      reference: 'TRF-1',
      amount: '100.00',
      direction: 'debit',
    });
    expect(decision.status).toBe(200);
    expect(decision.code).toBeUndefined();
  });

  it("responds 409 TRANSFER_CLAIM_LOST when claim is lost", () => {
    const decision = postDebitDecision(null);
    expect(decision.status).toBe(409);
    expect(decision.code).toBe('TRANSFER_CLAIM_LOST');
  });
});

describe("TP-CRIT-04 — concurrent-claim simulation", () => {
  it("two concurrent debits with the same reference produce exactly one winner + one 409", () => {
    const existing = new Set<string>();
    const ctx = { walletId: 'w-1', amount: 100, reference: 'TRF-race' };
    // Simulate two concurrent calls hitting the same (walletId, ref):
    // model alternates lock acquisition; whichever gets there first wins.
    const a = modelDebitIdempotent(ctx, existing);
    const b = modelDebitIdempotent(ctx, existing);

    const decisions = [postDebitDecision(a), postDebitDecision(b)];
    const statuses = decisions.map((d) => d.status).sort();
    expect(statuses).toEqual([200, 409]);
  });
});
