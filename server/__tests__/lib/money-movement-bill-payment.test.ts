import { describe, it, expect, vi } from "vitest";
import {
  createMoneyMovementService,
  type BillPaymentIntent,
  type MoneyMovementProvider,
  type MoneyMovementStorage,
} from "../../lib/money-movement";

// STG3-B-3 — contract tests for the bill_payment intent. Shape mirrors
// wallet_transfer (claim → effect → compensate) but the "effect" is
// an internal storage.updateBill(status='paid') call instead of an
// external provider transfer.

function makeStubStorage(overrides?: Partial<MoneyMovementStorage>): MoneyMovementStorage {
  return {
    debitWalletIdempotent: vi.fn().mockResolvedValue({ id: 'wt-1' }),
    creditWallet: vi.fn().mockResolvedValue(undefined),
    enqueuePendingWalletCompensation: vi.fn().mockResolvedValue(true),
    updateBill: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const stubProvider: MoneyMovementProvider = {
  initiateTransfer: vi.fn(),
};

const baseIntent: BillPaymentIntent = {
  kind: 'bill_payment',
  billId: 'bill-1',
  billName: 'Electricity — May 2026',
  companyId: 'co-1',
  paidByUserId: 'u-1',
  amount: 50,
  currency: 'NGN',
  walletId: 'w-1',
  reference: 'BILL-bill-1',
};

describe('STG3-B-3 — bill_payment happy path', () => {
  it('claims debit, marks bill paid, returns succeeded with the intent reference', async () => {
    const storage = makeStubStorage();
    const svc = createMoneyMovementService({ storage, provider: stubProvider });

    const outcome = await svc.process(baseIntent);

    expect(outcome.kind).toBe('succeeded');
    if (outcome.kind === 'succeeded') {
      expect(outcome.reference).toBe('BILL-bill-1');
      // No external provider — providerReference echoes the canonical ref.
      expect(outcome.providerReference).toBe('BILL-bill-1');
    }
    expect(storage.debitWalletIdempotent).toHaveBeenCalledTimes(1);
    expect(storage.updateBill).toHaveBeenCalledTimes(1);
    expect(storage.updateBill).toHaveBeenCalledWith('bill-1', { status: 'paid' });
  });

  it('uses the stable reference for the debit (not Date.now() salted)', async () => {
    const storage = makeStubStorage();
    const svc = createMoneyMovementService({ storage, provider: stubProvider });

    await svc.process(baseIntent);

    // The reference field is exactly what the route built (BILL-${billId}),
    // no salt. This is what makes the (wallet_id, reference) UNIQUE index
    // catch a retried /bills/pay as claim_lost.
    expect(storage.debitWalletIdempotent).toHaveBeenCalledWith(
      'w-1',
      50,
      'bill_payment',
      'Bill payment - Electricity — May 2026',
      'BILL-bill-1',
      { billId: 'bill-1' },
    );
  });

  it('debits BEFORE updating the bill (debit-first ordering)', async () => {
    const order: string[] = [];
    const storage = makeStubStorage({
      debitWalletIdempotent: vi.fn(async () => {
        order.push('debit');
        return { id: 'wt-1' };
      }),
      updateBill: vi.fn(async () => {
        order.push('updateBill');
      }),
    });
    const svc = createMoneyMovementService({ storage, provider: stubProvider });

    await svc.process(baseIntent);

    expect(order).toEqual(['debit', 'updateBill']);
  });

  it('returns providerResult carrying { billId, billName } so callers can echo back', async () => {
    const storage = makeStubStorage();
    const svc = createMoneyMovementService({ storage, provider: stubProvider });

    const outcome = await svc.process(baseIntent);

    if (outcome.kind === 'succeeded') {
      expect(outcome.providerResult).toEqual({
        billId: 'bill-1',
        billName: 'Electricity — May 2026',
      });
    }
  });
});

describe('STG3-B-3 — bill_payment claim_lost (TP-CRIT-04 protection)', () => {
  it('returns claim_lost without calling updateBill when debit returns null', async () => {
    const storage = makeStubStorage({
      debitWalletIdempotent: vi.fn().mockResolvedValue(null),
    });
    const svc = createMoneyMovementService({ storage, provider: stubProvider });

    const outcome = await svc.process(baseIntent);

    expect(outcome.kind).toBe('claim_lost');
    if (outcome.kind === 'claim_lost') {
      expect(outcome.reason).toBe('duplicate');
      expect(outcome.reference).toBe('BILL-bill-1');
    }
    expect(storage.updateBill).not.toHaveBeenCalled();
    expect(storage.creditWallet).not.toHaveBeenCalled();
  });
});

describe('STG3-B-3 — bill_payment updateBill failure → compensate', () => {
  it('credit-backs wallet in-line when updateBill throws and creditWallet succeeds', async () => {
    const storage = makeStubStorage({
      updateBill: vi.fn().mockRejectedValue(new Error('DB blip during updateBill')),
    });
    const svc = createMoneyMovementService({ storage, provider: stubProvider });

    const outcome = await svc.process(baseIntent);

    expect(outcome.kind).toBe('compensated');
    if (outcome.kind === 'compensated') {
      expect(outcome.compensation).toBe('in_line');
      expect(outcome.providerError).toBe('DB blip during updateBill');
    }
    expect(storage.creditWallet).toHaveBeenCalledTimes(1);
    expect(storage.creditWallet).toHaveBeenCalledWith(
      'w-1',
      50,
      'transfer_refund',
      expect.stringContaining('Refund: bill payment update failed'),
      'REFUND-BILL-bill-1',
      expect.objectContaining({ billId: 'bill-1' }),
    );
    expect(storage.enqueuePendingWalletCompensation).not.toHaveBeenCalled();
  });

  it('enqueues durable compensation when creditWallet ALSO fails', async () => {
    const storage = makeStubStorage({
      updateBill: vi.fn().mockRejectedValue(new Error('updateBill broken')),
      creditWallet: vi.fn().mockRejectedValue(new Error('creditWallet broken')),
    });
    const svc = createMoneyMovementService({ storage, provider: stubProvider });

    const outcome = await svc.process(baseIntent);

    expect(outcome.kind).toBe('compensated');
    if (outcome.kind === 'compensated') {
      expect(outcome.compensation).toBe('enqueued');
      // Original updateBill error reported (not the secondary creditWallet error).
      expect(outcome.providerError).toBe('updateBill broken');
    }
    expect(storage.enqueuePendingWalletCompensation).toHaveBeenCalledTimes(1);
    expect(storage.enqueuePendingWalletCompensation).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: 'w-1',
        amount: 50,
        currency: 'NGN',
        originalReference: 'BILL-bill-1',
        failureKind: 'bill_payment_refund',
        lastError: expect.stringContaining('creditWallet broken'),
        metadata: expect.objectContaining({
          billId: 'bill-1',
          markPaidError: 'updateBill broken',
          paidByUserId: 'u-1',
        }),
      }),
    );
  });

  it('returns enqueue_failed when even the queue is unavailable (worst case)', async () => {
    const storage = makeStubStorage({
      updateBill: vi.fn().mockRejectedValue(new Error('updateBill broken')),
      creditWallet: vi.fn().mockRejectedValue(new Error('creditWallet broken')),
      enqueuePendingWalletCompensation: vi.fn().mockRejectedValue(new Error('queue down')),
    });
    const svc = createMoneyMovementService({ storage, provider: stubProvider });

    const outcome = await svc.process(baseIntent);

    expect(outcome.kind).toBe('compensated');
    if (outcome.kind === 'compensated') {
      expect(outcome.compensation).toBe('enqueue_failed');
      // Still the ORIGINAL updateBill error — not creditWallet or enqueue.
      expect(outcome.providerError).toBe('updateBill broken');
    }
  });

  it('uses REFUND-{reference} as the credit-back idempotency key (mirrors wallet_transfer convention)', async () => {
    const storage = makeStubStorage({
      updateBill: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const svc = createMoneyMovementService({ storage, provider: stubProvider });

    await svc.process(baseIntent);

    expect(storage.creditWallet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Number),
      expect.any(String),
      expect.any(String),
      'REFUND-BILL-bill-1',
      expect.any(Object),
    );
  });
});

describe('STG3-B-3 — bill_payment failureKind in the compensation queue', () => {
  it('uses bill_payment_refund (not transfer_refund) so the worker can route differently', async () => {
    // The drain worker today treats them the same, but the failureKind
    // is observability metadata — if a future PR adds bill-payment-specific
    // compensation logic (e.g. revert the bill status atomically), the
    // failureKind discriminator is how it picks the right code path.
    const storage = makeStubStorage({
      updateBill: vi.fn().mockRejectedValue(new Error('e')),
      creditWallet: vi.fn().mockRejectedValue(new Error('e2')),
    });
    const svc = createMoneyMovementService({ storage, provider: stubProvider });

    await svc.process(baseIntent);

    expect(storage.enqueuePendingWalletCompensation).toHaveBeenCalledWith(
      expect.objectContaining({ failureKind: 'bill_payment_refund' }),
    );
  });
});
