import { describe, it, expect, vi } from "vitest";

// AUD-PR-006 + AUD-PR-011 — Sprint-2 contract tests for the claim
// pattern + salary-fallback removal in payroll.routes.ts.

// --- AUD-PR-006 — Claim pattern: pending → processing atomically ---

type Storage = {
  getPayrollEntryInCompany: (id: string, companyId: string) => Promise<any>;
  claimPayrollEntryForProcessing: (id: string, companyId: string) => Promise<any>;
};

/**
 * Mirror of the /payroll/:id/pay handler's pre-transfer flow. Two
 * concurrent calls must produce: one claim succeeds (200 path), one
 * claim fails (409 path). The handler returns 409 when the storage
 * helper returns undefined.
 */
async function payHandlerPreTransfer(
  storage: Storage,
  company: { companyId: string } | null,
  id: string,
): Promise<{ status: number; reason?: string }> {
  if (!company?.companyId) return { status: 403, reason: 'no-company' };

  const entry = await storage.getPayrollEntryInCompany(id, company.companyId);
  if (!entry) return { status: 404, reason: 'not-found' };
  if (entry.status !== 'pending') return { status: 400, reason: 'not-pending' };

  const claimed = await storage.claimPayrollEntryForProcessing(entry.id, company.companyId);
  if (!claimed) return { status: 409, reason: 'claim-lost' };

  return { status: 200 };
}

describe("AUD-PR-006 — Claim pattern (pending → processing atomic)", () => {
  it("returns 200 when claim succeeds (handler is the first to claim)", async () => {
    const entry = { id: 'p1', status: 'pending', companyId: 'tenant-A' };
    const storage = {
      getPayrollEntryInCompany: vi.fn().mockResolvedValue(entry),
      claimPayrollEntryForProcessing: vi.fn().mockResolvedValue({ ...entry, status: 'processing' }),
    };
    const result = await payHandlerPreTransfer(storage, { companyId: 'tenant-A' }, 'p1');
    expect(result.status).toBe(200);
    expect(storage.claimPayrollEntryForProcessing).toHaveBeenCalledWith('p1', 'tenant-A');
  });

  it("returns 409 when claim is lost (concurrent caller already moved status)", async () => {
    const entry = { id: 'p2', status: 'pending', companyId: 'tenant-A' };
    const storage = {
      getPayrollEntryInCompany: vi.fn().mockResolvedValue(entry),
      claimPayrollEntryForProcessing: vi.fn().mockResolvedValue(undefined),
    };
    const result = await payHandlerPreTransfer(storage, { companyId: 'tenant-A' }, 'p2');
    expect(result.status).toBe(409);
    expect(result.reason).toBe('claim-lost');
  });

  it("returns 400 when entry is not pending (don't even attempt claim)", async () => {
    const storage = {
      getPayrollEntryInCompany: vi.fn().mockResolvedValue({ id: 'p3', status: 'paid', companyId: 'tenant-A' }),
      claimPayrollEntryForProcessing: vi.fn(),
    };
    const result = await payHandlerPreTransfer(storage, { companyId: 'tenant-A' }, 'p3');
    expect(result.status).toBe(400);
    expect(result.reason).toBe('not-pending');
    expect(storage.claimPayrollEntryForProcessing).not.toHaveBeenCalled();
  });

  it("models the race: two simultaneous /pay calls produce one 200 + one 409", async () => {
    // Simulate two callers racing on the same entry. The first claim
    // call succeeds, the second returns undefined (real Postgres would
    // produce zero rows on the WHERE status='pending' clause for the
    // loser).
    const entry = { id: 'p4', status: 'pending', companyId: 'tenant-A' };
    let claimsServed = 0;
    const storage = {
      getPayrollEntryInCompany: vi.fn().mockResolvedValue(entry),
      claimPayrollEntryForProcessing: vi.fn(async () => {
        claimsServed++;
        return claimsServed === 1 ? { ...entry, status: 'processing' } : undefined;
      }),
    };
    const [a, b] = await Promise.all([
      payHandlerPreTransfer(storage, { companyId: 'tenant-A' }, 'p4'),
      payHandlerPreTransfer(storage, { companyId: 'tenant-A' }, 'p4'),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
  });
});

// --- AUD-PR-011 — Drop salary fallback in batch-payout ---

type BatchEntry = {
  id: string;
  status: string;
  netPay?: string | null;
  salary?: string | null;
};

/**
 * Mirror of the batch-payout's per-entry validation AFTER the AUD-PR-011
 * fix. The previous code's `entry.netPay || entry.salary` fallback is
 * gone; an entry with missing/zero/non-positive netPay is skipped with
 * reason='invalid-netpay'.
 */
function batchEntryGate(entry: BatchEntry): { proceed: boolean; reason?: string; netPayUsed?: string } {
  if (entry.status === 'paid') return { proceed: false, reason: 'already-paid' };

  const netPay = entry.netPay;
  if (!netPay || parseFloat(String(netPay)) <= 0) {
    return { proceed: false, reason: 'invalid-netpay' };
  }
  return { proceed: true, netPayUsed: netPay };
}

describe("AUD-PR-011 — batch-payout no longer falls back to gross salary", () => {
  it("skips when netPay is undefined (was: silently used salary)", () => {
    const result = batchEntryGate({ id: 'p1', status: 'pending', salary: '5000' });
    expect(result.proceed).toBe(false);
    expect(result.reason).toBe('invalid-netpay');
  });

  it("skips when netPay is null (was: silently used salary)", () => {
    const result = batchEntryGate({ id: 'p2', status: 'pending', netPay: null, salary: '5000' });
    expect(result.proceed).toBe(false);
    expect(result.reason).toBe('invalid-netpay');
  });

  it("skips when netPay is '0'", () => {
    const result = batchEntryGate({ id: 'p3', status: 'pending', netPay: '0', salary: '5000' });
    expect(result.proceed).toBe(false);
    expect(result.reason).toBe('invalid-netpay');
  });

  it("skips when netPay is negative", () => {
    const result = batchEntryGate({ id: 'p4', status: 'pending', netPay: '-100', salary: '5000' });
    expect(result.proceed).toBe(false);
    expect(result.reason).toBe('invalid-netpay');
  });

  it("uses netPay when valid (does NOT fall back to salary)", () => {
    const result = batchEntryGate({ id: 'p5', status: 'pending', netPay: '4000', salary: '5000' });
    expect(result.proceed).toBe(true);
    expect(result.netPayUsed).toBe('4000');
  });

  it("skips already-paid entries before checking netPay", () => {
    const result = batchEntryGate({ id: 'p6', status: 'paid', netPay: '4000' });
    expect(result.proceed).toBe(false);
    expect(result.reason).toBe('already-paid');
  });
});
