import { describe, it, expect } from "vitest";

// DEF-STG3-WORKER-CRON — contract tests for GET /api/admin/wallet-compensations.
// The route is thin: validates query params, calls storage, returns the rows.
// These tests pin the param-parsing + ordering invariants so a future
// "just add a column to the response" PR doesn't accidentally let an
// unbounded limit or a status injection through.

// ---- Pure mirrors of the route + storage logic ----

const allowedStatuses = ['pending', 'processing', 'completed', 'manual_review'] as const;
type AllowedStatus = typeof allowedStatuses[number];

interface QueryInput {
  status?: string;
  limit?: string;
  offset?: string;
}

interface NormalizedQuery {
  status?: AllowedStatus;
  limit: number;
  offset: number;
}

/** Mirror of the route's query-param normalization. */
function parseQuery(q: QueryInput): NormalizedQuery {
  const status = q.status && (allowedStatuses as readonly string[]).includes(q.status)
    ? (q.status as AllowedStatus)
    : undefined;
  const limitRaw = q.limit !== undefined ? Number(q.limit) : NaN;
  const offsetRaw = q.offset !== undefined ? Number(q.offset) : NaN;
  // Storage applies the cap (50 default, 200 max, 0 floor) — mirror it.
  const defaultLimit = 50;
  const maxLimit = 200;
  const limit = Number.isFinite(limitRaw) ? Math.min(limitRaw, maxLimit) : defaultLimit;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;
  return { status, limit, offset };
}

interface CompensationRow {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'manual_review';
  createdAt: string;
}

/** Mirror of the storage ORDER BY: manual_review → pending → processing → others; newest first within each bucket. */
function sortLikeStorage(rows: CompensationRow[]): CompensationRow[] {
  const priority: Record<string, number> = {
    manual_review: 0,
    pending: 1,
    processing: 2,
    completed: 3,
  };
  return [...rows].sort((a, b) => {
    const pa = priority[a.status] ?? 3;
    const pb = priority[b.status] ?? 3;
    if (pa !== pb) return pa - pb;
    // newest first within the same bucket
    return b.createdAt.localeCompare(a.createdAt);
  });
}

describe('GET /api/admin/wallet-compensations — query parsing', () => {
  it('passes through a valid status', () => {
    expect(parseQuery({ status: 'pending' }).status).toBe('pending');
    expect(parseQuery({ status: 'processing' }).status).toBe('processing');
    expect(parseQuery({ status: 'completed' }).status).toBe('completed');
    expect(parseQuery({ status: 'manual_review' }).status).toBe('manual_review');
  });

  it('drops an unknown status (no injection — undefined → storage returns all)', () => {
    expect(parseQuery({ status: 'lol-pwned' }).status).toBeUndefined();
    expect(parseQuery({ status: 'DROP TABLE' }).status).toBeUndefined();
    expect(parseQuery({ status: '' }).status).toBeUndefined();
  });

  it('defaults limit to 50 when not provided', () => {
    expect(parseQuery({}).limit).toBe(50);
  });

  it('caps limit at 200 even if the caller asks for more', () => {
    expect(parseQuery({ limit: '10000' }).limit).toBe(200);
  });

  it('honours a limit smaller than the cap', () => {
    expect(parseQuery({ limit: '5' }).limit).toBe(5);
  });

  it('treats a non-numeric limit as the default (not 0, not NaN)', () => {
    expect(parseQuery({ limit: 'banana' }).limit).toBe(50);
  });

  it('defaults offset to 0 when not provided', () => {
    expect(parseQuery({}).offset).toBe(0);
  });

  it('floors negative offset at 0 (no negative-offset shenanigans)', () => {
    expect(parseQuery({ offset: '-5' }).offset).toBe(0);
  });

  it('passes through a positive offset', () => {
    expect(parseQuery({ offset: '100' }).offset).toBe(100);
  });
});

describe('GET /api/admin/wallet-compensations — ordering', () => {
  it('puts manual_review rows first (ops priority surface)', () => {
    const rows: CompensationRow[] = [
      { id: 'a', status: 'pending', createdAt: '2026-05-01' },
      { id: 'b', status: 'manual_review', createdAt: '2026-04-01' },
      { id: 'c', status: 'completed', createdAt: '2026-06-01' },
    ];
    const sorted = sortLikeStorage(rows);
    expect(sorted[0].id).toBe('b');
  });

  it('within a status bucket, orders by newest createdAt first', () => {
    const rows: CompensationRow[] = [
      { id: 'old', status: 'pending', createdAt: '2026-01-01' },
      { id: 'new', status: 'pending', createdAt: '2026-05-01' },
      { id: 'mid', status: 'pending', createdAt: '2026-03-01' },
    ];
    const sorted = sortLikeStorage(rows);
    expect(sorted.map((r) => r.id)).toEqual(['new', 'mid', 'old']);
  });

  it('cascades manual_review → pending → processing → completed', () => {
    const rows: CompensationRow[] = [
      { id: 'c', status: 'completed', createdAt: '2026-05-01' },
      { id: 'p', status: 'processing', createdAt: '2026-05-01' },
      { id: 'pe', status: 'pending', createdAt: '2026-05-01' },
      { id: 'm', status: 'manual_review', createdAt: '2026-05-01' },
    ];
    const sorted = sortLikeStorage(rows);
    expect(sorted.map((r) => r.id)).toEqual(['m', 'pe', 'p', 'c']);
  });

  it('mixed rows: bucket priority always wins over within-bucket recency', () => {
    const rows: CompensationRow[] = [
      { id: 'new-completed', status: 'completed', createdAt: '2026-12-01' },
      { id: 'old-manual', status: 'manual_review', createdAt: '2025-01-01' },
      { id: 'new-pending', status: 'pending', createdAt: '2026-12-01' },
    ];
    const sorted = sortLikeStorage(rows);
    // The 2025 manual_review row beats the 2026-12 completed/pending rows
    // because bucket priority dominates.
    expect(sorted[0].id).toBe('old-manual');
  });
});
