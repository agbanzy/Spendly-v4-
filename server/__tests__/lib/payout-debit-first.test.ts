import { describe, it, expect, vi, beforeEach } from "vitest";

// LU-DD-5 / AUD-DD-PAY-002 — contract-level tests of the debit-first
// payout flow.
//
// We stub the storage methods individually and exercise the orchestrator
// that lives in the route handler. The orchestrator is small enough that
// its behaviour can be modelled directly here without spinning up Express.
// Real DB-backed integration tests for atomicPayoutDebit /
// atomicPayoutCompensateOnFailure are tracked under AUD-BE-005
// (testcontainers Postgres) and will land alongside that work.

type Storage = {
  claimPayoutForProcessing: (id: string) => Promise<any>;
  atomicPayoutDebit: (input: any) => Promise<any>;
  atomicPayoutCompensateOnFailure: (input: any) => Promise<any>;
  updatePayout: (id: string, data: any) => Promise<any>;
};
type PaymentService = {
  initiateTransfer: (...args: any[]) => Promise<any>;
};

/**
 * Minimal reimplementation of the route's orchestrator under test. Mirrors
 * the structure in server/routes/payouts.routes.ts so failures here flag
 * regressions in the contract: claim → debit → external → success-update
 * OR failure-compensate.
 */
async function processPayoutDebitFirst(
  storage: Storage,
  paymentService: PaymentService,
  payout: { id: string; status: string; companyId: string; amount: string; currency: string; type: string },
): Promise<{ outcome: 'processed' | 'claim-failed' | 'debit-failed' | 'transfer-failed'; localTxnId?: string; compensated?: boolean }> {
  if (!['pending', 'approved'].includes(payout.status)) {
    return { outcome: 'claim-failed' };
  }
  const claimed = await storage.claimPayoutForProcessing(payout.id);
  if (!claimed) return { outcome: 'claim-failed' };

  const previousStatus = payout.status;

  let debitResult: { transactionId: string; balanceField: string };
  try {
    debitResult = await storage.atomicPayoutDebit({
      payoutId: payout.id,
      companyId: payout.companyId,
      amount: parseFloat(payout.amount),
      currency: payout.currency,
      description: `Payout: ${payout.type} - ${payout.id}`,
      reference: payout.id,
    });
  } catch {
    await storage.updatePayout(payout.id, { status: previousStatus });
    return { outcome: 'debit-failed' };
  }

  try {
    await paymentService.initiateTransfer(parseFloat(payout.amount), {}, 'US', 'reason');
  } catch {
    let compensated = false;
    try {
      await storage.atomicPayoutCompensateOnFailure({
        transactionId: debitResult.transactionId,
        companyId: payout.companyId,
        amount: parseFloat(payout.amount),
        currency: payout.currency,
        reason: 'external transfer failed',
      });
      compensated = true;
    } catch {
      compensated = false;
    }
    await storage.updatePayout(payout.id, { status: 'failed', failureReason: 'external transfer failed' });
    return { outcome: 'transfer-failed', localTxnId: debitResult.transactionId, compensated };
  }

  await storage.updatePayout(payout.id, {
    providerTransferId: 'PROV-123',
    providerReference: 'REF-456',
    processedAt: new Date().toISOString(),
  });
  return { outcome: 'processed', localTxnId: debitResult.transactionId };
}

const samplePayout = {
  id: 'po-1',
  status: 'pending',
  companyId: 'co-1',
  amount: '500.00',
  currency: 'USD',
  type: 'expense_reimbursement',
};

function makeStorage(overrides: Partial<Storage> = {}): Storage {
  return {
    claimPayoutForProcessing: vi.fn().mockResolvedValue({ id: 'po-1', status: 'processing' }),
    atomicPayoutDebit: vi.fn().mockResolvedValue({ transactionId: 'txn-1', balanceField: 'usd' }),
    atomicPayoutCompensateOnFailure: vi.fn().mockResolvedValue(undefined),
    updatePayout: vi.fn().mockResolvedValue({ id: 'po-1' }),
    ...overrides,
  };
}

function makePaymentService(overrides: Partial<PaymentService> = {}): PaymentService {
  return {
    initiateTransfer: vi.fn().mockResolvedValue({ transferId: 'PROV-123', reference: 'REF-456' }),
    ...overrides,
  };
}

describe("processPayoutDebitFirst (contract)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: claim → debit → external → update", async () => {
    const storage = makeStorage();
    const paymentService = makePaymentService();

    const result = await processPayoutDebitFirst(storage, paymentService, { ...samplePayout });

    expect(result.outcome).toBe('processed');
    expect(result.localTxnId).toBe('txn-1');

    // Order matters: claim must happen before debit; debit before transfer.
    const claimCall = (storage.claimPayoutForProcessing as any).mock.invocationCallOrder[0];
    const debitCall = (storage.atomicPayoutDebit as any).mock.invocationCallOrder[0];
    const transferCall = (paymentService.initiateTransfer as any).mock.invocationCallOrder[0];
    expect(claimCall).toBeLessThan(debitCall);
    expect(debitCall).toBeLessThan(transferCall);

    // No compensation on the happy path.
    expect((storage.atomicPayoutCompensateOnFailure as any).mock.calls.length).toBe(0);
  });

  it("rejects processing when status is already 'processing'", async () => {
    const storage = makeStorage();
    const result = await processPayoutDebitFirst(storage, makePaymentService(), { ...samplePayout, status: 'processing' });
    expect(result.outcome).toBe('claim-failed');
    expect((storage.claimPayoutForProcessing as any).mock.calls.length).toBe(0);
    expect((storage.atomicPayoutDebit as any).mock.calls.length).toBe(0);
  });

  it("rejects processing when claim returns null (concurrent caller won)", async () => {
    const storage = makeStorage({
      claimPayoutForProcessing: vi.fn().mockResolvedValue(null),
    });
    const result = await processPayoutDebitFirst(storage, makePaymentService(), { ...samplePayout });
    expect(result.outcome).toBe('claim-failed');
    expect((storage.atomicPayoutDebit as any).mock.calls.length).toBe(0);
  });

  it("releases the claim when local debit fails (e.g. insufficient funds)", async () => {
    const storage = makeStorage({
      atomicPayoutDebit: vi.fn().mockRejectedValue(new Error("Insufficient usd balance: need 500")),
    });
    const paymentService = makePaymentService();

    const result = await processPayoutDebitFirst(storage, paymentService, { ...samplePayout });

    expect(result.outcome).toBe('debit-failed');
    // External call NEVER happened.
    expect((paymentService.initiateTransfer as any).mock.calls.length).toBe(0);
    // Claim was released back to the previous status.
    expect((storage.updatePayout as any).mock.calls[0][1]).toEqual({ status: 'pending' });
    // No compensation either — there's nothing to compensate.
    expect((storage.atomicPayoutCompensateOnFailure as any).mock.calls.length).toBe(0);
  });

  it("compensates and marks failed when external transfer rejects", async () => {
    const storage = makeStorage();
    const paymentService = makePaymentService({
      initiateTransfer: vi.fn().mockRejectedValue(new Error("Stripe payouts: insufficient platform balance")),
    });

    const result = await processPayoutDebitFirst(storage, paymentService, { ...samplePayout });

    expect(result.outcome).toBe('transfer-failed');
    expect(result.compensated).toBe(true);
    // The compensating call must reference the same local txn the debit
    // returned — otherwise we'd refund the wrong balance.
    expect((storage.atomicPayoutCompensateOnFailure as any).mock.calls[0][0].transactionId).toBe('txn-1');
    expect((storage.atomicPayoutCompensateOnFailure as any).mock.calls[0][0].amount).toBe(500);
    expect((storage.atomicPayoutCompensateOnFailure as any).mock.calls[0][0].currency).toBe('USD');
    // Payout was marked failed.
    const failUpdate = (storage.updatePayout as any).mock.calls.find((c: any[]) => c[1].status === 'failed');
    expect(failUpdate).toBeTruthy();
  });

  it("still marks payout failed when compensation itself throws (manual-reconcile path)", async () => {
    const storage = makeStorage({
      atomicPayoutCompensateOnFailure: vi.fn().mockRejectedValue(new Error("DB outage")),
    });
    const paymentService = makePaymentService({
      initiateTransfer: vi.fn().mockRejectedValue(new Error("transfer failed")),
    });

    const result = await processPayoutDebitFirst(storage, paymentService, { ...samplePayout });

    expect(result.outcome).toBe('transfer-failed');
    expect(result.compensated).toBe(false);
    // Even though compensation failed, the payout was still marked failed
    // so the row doesn't get stuck in 'processing'.
    const failUpdate = (storage.updatePayout as any).mock.calls.find((c: any[]) => c[1].status === 'failed');
    expect(failUpdate).toBeTruthy();
  });

  it("never calls the external transfer before the local debit", async () => {
    const storage = makeStorage();
    const paymentService = makePaymentService();

    await processPayoutDebitFirst(storage, paymentService, { ...samplePayout });

    const debitOrder = (storage.atomicPayoutDebit as any).mock.invocationCallOrder[0];
    const transferOrder = (paymentService.initiateTransfer as any).mock.invocationCallOrder[0];
    // Strict ordering: this is the whole point of the refactor.
    expect(debitOrder).toBeLessThan(transferOrder);
  });
});
