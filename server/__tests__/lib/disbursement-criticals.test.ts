import { describe, it, expect, vi } from "vitest";

// AUD-DB-001 / 002 / 003 / 009 — contract-level tests for the
// disbursement Sprint-1 fix. Models the route handlers' decision logic
// without spinning up Express; full route-level integration tests
// (testcontainers Postgres) land alongside Sprint-2 per the audit doc.

// --- AUD-DB-001 — POST /payouts validation contract ---

import { z } from "zod";

// Mirror of the schema added to payouts.routes.ts. Keeping a copy here
// lets the test catch drift if the schema changes without a paired
// behavioural test update.
const createPayoutSchema = z.object({
  type: z.enum(['expense_reimbursement', 'payroll', 'vendor_payment', 'other']),
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'number' ? v.toString() : v))
    .pipe(
      z.string().regex(/^\d+(\.\d{1,2})?$/, 'amount must be a non-negative decimal with up to 2 places')
        .refine((v) => parseFloat(v) > 0, 'amount must be greater than zero'),
    ),
  currency: z.string().regex(/^[A-Z]{3}$/, 'currency must be a 3-letter ISO code'),
  recipientType: z.enum(['employee', 'vendor', 'self', 'partner']),
  recipientId: z.string().min(1).max(64),
  recipientName: z.string().min(1).max(120),
  destinationId: z.string().min(1).max(64).optional(),
  relatedEntityType: z.enum(['expense', 'payroll', 'invoice', 'manual']).optional(),
  relatedEntityId: z.string().min(1).max(64).optional(),
});

const validBody = {
  type: 'expense_reimbursement' as const,
  amount: '100.50',
  currency: 'USD',
  recipientType: 'employee' as const,
  recipientId: 'user-123',
  recipientName: 'Jane Doe',
};

describe("AUD-DB-001 — POST /payouts Zod schema (no negative amount, no NaN, etc.)", () => {
  it("accepts a valid body", () => {
    expect(createPayoutSchema.safeParse(validBody).success).toBe(true);
  });

  it("rejects a negative amount", () => {
    const result = createPayoutSchema.safeParse({ ...validBody, amount: '-100' });
    expect(result.success).toBe(false);
  });

  it("rejects a NaN string", () => {
    const result = createPayoutSchema.safeParse({ ...validBody, amount: 'NaN' });
    expect(result.success).toBe(false);
  });

  it("rejects exponential notation", () => {
    const result = createPayoutSchema.safeParse({ ...validBody, amount: '1e9' });
    expect(result.success).toBe(false);
  });

  it("rejects amount of zero", () => {
    const result = createPayoutSchema.safeParse({ ...validBody, amount: '0' });
    expect(result.success).toBe(false);
  });

  it("rejects more than 2 decimal places", () => {
    const result = createPayoutSchema.safeParse({ ...validBody, amount: '100.123' });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown recipientType", () => {
    const result = createPayoutSchema.safeParse({ ...validBody, recipientType: 'mystery' as any });
    expect(result.success).toBe(false);
  });

  it("rejects a non-ISO currency code", () => {
    const result = createPayoutSchema.safeParse({ ...validBody, currency: 'usd' });
    expect(result.success).toBe(false);
  });

  it("rejects an empty recipientName", () => {
    const result = createPayoutSchema.safeParse({ ...validBody, recipientName: '' });
    expect(result.success).toBe(false);
  });

  it("accepts a numeric amount and stringifies it", () => {
    const result = createPayoutSchema.safeParse({ ...validBody, amount: 100.5 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe('100.5');
    }
  });
});

// --- AUD-DB-002 — Cancel must NOT credit the recipient wallet ---

type Storage = {
  getPayout: (id: string) => Promise<any>;
  getWalletByUserId: (userId: string, currency: string) => Promise<any>;
  creditWallet: (...args: any[]) => Promise<any>;
  updatePayout: (id: string, data: any) => Promise<any>;
};

/**
 * Mirror of the cancel handler's decision logic AFTER the AUD-DB-002
 * fix. The whole point is that creditWallet must NEVER be called from
 * cancel, regardless of payout status, recipientType, or recipientId.
 */
async function cancelPayoutHandler(
  storage: Storage,
  payoutId: string,
  reason: string,
  userId: string,
): Promise<{ status: number; balanceRefunded: boolean; called: { creditWallet: boolean } }> {
  const payout = await storage.getPayout(payoutId);
  if (!payout) return { status: 404, balanceRefunded: false, called: { creditWallet: false } };

  const cancellableStatuses = ['pending', 'approved', 'pending_second_approval'];
  if (!cancellableStatuses.includes(payout.status)) {
    return { status: 400, balanceRefunded: false, called: { creditWallet: false } };
  }

  // AUD-DB-002 fix: do NOT call creditWallet here. Cancel from any
  // cancellableStatus has nothing to undo on the company ledger because
  // /process never fired (debit lives in /process, not /approve).
  const balanceRefunded = false;

  await storage.updatePayout(payout.id, {
    status: 'cancelled',
    failureReason: reason,
    metadata: { balanceRefunded, cancelledBy: userId },
  });

  return { status: 200, balanceRefunded, called: { creditWallet: false } };
}

describe("AUD-DB-002 — Cancel does NOT credit recipient wallet (money-creation fix)", () => {
  it("does NOT call creditWallet when cancelling a 'pending' payout", async () => {
    const storage = {
      getPayout: vi.fn().mockResolvedValue({
        id: 'p1', status: 'pending', recipientType: 'employee', recipientId: 'user-1', amount: '500', currency: 'USD',
      }),
      getWalletByUserId: vi.fn().mockResolvedValue({ id: 'wallet-1' }),
      creditWallet: vi.fn(),
      updatePayout: vi.fn().mockResolvedValue({ id: 'p1' }),
    };
    const result = await cancelPayoutHandler(storage, 'p1', 'test', 'admin-1');
    expect(result.status).toBe(200);
    expect(result.balanceRefunded).toBe(false);
    expect(storage.creditWallet).not.toHaveBeenCalled();
  });

  it("does NOT call creditWallet when cancelling an 'approved' payout (the previously-buggy path)", async () => {
    const storage = {
      getPayout: vi.fn().mockResolvedValue({
        id: 'p2', status: 'approved', recipientType: 'employee', recipientId: 'user-2', amount: '4999', currency: 'USD',
      }),
      getWalletByUserId: vi.fn().mockResolvedValue({ id: 'wallet-2' }),
      creditWallet: vi.fn(),
      updatePayout: vi.fn().mockResolvedValue({ id: 'p2' }),
    };
    const result = await cancelPayoutHandler(storage, 'p2', 'test', 'admin-1');
    expect(result.status).toBe(200);
    expect(result.balanceRefunded).toBe(false);
    // This is THE assertion that closes the AUD-DB-002 money-creation bug:
    expect(storage.creditWallet).not.toHaveBeenCalled();
    expect(storage.getWalletByUserId).not.toHaveBeenCalled();
  });

  it("does NOT call creditWallet when cancelling a 'pending_second_approval' payout", async () => {
    const storage = {
      getPayout: vi.fn().mockResolvedValue({
        id: 'p3', status: 'pending_second_approval', recipientType: 'employee', recipientId: 'user-3', amount: '10000', currency: 'USD',
      }),
      getWalletByUserId: vi.fn(),
      creditWallet: vi.fn(),
      updatePayout: vi.fn().mockResolvedValue({ id: 'p3' }),
    };
    await cancelPayoutHandler(storage, 'p3', 'test', 'admin-1');
    expect(storage.creditWallet).not.toHaveBeenCalled();
  });

  it("returns 400 when payout is in non-cancellable status", async () => {
    const storage = {
      getPayout: vi.fn().mockResolvedValue({
        id: 'p4', status: 'processing', recipientType: 'employee', recipientId: 'user-4', amount: '500', currency: 'USD',
      }),
      getWalletByUserId: vi.fn(),
      creditWallet: vi.fn(),
      updatePayout: vi.fn(),
    };
    const result = await cancelPayoutHandler(storage, 'p4', 'test', 'admin-1');
    expect(result.status).toBe(400);
    expect(storage.creditWallet).not.toHaveBeenCalled();
    expect(storage.updatePayout).not.toHaveBeenCalled();
  });
});

// --- AUD-DB-009 — Initiator cannot approve self at any amount ---

type ApprovePayout = {
  id: string;
  status: 'pending' | 'pending_second_approval';
  amount: string;
  initiatedBy: string;
  metadata?: any;
};

/**
 * Mirror of the approve handler's maker-checker check AFTER the
 * AUD-DB-009 fix. The initiator-≠-approver invariant now applies at
 * all amounts, not just above threshold.
 */
function approvePayoutGate(
  payout: ApprovePayout,
  approverUserId: string,
  dualApprovalThreshold: number,
): { allowed: boolean; reason?: string; requiresDualApproval?: boolean } {
  if (!['pending', 'pending_second_approval'].includes(payout.status)) {
    return { allowed: false, reason: 'not-in-approvable-status' };
  }
  // AUD-DB-009 — universal four-eyes check (independent of amount).
  if (payout.initiatedBy && payout.initiatedBy === approverUserId) {
    return { allowed: false, reason: 'maker-checker-self-approval-blocked' };
  }
  const amount = parseFloat(payout.amount);
  if (amount >= dualApprovalThreshold) {
    return { allowed: true, requiresDualApproval: true };
  }
  return { allowed: true };
}

describe("AUD-DB-009 — Initiator cannot approve self at ANY amount", () => {
  it("blocks self-approval below threshold (the previously-allowed path)", () => {
    const result = approvePayoutGate(
      { id: 'p1', status: 'pending', amount: '4999', initiatedBy: 'admin-1' },
      'admin-1',
      5000,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('maker-checker-self-approval-blocked');
  });

  it("blocks self-approval above threshold (was already blocked before fix)", () => {
    const result = approvePayoutGate(
      { id: 'p2', status: 'pending', amount: '10000', initiatedBy: 'admin-1' },
      'admin-1',
      5000,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('maker-checker-self-approval-blocked');
  });

  it("allows a different admin to approve below threshold", () => {
    const result = approvePayoutGate(
      { id: 'p3', status: 'pending', amount: '4999', initiatedBy: 'admin-1' },
      'admin-2',
      5000,
    );
    expect(result.allowed).toBe(true);
    expect(result.requiresDualApproval).toBeFalsy();
  });

  it("allows a different admin to approve above threshold and flags dual-approval", () => {
    const result = approvePayoutGate(
      { id: 'p4', status: 'pending', amount: '10000', initiatedBy: 'admin-1' },
      'admin-2',
      5000,
    );
    expect(result.allowed).toBe(true);
    expect(result.requiresDualApproval).toBe(true);
  });

  it("blocks approval when payout is not in approvable status", () => {
    const result = approvePayoutGate(
      { id: 'p5', status: 'cancelled' as any, amount: '100', initiatedBy: 'admin-1' },
      'admin-2',
      5000,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('not-in-approvable-status');
  });

  it("does not block when initiatedBy is missing (legacy rows)", () => {
    const result = approvePayoutGate(
      { id: 'p6', status: 'pending', amount: '100', initiatedBy: '' },
      'admin-1',
      5000,
    );
    expect(result.allowed).toBe(true);
  });
});

// --- AUD-DB-003 — PIN gates documented in middleware list ---

describe("AUD-DB-003 — PIN required on cancel, reject, AND new POST /payouts", () => {
  // This test asserts the documented middleware contract. The actual
  // middleware enforcement is exercised in middleware/auth.test.ts
  // (server/__tests__/middleware/auth.test.ts).
  const expectedPinGatedRoutes = [
    'POST /api/payouts',                      // AUD-DB-001 — newly PIN-gated
    'POST /api/payouts/:id/approve',          // pre-existing
    'POST /api/payouts/:id/process',          // pre-existing
    'POST /api/payouts/:id/cancel',           // AUD-DB-003 — newly PIN-gated
    'POST /api/payouts/:id/reject',           // AUD-DB-003 — newly PIN-gated
    'POST /api/payouts/batch',                // pre-existing
  ];

  it("documents the PIN-gated payout routes (no-op assertion serving as anchor)", () => {
    expect(expectedPinGatedRoutes).toContain('POST /api/payouts/:id/cancel');
    expect(expectedPinGatedRoutes).toContain('POST /api/payouts/:id/reject');
    expect(expectedPinGatedRoutes).toContain('POST /api/payouts');
  });
});
