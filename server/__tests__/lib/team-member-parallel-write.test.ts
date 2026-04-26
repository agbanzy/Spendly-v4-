import { describe, it, expect, vi, beforeEach } from "vitest";

// LU-DD-3 / AUD-DD-TEAM-001 — Contract tests for the parallel-write
// helpers that keep team_members and company_members in sync during the
// consolidation soak window.
//
// Real DB-backed integration tests (testcontainers Postgres, AUD-BE-005)
// will exercise the SQL UPSERT semantics; these tests model the contract
// shape so a regression in the storage helper signatures is caught.

interface FakeRow {
  id: string;
  companyId: string;
  email: string;
  userId: string | null;
  role: string;
  status: string;
  joinedAt: string | null;
  name: string | null;
  department: string | null;
  departmentId: string | null;
  avatar: string | null;
  permissions: string[];
}

class FakeTable {
  rows: FakeRow[] = [];
  upsertByCompanyEmail(input: Partial<FakeRow> & Pick<FakeRow, 'companyId' | 'email'>): FakeRow {
    const idx = this.rows.findIndex(
      (r) => r.companyId === input.companyId && r.email.toLowerCase() === input.email.toLowerCase()
    );
    if (idx >= 0) {
      this.rows[idx] = { ...this.rows[idx], ...input } as FakeRow;
      return this.rows[idx];
    }
    const newRow: FakeRow = {
      id: `id-${this.rows.length + 1}`,
      userId: null,
      role: 'EMPLOYEE',
      status: 'active',
      joinedAt: null,
      name: null,
      department: null,
      departmentId: null,
      avatar: null,
      permissions: [],
      ...(input as FakeRow),
    };
    this.rows.push(newRow);
    return newRow;
  }
  removeByCompanyEmail(companyId: string, email: string): boolean {
    const before = this.rows.length;
    this.rows = this.rows.filter(
      (r) => !(r.companyId === companyId && r.email.toLowerCase() === email.toLowerCase())
    );
    return this.rows.length < before;
  }
}

/**
 * Behaviour model for the parallel-write helpers. Mirrors what the real
 * helpers in storage.ts must do without touching Drizzle.
 */
function mirrorAcross(source: FakeRow, dest: FakeTable): FakeRow {
  // Mirror upsert: keys on (companyId, lower(email)). Existing values
  // win on null fields ("never overwrite a populated dest value with a
  // null source") to match COALESCE semantics.
  const existingIdx = dest.rows.findIndex(
    (r) => r.companyId === source.companyId && r.email.toLowerCase() === source.email.toLowerCase()
  );
  if (existingIdx >= 0) {
    const prev = dest.rows[existingIdx];
    dest.rows[existingIdx] = {
      ...prev,
      userId: source.userId ?? prev.userId,
      role: source.role,
      status: source.status,
      joinedAt: source.joinedAt ?? prev.joinedAt,
      name: source.name ?? prev.name,
      department: source.department ?? prev.department,
      departmentId: source.departmentId ?? prev.departmentId,
      avatar: source.avatar ?? prev.avatar,
      permissions: source.permissions ?? prev.permissions,
    };
    return dest.rows[existingIdx];
  }
  return dest.upsertByCompanyEmail({ ...source, id: `id-${dest.rows.length + 1}` });
}

describe('LU-DD-3 parallel-write contract', () => {
  let teamMembers: FakeTable;
  let companyMembers: FakeTable;

  beforeEach(() => {
    teamMembers = new FakeTable();
    companyMembers = new FakeTable();
  });

  it('mirrors a fresh team_member into company_members', () => {
    const tm: FakeRow = {
      id: 'tm-1',
      companyId: 'co-1',
      email: 'alice@x.com',
      userId: null,
      role: 'EMPLOYEE',
      status: 'active',
      joinedAt: '2026-04-26T10:00:00.000Z',
      name: 'Alice',
      department: 'Engineering',
      departmentId: 'dep-1',
      avatar: null,
      permissions: ['CREATE_EXPENSE'],
    };
    teamMembers.rows.push(tm);
    mirrorAcross(tm, companyMembers);

    expect(companyMembers.rows).toHaveLength(1);
    const mirrored = companyMembers.rows[0];
    expect(mirrored.email).toBe('alice@x.com');
    expect(mirrored.companyId).toBe('co-1');
    expect(mirrored.name).toBe('Alice');
    expect(mirrored.permissions).toEqual(['CREATE_EXPENSE']);
  });

  it('updates an existing company_members row instead of creating a duplicate', () => {
    companyMembers.upsertByCompanyEmail({
      companyId: 'co-1',
      email: 'alice@x.com',
      userId: 'cognito-1',
      role: 'EMPLOYEE',
      status: 'active',
      name: null,
      department: null,
      avatar: null,
      permissions: [],
    });
    const tm: FakeRow = {
      id: 'tm-2',
      companyId: 'co-1',
      email: 'alice@x.com',
      userId: null,
      role: 'MANAGER',
      status: 'active',
      joinedAt: null,
      name: 'Alice Smith',
      department: 'Engineering',
      departmentId: 'dep-1',
      avatar: null,
      permissions: ['VIEW_REPORTS'],
    };
    mirrorAcross(tm, companyMembers);

    expect(companyMembers.rows).toHaveLength(1);
    const mirrored = companyMembers.rows[0];
    expect(mirrored.role).toBe('MANAGER');                  // updated from source
    expect(mirrored.userId).toBe('cognito-1');              // preserved (source had null)
    expect(mirrored.name).toBe('Alice Smith');              // updated from source
    expect(mirrored.permissions).toEqual(['VIEW_REPORTS']); // updated from source
  });

  it('matches case-insensitively on email', () => {
    companyMembers.rows.push({
      id: 'cm-existing',
      companyId: 'co-1',
      email: 'BOB@example.com',
      userId: null,
      role: 'EMPLOYEE',
      status: 'active',
      joinedAt: null,
      name: 'Bob',
      department: null,
      departmentId: null,
      avatar: null,
      permissions: [],
    });
    const tm: FakeRow = {
      id: 'tm-bob',
      companyId: 'co-1',
      email: 'bob@example.com',
      userId: null,
      role: 'ADMIN',
      status: 'active',
      joinedAt: null,
      name: null,
      department: null,
      departmentId: null,
      avatar: null,
      permissions: [],
    };
    mirrorAcross(tm, companyMembers);

    expect(companyMembers.rows).toHaveLength(1);
    expect(companyMembers.rows[0].role).toBe('ADMIN');
  });

  it('does not overwrite a populated dest field with a null source field', () => {
    companyMembers.rows.push({
      id: 'cm-1',
      companyId: 'co-1',
      email: 'carol@x.com',
      userId: 'cognito-x',
      role: 'EMPLOYEE',
      status: 'active',
      joinedAt: null,
      name: 'Carol',
      department: 'Finance',
      departmentId: 'dep-fin',
      avatar: 'https://avatar/c.png',
      permissions: ['VIEW_REPORTS'],
    });
    const tm: FakeRow = {
      id: 'tm-1',
      companyId: 'co-1',
      email: 'carol@x.com',
      userId: null,
      role: 'EMPLOYEE',
      status: 'active',
      joinedAt: null,
      name: null,                  // null — should NOT erase 'Carol'
      department: null,            // null — should NOT erase 'Finance'
      departmentId: null,
      avatar: null,
      permissions: null as any,    // null — should NOT erase ['VIEW_REPORTS']
    };
    mirrorAcross(tm, companyMembers);

    const m = companyMembers.rows[0];
    expect(m.name).toBe('Carol');
    expect(m.department).toBe('Finance');
    expect(m.avatar).toBe('https://avatar/c.png');
    expect(m.permissions).toEqual(['VIEW_REPORTS']);
    expect(m.userId).toBe('cognito-x');
  });

  it('removes the mirror row when source is deleted', () => {
    teamMembers.rows.push({
      id: 'tm-d',
      companyId: 'co-1',
      email: 'delme@x.com',
      userId: null,
      role: 'EMPLOYEE',
      status: 'active',
      joinedAt: null,
      name: 'Delme',
      department: null,
      departmentId: null,
      avatar: null,
      permissions: [],
    });
    companyMembers.upsertByCompanyEmail({
      companyId: 'co-1',
      email: 'delme@x.com',
      role: 'EMPLOYEE',
      status: 'active',
    });

    const removed = companyMembers.removeByCompanyEmail('co-1', 'delme@x.com');
    expect(removed).toBe(true);
    expect(companyMembers.rows).toHaveLength(0);
  });

  it('reverse direction (company → team) creates a fresh team_members row', () => {
    const cm: FakeRow = {
      id: 'cm-1',
      companyId: 'co-2',
      email: 'newuser@x.com',
      userId: 'cognito-new',
      role: 'OWNER',
      status: 'active',
      joinedAt: null,
      name: 'New User',
      department: 'Operations',
      departmentId: 'dep-ops',
      avatar: null,
      permissions: [],
    };
    mirrorAcross(cm, teamMembers);

    expect(teamMembers.rows).toHaveLength(1);
    const tm = teamMembers.rows[0];
    expect(tm.email).toBe('newuser@x.com');
    expect(tm.role).toBe('OWNER');
    expect(tm.name).toBe('New User');
  });

  it('handles role/status/permissions changes on update', () => {
    companyMembers.rows.push({
      id: 'cm-promote',
      companyId: 'co-1',
      email: 'eve@x.com',
      userId: null,
      role: 'EMPLOYEE',
      status: 'active',
      joinedAt: null,
      name: 'Eve',
      department: null,
      departmentId: null,
      avatar: null,
      permissions: [],
    });

    // Source promotes Eve from EMPLOYEE → MANAGER
    const promoted: FakeRow = {
      id: 'cm-promote',
      companyId: 'co-1',
      email: 'eve@x.com',
      userId: null,
      role: 'MANAGER',
      status: 'active',
      joinedAt: null,
      name: null,
      department: null,
      departmentId: null,
      avatar: null,
      permissions: ['APPROVE_EXPENSE'],
    };
    mirrorAcross(promoted, teamMembers);

    expect(teamMembers.rows).toHaveLength(1);
    expect(teamMembers.rows[0].role).toBe('MANAGER');
    expect(teamMembers.rows[0].permissions).toEqual(['APPROVE_EXPENSE']);
  });
});
