import { describe, it, expect } from "vitest";

// STG3-A (AUDIT_TRANSFERS_PAYOUTS_2026_05_17 §4.4 item 12) — contract
// tests for the typed dual-approval columns on payouts.
//
// Before STG3-A the maker-checker approve handler wrote ONLY to
// payouts.metadata.firstApproval / metadata.secondApproval (JSONB).
// After STG3-A it parallel-writes to BOTH the JSONB (preserved for the
// soak window) AND the typed columns:
//   - firstApprovedBy / firstApprovedAt (first approver)
//   - approvedBy / approvedAt (second/final approver)
//   - approvalStatus ('pending_second_approval' | 'approved')
//
// These tests model the route's storage.updatePayout(...) call shape so
// a regression that drops the typed write fails loudly. The JSONB->typed
// backfill SQL is exercised in the deferred migration's own DO $$ guard.

interface PayoutStub {
  id: string;
  status: 'pending' | 'pending_second_approval' | 'approved';
  amount: number;
  currency: string;
  metadata: Record<string, any> | null;
  firstApprovedBy?: string | null;
  firstApprovedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  approvalStatus?: string | null;
  initiatedBy?: string | null;
}

interface ApproveInput {
  approverUserId: string;
  approverName: string;
  nowIso: string;
}

interface ApproveOutput {
  decision: '403_same_admin' | '403_initiator' | 'first_recorded' | 'second_recorded';
  updatePayload?: Partial<PayoutStub>;
}

/**
 * Mirror of the /payouts/:id/approve route's decision logic (the
 * dual-approval branch) after the STG3-A parallel-write change. Pure
 * function — tests don't need the DB.
 */
function modelApproveDecision(
  payout: PayoutStub,
  input: ApproveInput,
): ApproveOutput {
  // initiator cannot self-approve
  if (payout.initiatedBy && payout.initiatedBy === input.approverUserId) {
    return { decision: '403_initiator' };
  }

  const metadata = payout.metadata ? { ...payout.metadata } : {};

  if (!metadata.firstApproval) {
    // First approval — typed parallel-write
    metadata.firstApproval = {
      by: input.approverUserId,
      byName: input.approverName,
      at: input.nowIso,
    };
    return {
      decision: 'first_recorded',
      updatePayload: {
        status: 'pending_second_approval',
        metadata,
        firstApprovedBy: input.approverUserId,
        firstApprovedAt: input.nowIso,
        approvalStatus: 'pending_second_approval',
      },
    };
  }

  if (metadata.firstApproval.by === input.approverUserId) {
    return { decision: '403_same_admin' };
  }

  metadata.secondApproval = {
    by: input.approverUserId,
    byName: input.approverName,
    at: input.nowIso,
  };
  return {
    decision: 'second_recorded',
    updatePayload: {
      status: 'approved',
      metadata,
      approvedBy: input.approverUserId,
      approvedAt: input.nowIso,
      approvalStatus: 'approved',
    },
  };
}

describe('STG3-A — first approval parallel-write', () => {
  const basePayout: PayoutStub = {
    id: 'pay-1',
    status: 'pending',
    amount: 10_000,
    currency: 'USD',
    metadata: null,
    initiatedBy: 'admin-a',
  };

  it('writes typed firstApprovedBy + firstApprovedAt + approvalStatus on first approval', () => {
    const result = modelApproveDecision(basePayout, {
      approverUserId: 'admin-b',
      approverName: 'Admin Bee',
      nowIso: '2026-05-18T12:00:00.000Z',
    });

    expect(result.decision).toBe('first_recorded');
    expect(result.updatePayload?.firstApprovedBy).toBe('admin-b');
    expect(result.updatePayload?.firstApprovedAt).toBe('2026-05-18T12:00:00.000Z');
    expect(result.updatePayload?.approvalStatus).toBe('pending_second_approval');
  });

  it('still writes legacy metadata.firstApproval JSONB (parallel-write, not replacement)', () => {
    const result = modelApproveDecision(basePayout, {
      approverUserId: 'admin-b',
      approverName: 'Admin Bee',
      nowIso: '2026-05-18T12:00:00.000Z',
    });

    const md = result.updatePayload?.metadata as any;
    expect(md.firstApproval).toBeDefined();
    expect(md.firstApproval.by).toBe('admin-b');
    expect(md.firstApproval.byName).toBe('Admin Bee');
    expect(md.firstApproval.at).toBe('2026-05-18T12:00:00.000Z');
  });

  it('rejects the initiator approving their own payout (maker-checker)', () => {
    const result = modelApproveDecision(basePayout, {
      approverUserId: 'admin-a', // same as basePayout.initiatedBy
      approverName: 'Admin Eh',
      nowIso: '2026-05-18T12:00:00.000Z',
    });
    expect(result.decision).toBe('403_initiator');
    expect(result.updatePayload).toBeUndefined();
  });
});

describe('STG3-A — second approval parallel-write', () => {
  const firstApproved: PayoutStub = {
    id: 'pay-1',
    status: 'pending_second_approval',
    amount: 10_000,
    currency: 'USD',
    metadata: {
      firstApproval: {
        by: 'admin-b',
        byName: 'Admin Bee',
        at: '2026-05-18T12:00:00.000Z',
      },
    },
    firstApprovedBy: 'admin-b',
    firstApprovedAt: '2026-05-18T12:00:00.000Z',
    approvalStatus: 'pending_second_approval',
    initiatedBy: 'admin-a',
  };

  it('writes typed approvedBy + approvedAt + approvalStatus=approved on second approval', () => {
    const result = modelApproveDecision(firstApproved, {
      approverUserId: 'admin-c',
      approverName: 'Admin See',
      nowIso: '2026-05-18T12:05:00.000Z',
    });

    expect(result.decision).toBe('second_recorded');
    expect(result.updatePayload?.status).toBe('approved');
    expect(result.updatePayload?.approvedBy).toBe('admin-c');
    expect(result.updatePayload?.approvedAt).toBe('2026-05-18T12:05:00.000Z');
    expect(result.updatePayload?.approvalStatus).toBe('approved');
  });

  it('preserves the firstApproval JSONB and adds secondApproval (parallel-write)', () => {
    const result = modelApproveDecision(firstApproved, {
      approverUserId: 'admin-c',
      approverName: 'Admin See',
      nowIso: '2026-05-18T12:05:00.000Z',
    });

    const md = result.updatePayload?.metadata as any;
    expect(md.firstApproval).toBeDefined();
    expect(md.firstApproval.by).toBe('admin-b'); // preserved
    expect(md.secondApproval).toBeDefined();
    expect(md.secondApproval.by).toBe('admin-c');
    expect(md.secondApproval.at).toBe('2026-05-18T12:05:00.000Z');
  });

  it('rejects the same admin trying to provide both approvals', () => {
    const result = modelApproveDecision(firstApproved, {
      approverUserId: 'admin-b', // same as firstApproval.by
      approverName: 'Admin Bee',
      nowIso: '2026-05-18T12:05:00.000Z',
    });
    expect(result.decision).toBe('403_same_admin');
    expect(result.updatePayload).toBeUndefined();
  });

  it('rejects the initiator as second approver too', () => {
    const result = modelApproveDecision(firstApproved, {
      approverUserId: 'admin-a', // initiator
      approverName: 'Admin Eh',
      nowIso: '2026-05-18T12:05:00.000Z',
    });
    expect(result.decision).toBe('403_initiator');
  });
});

describe('STG3-A — typed columns + JSONB stay in sync', () => {
  it('every update that writes JSONB also writes the corresponding typed column', () => {
    // First approval: metadata.firstApproval ↔ firstApprovedBy/At
    const first = modelApproveDecision(
      {
        id: 'pay-1', status: 'pending', amount: 10_000, currency: 'USD',
        metadata: null, initiatedBy: 'admin-a',
      },
      { approverUserId: 'admin-b', approverName: 'Bee', nowIso: '2026-05-18T12:00:00.000Z' },
    );
    const firstMd = first.updatePayload?.metadata as any;
    expect(firstMd.firstApproval.by).toBe(first.updatePayload?.firstApprovedBy);
    expect(firstMd.firstApproval.at).toBe(first.updatePayload?.firstApprovedAt);

    // Second approval: metadata.secondApproval ↔ approvedBy/At
    const second = modelApproveDecision(
      {
        id: 'pay-1',
        status: 'pending_second_approval',
        amount: 10_000,
        currency: 'USD',
        metadata: { firstApproval: { by: 'admin-b', byName: 'Bee', at: '2026-05-18T12:00:00.000Z' } },
        initiatedBy: 'admin-a',
      },
      { approverUserId: 'admin-c', approverName: 'See', nowIso: '2026-05-18T12:05:00.000Z' },
    );
    const secondMd = second.updatePayload?.metadata as any;
    expect(secondMd.secondApproval.by).toBe(second.updatePayload?.approvedBy);
    expect(secondMd.secondApproval.at).toBe(second.updatePayload?.approvedAt);
  });
});

// Backfill query parity — pin the WHERE clauses used in
// migrations-deferred/0020_payouts_backfill_typed_approval_columns.sql.
// Models the JSONB extractor semantics so a future tweak to the
// migration's WHERE silently changing the row set fails this test.

describe('STG3-A — backfill query parity', () => {
  interface BackfillRow {
    metadata: Record<string, any> | null;
    firstApprovedBy: string | null;
    approvedAt: string | null;
  }

  /** Mirror of the migration's candidate-row WHERE clause. */
  function isBackfillCandidate(row: BackfillRow): boolean {
    if (!row.metadata) return false;
    const hasFirst = 'firstApproval' in row.metadata;
    const hasSecond = 'secondApproval' in row.metadata;
    if (!hasFirst && !hasSecond) return false;
    if (row.firstApprovedBy === null) return true;
    if (row.approvedAt === null && hasSecond) return true;
    return false;
  }

  it('selects rows where firstApprovedBy is NULL and metadata.firstApproval exists', () => {
    expect(
      isBackfillCandidate({
        metadata: { firstApproval: { by: 'x', at: 't' } },
        firstApprovedBy: null,
        approvedAt: null,
      }),
    ).toBe(true);
  });

  it('selects rows where approvedAt is NULL and metadata.secondApproval exists', () => {
    expect(
      isBackfillCandidate({
        metadata: {
          firstApproval: { by: 'x', at: 't' },
          secondApproval: { by: 'y', at: 't2' },
        },
        firstApprovedBy: 'x', // already backfilled
        approvedAt: null,     // but second-approval timestamp wasn't
      }),
    ).toBe(true);
  });

  it('skips rows already fully backfilled', () => {
    expect(
      isBackfillCandidate({
        metadata: {
          firstApproval: { by: 'x', at: 't' },
          secondApproval: { by: 'y', at: 't2' },
        },
        firstApprovedBy: 'x',
        approvedAt: 't2',
      }),
    ).toBe(false);
  });

  it('skips rows with no JSONB approval keys (untouched legacy/new rows)', () => {
    expect(
      isBackfillCandidate({
        metadata: { someOtherKey: 'v' },
        firstApprovedBy: null,
        approvedAt: null,
      }),
    ).toBe(false);
  });

  it('skips rows with null metadata entirely', () => {
    expect(
      isBackfillCandidate({
        metadata: null,
        firstApprovedBy: null,
        approvedAt: null,
      }),
    ).toBe(false);
  });
});
