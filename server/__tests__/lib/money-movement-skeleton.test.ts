import { describe, it, expect, vi } from "vitest";
import {
  createMoneyMovementService,
  MoneyMovementNotImplementedError,
  type MoneyIntent,
  type MoneyMovementStorage,
  type MoneyMovementProvider,
  type WalletTransferIntent,
} from "../../lib/money-movement";

// STG3-B (AUDIT_TRANSFERS_PAYOUTS_2026_05_17 §4.4 item 11) — contract
// tests for the MoneyMovement service SKELETON. The skeleton implements
// wallet_transfer end-to-end; the other intent kinds throw
// MoneyMovementNotImplementedError so callers fail fast and loudly
// until those variants are migrated in follow-up PRs.

function makeStubStorage(overrides?: Partial<MoneyMovementStorage>): MoneyMovementStorage {
  return {
    debitWalletIdempotent: vi.fn().mockResolvedValue({ id: 'wt-1' }),
    creditWallet: vi.fn().mockResolvedValue(undefined),
    enqueuePendingWalletCompensation: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function makeStubProvider(overrides?: Partial<MoneyMovementProvider>): MoneyMovementProvider {
  return {
    initiateTransfer: vi.fn().mockResolvedValue({ reference: 'TRF-prov-1' }),
    ...overrides,
  };
}

const baseIntent: WalletTransferIntent = {
  kind: 'wallet_transfer',
  walletId: 'w-1',
  userId: 'u-1',
  companyId: 'co-1',
  amount: 100,
  currency: 'NGN',
  countryCode: 'NG',
  reason: 'Office rent',
  reference: 'TRF-u1-1747000000000',
  recipientDetails: {
    accountNumber: '0123456789',
    bankCode: '044',
    accountName: 'Recipient Name',
  },
};

describe('STG3-B — MoneyMovement skeleton: wallet_transfer happy path', () => {
  it('returns succeeded with the provider reference when claim wins and provider succeeds', async () => {
    const storage = makeStubStorage();
    const provider = makeStubProvider({
      initiateTransfer: vi.fn().mockResolvedValue({ reference: 'TRF-pstk-77' }),
    });
    const svc = createMoneyMovementService({ storage, provider });

    const outcome = await svc.process(baseIntent);

    expect(outcome.kind).toBe('succeeded');
    if (outcome.kind === 'succeeded') {
      expect(outcome.reference).toBe('TRF-u1-1747000000000');
      expect(outcome.providerReference).toBe('TRF-pstk-77');
    }
  });

  it('threads userId/companyId/payoutId into provider metadata (idempotency keys)', async () => {
    const storage = makeStubStorage();
    const provider = makeStubProvider();
    const svc = createMoneyMovementService({ storage, provider });

    await svc.process(baseIntent);

    expect(provider.initiateTransfer).toHaveBeenCalledWith(
      100,
      baseIntent.recipientDetails,
      'NG',
      'Office rent',
      { payoutId: 'TRF-u1-1747000000000', companyId: 'co-1', userId: 'u-1' },
    );
  });

  it('debits before calling the provider (debit-first ordering — TP-CRIT-04)', async () => {
    const callOrder: string[] = [];
    const storage = makeStubStorage({
      debitWalletIdempotent: vi.fn(async () => {
        callOrder.push('debit');
        return { id: 'wt-1' };
      }),
    });
    const provider = makeStubProvider({
      initiateTransfer: vi.fn(async () => {
        callOrder.push('provider');
        return { reference: 'TRF-pstk-77' };
      }),
    });
    const svc = createMoneyMovementService({ storage, provider });

    await svc.process(baseIntent);

    expect(callOrder).toEqual(['debit', 'provider']);
  });

  it('exposes the raw provider result via outcome.providerResult (STG3-B-2 contract)', async () => {
    // Routes pass provider-specific fields back to the client; the
    // providerResult field is the contract that lets the per-route
    // migrations (STG3-B-2 onwards) avoid losing those fields.
    const storage = makeStubStorage();
    const paystackShape = {
      reference: 'TRF-pstk-77',
      status: 'pending',
      transfer_code: 'TRF-pstk-77',
      amount: 10000,
    };
    const provider = makeStubProvider({
      initiateTransfer: vi.fn().mockResolvedValue(paystackShape),
    });
    const svc = createMoneyMovementService({ storage, provider });

    const outcome = await svc.process(baseIntent);

    expect(outcome.kind).toBe('succeeded');
    if (outcome.kind === 'succeeded') {
      expect(outcome.providerResult).toEqual(paystackShape);
    }
  });

  it('falls back to providerReference=intent.reference when provider returns no id', async () => {
    const storage = makeStubStorage();
    const provider = makeStubProvider({
      initiateTransfer: vi.fn().mockResolvedValue({}),
    });
    const svc = createMoneyMovementService({ storage, provider });

    const outcome = await svc.process(baseIntent);

    expect(outcome.kind).toBe('succeeded');
    if (outcome.kind === 'succeeded') {
      expect(outcome.providerReference).toBe('TRF-u1-1747000000000');
    }
  });
});

describe('STG3-B — MoneyMovement skeleton: claim lost (TP-CRIT-04)', () => {
  it('returns claim_lost without calling the provider when debit returns null', async () => {
    const provider = makeStubProvider();
    const storage = makeStubStorage({
      debitWalletIdempotent: vi.fn().mockResolvedValue(null),
    });
    const svc = createMoneyMovementService({ storage, provider });

    const outcome = await svc.process(baseIntent);

    expect(outcome.kind).toBe('claim_lost');
    if (outcome.kind === 'claim_lost') {
      expect(outcome.reason).toBe('duplicate');
      expect(outcome.reference).toBe('TRF-u1-1747000000000');
    }
    expect(provider.initiateTransfer).not.toHaveBeenCalled();
    expect(storage.creditWallet).not.toHaveBeenCalled();
    expect(storage.enqueuePendingWalletCompensation).not.toHaveBeenCalled();
  });
});

describe('STG3-B — MoneyMovement skeleton: provider failure → in-line refund (TP-HIGH-07)', () => {
  it('returns compensated/in_line when provider fails and creditWallet succeeds', async () => {
    const storage = makeStubStorage();
    const provider = makeStubProvider({
      initiateTransfer: vi.fn().mockRejectedValue(new Error('Paystack 502')),
    });
    const svc = createMoneyMovementService({ storage, provider });

    const outcome = await svc.process(baseIntent);

    expect(outcome.kind).toBe('compensated');
    if (outcome.kind === 'compensated') {
      expect(outcome.compensation).toBe('in_line');
      expect(outcome.providerError).toBe('Paystack 502');
    }
    expect(storage.creditWallet).toHaveBeenCalledTimes(1);
    expect(storage.enqueuePendingWalletCompensation).not.toHaveBeenCalled();
  });

  it('uses REFUND-{reference} as the credit-back idempotency key', async () => {
    const storage = makeStubStorage();
    const provider = makeStubProvider({
      initiateTransfer: vi.fn().mockRejectedValue(new Error('Paystack 502')),
    });
    const svc = createMoneyMovementService({ storage, provider });

    await svc.process(baseIntent);

    expect(storage.creditWallet).toHaveBeenCalledWith(
      'w-1',
      100,
      'transfer_refund',
      expect.stringContaining('Refund: transfer failed'),
      'REFUND-TRF-u1-1747000000000',
      expect.objectContaining({ reason: 'Paystack 502' }),
    );
  });
});

describe('STG3-B — MoneyMovement skeleton: provider failure → enqueue (TP-HIGH-07)', () => {
  it('enqueues durable compensation when creditWallet also fails', async () => {
    const storage = makeStubStorage({
      creditWallet: vi.fn().mockRejectedValue(new Error('DB blip')),
    });
    const provider = makeStubProvider({
      initiateTransfer: vi.fn().mockRejectedValue(new Error('Paystack 502')),
    });
    const svc = createMoneyMovementService({ storage, provider });

    const outcome = await svc.process(baseIntent);

    expect(outcome.kind).toBe('compensated');
    if (outcome.kind === 'compensated') {
      expect(outcome.compensation).toBe('enqueued');
      expect(outcome.providerError).toBe('Paystack 502');
    }
    expect(storage.enqueuePendingWalletCompensation).toHaveBeenCalledTimes(1);
    expect(storage.enqueuePendingWalletCompensation).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: 'w-1',
        amount: 100,
        currency: 'NGN',
        originalReference: 'TRF-u1-1747000000000',
        failureKind: 'transfer_refund',
        lastError: expect.stringContaining('DB blip'),
      }),
    );
  });

  it('returns compensated/enqueue_failed when even enqueue throws (worst case)', async () => {
    const storage = makeStubStorage({
      creditWallet: vi.fn().mockRejectedValue(new Error('DB blip')),
      enqueuePendingWalletCompensation: vi.fn().mockRejectedValue(new Error('queue dead too')),
    });
    const provider = makeStubProvider({
      initiateTransfer: vi.fn().mockRejectedValue(new Error('Paystack 502')),
    });
    const svc = createMoneyMovementService({ storage, provider });

    const outcome = await svc.process(baseIntent);

    expect(outcome.kind).toBe('compensated');
    if (outcome.kind === 'compensated') {
      expect(outcome.compensation).toBe('enqueue_failed');
      // Original provider error still reported, NOT the secondary errors.
      expect(outcome.providerError).toBe('Paystack 502');
    }
  });
});

describe('STG3-B — MoneyMovement skeleton: not-yet-implemented intent kinds', () => {
  const storage = makeStubStorage();
  const provider = makeStubProvider();
  const svc = createMoneyMovementService({ storage, provider });

  it('throws MoneyMovementNotImplementedError for payout_disbursement', async () => {
    const intent: MoneyIntent = {
      kind: 'payout_disbursement',
      payoutId: 'pay-1',
      companyId: 'co-1',
      amount: 100,
      currency: 'USD',
    };
    await expect(svc.process(intent)).rejects.toBeInstanceOf(MoneyMovementNotImplementedError);
  });

  it('throws MoneyMovementNotImplementedError for bill_payment', async () => {
    const intent: MoneyIntent = {
      kind: 'bill_payment',
      billId: 'b-1',
      companyId: 'co-1',
      paidByUserId: 'u-1',
      amount: 100,
      currency: 'USD',
      walletId: 'w-1',
    };
    await expect(svc.process(intent)).rejects.toBeInstanceOf(MoneyMovementNotImplementedError);
  });

  it('throws MoneyMovementNotImplementedError for expense_reimbursement', async () => {
    const intent: MoneyIntent = {
      kind: 'expense_reimbursement',
      expenseId: 'e-1',
      companyId: 'co-1',
      beneficiaryUserId: 'u-1',
      amount: 100,
      currency: 'USD',
    };
    await expect(svc.process(intent)).rejects.toBeInstanceOf(MoneyMovementNotImplementedError);
  });

  it('throws MoneyMovementNotImplementedError for payroll_disbursement', async () => {
    const intent: MoneyIntent = {
      kind: 'payroll_disbursement',
      payrollRunId: 'pr-1',
      companyId: 'co-1',
      beneficiaryUserId: 'u-1',
      amount: 100,
      currency: 'USD',
    };
    await expect(svc.process(intent)).rejects.toBeInstanceOf(MoneyMovementNotImplementedError);
  });

  it('error includes the intent kind so logs are diagnosable', async () => {
    const intent: MoneyIntent = {
      kind: 'bill_payment',
      billId: 'b-1', companyId: 'co-1', paidByUserId: 'u-1',
      amount: 1, currency: 'USD', walletId: 'w-1',
    };
    try {
      await svc.process(intent);
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(MoneyMovementNotImplementedError);
      expect(err.message).toContain('bill_payment');
      expect(err.intentKind).toBe('bill_payment');
    }
  });
});

describe('STG3-B — MoneyOutcome discriminated union shape', () => {
  it('exhaustively switchable — every outcome kind reachable from wallet_transfer', async () => {
    // Sanity: ensure every documented outcome.kind is reachable. If a
    // future PR adds a new outcome kind, the switch in routes that
    // previously compiled will warn until they handle it.
    const seen = new Set<string>();
    const storage = makeStubStorage();
    const provider = makeStubProvider();
    const svc = createMoneyMovementService({ storage, provider });

    // succeeded path
    seen.add((await svc.process(baseIntent)).kind);

    // claim_lost path
    const lostSvc = createMoneyMovementService({
      storage: makeStubStorage({ debitWalletIdempotent: vi.fn().mockResolvedValue(null) }),
      provider: makeStubProvider(),
    });
    seen.add((await lostSvc.process(baseIntent)).kind);

    // compensated (in_line, enqueued, enqueue_failed all share kind='compensated')
    const compSvc = createMoneyMovementService({
      storage: makeStubStorage(),
      provider: makeStubProvider({
        initiateTransfer: vi.fn().mockRejectedValue(new Error('x')),
      }),
    });
    seen.add((await compSvc.process(baseIntent)).kind);

    expect(seen).toEqual(new Set(['succeeded', 'claim_lost', 'compensated']));
  });
});
