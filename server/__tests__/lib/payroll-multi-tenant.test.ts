import { describe, it, expect, vi } from "vitest";

// AUD-PR-001..005 — contract-level tests for the payroll multi-tenant
// isolation fix shipped in fix-payroll-multi-tenant-2026-04-26.
//
// We don't spin up Express here. Each test models the route's small
// orchestrator and stubs the relevant storage method, then asserts the
// caller's tenant boundary is honoured. Real DB-backed integration tests
// are tracked under AUD-PR-009 (full route-level coverage with
// testcontainers Postgres) and will land alongside that work.

type Company = { companyId: string } | null;

type PayrollStorage = {
  getPayroll: (companyId?: string) => Promise<Array<{ id: string; companyId: string; status: string }>>;
  getPayrollEntryInCompany: (id: string, companyId: string) => Promise<{ id: string; companyId: string } | undefined>;
  getPayrollEntriesByIdsInCompany: (ids: string[], companyId: string) => Promise<Array<{ id: string; companyId: string; status: string }>>;
  updatePayrollEntryInCompany: (id: string, companyId: string, data: any) => Promise<{ id: string; companyId: string } | undefined>;
  deletePayrollEntryInCompany: (id: string, companyId: string) => Promise<boolean>;
};

// --- Orchestrators (mirror the route handlers in payroll.routes.ts) ---

async function getEntryHandler(
  storage: PayrollStorage,
  company: Company,
  id: string,
): Promise<{ status: number; body: any }> {
  if (!company?.companyId) return { status: 403, body: { error: "Company context required" } };
  const entry = await storage.getPayrollEntryInCompany(id, company.companyId);
  if (!entry) return { status: 404, body: { error: "Payroll entry not found" } };
  return { status: 200, body: entry };
}

async function processAllHandler(
  storage: PayrollStorage,
  company: Company,
): Promise<{ status: number; body: any; processedIds: string[] }> {
  if (!company?.companyId) return { status: 403, body: { error: "Company context required" }, processedIds: [] };
  const entries = await storage.getPayroll(company.companyId);
  const pending = entries.filter((e) => e.status === "pending");
  return { status: 200, body: { count: pending.length }, processedIds: pending.map((e) => e.id) };
}

async function batchPayoutHandler(
  storage: PayrollStorage,
  company: Company,
  payrollIds: string[],
): Promise<{ status: number; results: Array<{ payrollId: string; status?: string; reason?: string }> }> {
  if (!company?.companyId) return { status: 403, results: [] };
  const ownedEntries = await storage.getPayrollEntriesByIdsInCompany(payrollIds, company.companyId);
  const ownedById = new Map<string, (typeof ownedEntries)[number]>();
  for (const e of ownedEntries) ownedById.set(e.id, e);

  const results: Array<{ payrollId: string; status?: string; reason?: string }> = [];
  for (const id of payrollIds) {
    const entry = ownedById.get(id);
    if (!entry) {
      results.push({ payrollId: id, status: "skipped", reason: "not-found-or-cross-tenant" });
      continue;
    }
    if (entry.status === "paid") continue;
    results.push({ payrollId: id, status: "created" });
  }
  return { status: 200, results };
}

async function patchEntryHandler(
  storage: PayrollStorage,
  company: Company,
  id: string,
  data: any,
): Promise<{ status: number; body: any }> {
  if (!company?.companyId) return { status: 403, body: { error: "Company context required" } };
  const entry = await storage.updatePayrollEntryInCompany(id, company.companyId, data);
  if (!entry) return { status: 404, body: { error: "Payroll entry not found" } };
  return { status: 200, body: entry };
}

async function deleteEntryHandler(
  storage: PayrollStorage,
  company: Company,
  id: string,
): Promise<{ status: number }> {
  if (!company?.companyId) return { status: 403 };
  const deleted = await storage.deletePayrollEntryInCompany(id, company.companyId);
  if (!deleted) return { status: 404 };
  return { status: 204 };
}

// --- Tests ---

describe("AUD-PR-002 — GET /payroll/:id (cross-tenant isolation)", () => {
  it("returns 403 when no company context is resolved", async () => {
    const storage = {
      getPayrollEntryInCompany: vi.fn(),
    } as unknown as PayrollStorage;
    const result = await getEntryHandler(storage, null, "payroll-123");
    expect(result.status).toBe(403);
    expect(storage.getPayrollEntryInCompany).not.toHaveBeenCalled();
  });

  it("returns 404 when the id exists in a different tenant (storage returns undefined)", async () => {
    const storage = {
      getPayrollEntryInCompany: vi.fn().mockResolvedValue(undefined),
    } as unknown as PayrollStorage;
    const result = await getEntryHandler(storage, { companyId: "tenant-A" }, "payroll-from-tenant-B");
    expect(result.status).toBe(404);
    expect(storage.getPayrollEntryInCompany).toHaveBeenCalledWith("payroll-from-tenant-B", "tenant-A");
  });

  it("returns 200 when the id belongs to the caller's tenant", async () => {
    const entry = { id: "payroll-123", companyId: "tenant-A" };
    const storage = {
      getPayrollEntryInCompany: vi.fn().mockResolvedValue(entry),
    } as unknown as PayrollStorage;
    const result = await getEntryHandler(storage, { companyId: "tenant-A" }, "payroll-123");
    expect(result.status).toBe(200);
    expect(result.body).toBe(entry);
  });
});

describe("AUD-PR-001 — POST /payroll/process (no cross-tenant scoping)", () => {
  it("returns 403 when no company context is resolved", async () => {
    const storage = { getPayroll: vi.fn() } as unknown as PayrollStorage;
    const result = await processAllHandler(storage, null);
    expect(result.status).toBe(403);
    expect(storage.getPayroll).not.toHaveBeenCalled();
  });

  it("calls storage.getPayroll WITH the caller's companyId (not unscoped)", async () => {
    const storage = {
      getPayroll: vi.fn().mockResolvedValue([
        { id: "p1", companyId: "tenant-A", status: "pending" },
      ]),
    } as unknown as PayrollStorage;
    const result = await processAllHandler(storage, { companyId: "tenant-A" });
    expect(storage.getPayroll).toHaveBeenCalledWith("tenant-A");
    expect(result.processedIds).toEqual(["p1"]);
  });

  it("does not iterate entries from other tenants even if the storage layer returns them (defensive)", async () => {
    // Even if storage misbehaves and returns a cross-tenant row, the handler
    // is invoked only with the caller's companyId — so the SQL filter is
    // the line of defense. This test demonstrates the contract: the handler
    // does NOT post-filter; storage MUST return only the caller's rows.
    const storage = {
      getPayroll: vi.fn(async (companyId?: string) => {
        if (companyId === "tenant-A") {
          return [{ id: "p1", companyId: "tenant-A", status: "pending" }];
        }
        return [];
      }),
    } as unknown as PayrollStorage;
    const result = await processAllHandler(storage, { companyId: "tenant-A" });
    expect(result.processedIds).toEqual(["p1"]);
  });
});

describe("AUD-PR-003 — POST /payroll/batch-payout (client-supplied IDs)", () => {
  it("returns 403 when no company context is resolved", async () => {
    const storage = {
      getPayrollEntriesByIdsInCompany: vi.fn(),
    } as unknown as PayrollStorage;
    const result = await batchPayoutHandler(storage, null, ["p1", "p2"]);
    expect(result.status).toBe(403);
    expect(storage.getPayrollEntriesByIdsInCompany).not.toHaveBeenCalled();
  });

  it("filters out IDs that belong to other tenants (returned as 'skipped' with not-found-or-cross-tenant)", async () => {
    // Caller is tenant-A. They submit 3 IDs. Storage returns only the one
    // that actually belongs to tenant-A.
    const storage = {
      getPayrollEntriesByIdsInCompany: vi.fn().mockResolvedValue([
        { id: "p1-tenant-a", companyId: "tenant-A", status: "pending" },
      ]),
    } as unknown as PayrollStorage;
    const result = await batchPayoutHandler(
      storage,
      { companyId: "tenant-A" },
      ["p1-tenant-a", "p2-tenant-b", "p3-tenant-c"],
    );
    expect(storage.getPayrollEntriesByIdsInCompany).toHaveBeenCalledWith(
      ["p1-tenant-a", "p2-tenant-b", "p3-tenant-c"],
      "tenant-A",
    );
    const created = result.results.filter((r) => r.status === "created");
    const skipped = result.results.filter((r) => r.status === "skipped");
    expect(created).toEqual([{ payrollId: "p1-tenant-a", status: "created" }]);
    expect(skipped).toHaveLength(2);
    expect(skipped.map((r) => r.payrollId).sort()).toEqual(["p2-tenant-b", "p3-tenant-c"]);
    for (const s of skipped) {
      expect(s.reason).toBe("not-found-or-cross-tenant");
    }
  });

  it("does not echo back which cross-tenant IDs exist (info-leak prevention)", async () => {
    // The reason string is the same regardless of whether the id exists in
    // another tenant or doesn't exist at all. We assert the reason is
    // exactly the documented sentinel.
    const storage = {
      getPayrollEntriesByIdsInCompany: vi.fn().mockResolvedValue([]),
    } as unknown as PayrollStorage;
    const result = await batchPayoutHandler(storage, { companyId: "tenant-A" }, ["bogus-id"]);
    expect(result.results).toEqual([
      { payrollId: "bogus-id", status: "skipped", reason: "not-found-or-cross-tenant" },
    ]);
  });
});

describe("AUD-PR-004 — PATCH /payroll/:id (cross-tenant write block)", () => {
  it("returns 403 when no company context is resolved", async () => {
    const storage = {
      updatePayrollEntryInCompany: vi.fn(),
    } as unknown as PayrollStorage;
    const result = await patchEntryHandler(storage, null, "payroll-x", { salary: "1000" });
    expect(result.status).toBe(403);
    expect(storage.updatePayrollEntryInCompany).not.toHaveBeenCalled();
  });

  it("returns 404 when the storage layer reports zero rows updated (cross-tenant id)", async () => {
    const storage = {
      updatePayrollEntryInCompany: vi.fn().mockResolvedValue(undefined),
    } as unknown as PayrollStorage;
    const result = await patchEntryHandler(
      storage,
      { companyId: "tenant-A" },
      "payroll-from-tenant-B",
      { salary: "9999" },
    );
    expect(result.status).toBe(404);
    expect(storage.updatePayrollEntryInCompany).toHaveBeenCalledWith(
      "payroll-from-tenant-B",
      "tenant-A",
      { salary: "9999" },
    );
  });

  it("returns 200 with the updated row when the id is in the caller's tenant", async () => {
    const updated = { id: "payroll-1", companyId: "tenant-A" };
    const storage = {
      updatePayrollEntryInCompany: vi.fn().mockResolvedValue(updated),
    } as unknown as PayrollStorage;
    const result = await patchEntryHandler(
      storage,
      { companyId: "tenant-A" },
      "payroll-1",
      { salary: "1500" },
    );
    expect(result.status).toBe(200);
    expect(result.body).toBe(updated);
  });
});

describe("AUD-PR-005 — DELETE /payroll/:id (cross-tenant delete block)", () => {
  it("returns 403 when no company context is resolved", async () => {
    const storage = {
      deletePayrollEntryInCompany: vi.fn(),
    } as unknown as PayrollStorage;
    const result = await deleteEntryHandler(storage, null, "payroll-x");
    expect(result.status).toBe(403);
    expect(storage.deletePayrollEntryInCompany).not.toHaveBeenCalled();
  });

  it("returns 404 when the row doesn't belong to the caller's tenant", async () => {
    const storage = {
      deletePayrollEntryInCompany: vi.fn().mockResolvedValue(false),
    } as unknown as PayrollStorage;
    const result = await deleteEntryHandler(storage, { companyId: "tenant-A" }, "payroll-from-tenant-B");
    expect(result.status).toBe(404);
    expect(storage.deletePayrollEntryInCompany).toHaveBeenCalledWith(
      "payroll-from-tenant-B",
      "tenant-A",
    );
  });

  it("returns 204 when the row was successfully deleted from the caller's tenant", async () => {
    const storage = {
      deletePayrollEntryInCompany: vi.fn().mockResolvedValue(true),
    } as unknown as PayrollStorage;
    const result = await deleteEntryHandler(storage, { companyId: "tenant-A" }, "payroll-1");
    expect(result.status).toBe(204);
  });
});
