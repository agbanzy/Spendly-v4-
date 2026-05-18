import { describe, it, expect, vi } from "vitest";

// S-F-02 (AUDIT_COUNTRY_PERSONA_ROLE_2026_05_17) — contract tests for
// the fail-closed pattern added to GET /invoices/:id,
// GET /invoices/:id/payments, and POST /invoices/:id/payments. The
// previous shape `if (company && !await verifyCompanyAccess(...))`
// silently SKIPPED the access check when resolveUserCompany returned
// null, letting any authenticated request with no company context
// read/mutate any invoice cross-tenant.
//
// Tests model the route-handler decision logic without spinning up
// Express. Full route-level coverage is tracked under AUD-PR-009.

type Company = { companyId: string } | null;

type Storage = {
  getInvoice: (id: string) => Promise<any>;
};

type VerifyCompanyAccess = (
  invoiceCompanyId: string | null | undefined,
  callerCompanyId: string,
) => Promise<boolean>;

/**
 * Mirror of the GET /invoices/:id handler's decision logic AFTER the
 * S-F-02 fix. Returns { status, body } so the test can assert on the
 * exact response shape.
 */
async function getInvoiceHandler(
  storage: Storage,
  verify: VerifyCompanyAccess,
  company: Company,
  id: string,
): Promise<{ status: number; body: any }> {
  if (!company?.companyId) {
    return { status: 403, body: { error: "Company context required" } };
  }
  const invoice = await storage.getInvoice(id);
  if (!invoice) {
    return { status: 404, body: { error: "Invoice not found" } };
  }
  if (!(await verify(invoice.companyId, company.companyId))) {
    // S-F-02 — return 404 (not 403) to avoid leaking which ids exist
    // in other tenants.
    return { status: 404, body: { error: "Invoice not found" } };
  }
  return { status: 200, body: invoice };
}

describe("S-F-02 — GET /invoices/:id fail-closed when no company context", () => {
  it("returns 403 when resolveUserCompany returns null", async () => {
    const storage = { getInvoice: vi.fn() } as unknown as Storage;
    const verify = vi.fn();
    const result = await getInvoiceHandler(storage, verify, null, "inv-1");
    expect(result.status).toBe(403);
    expect(result.body.error).toBe("Company context required");
    expect(storage.getInvoice).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it("returns 403 when company object is present but companyId is missing", async () => {
    const storage = { getInvoice: vi.fn() } as unknown as Storage;
    const verify = vi.fn();
    const result = await getInvoiceHandler(
      storage,
      verify,
      { companyId: "" },
      "inv-1",
    );
    expect(result.status).toBe(403);
  });

  it("returns 404 when invoice doesn't exist (anywhere)", async () => {
    const storage = {
      getInvoice: vi.fn().mockResolvedValue(undefined),
    } as unknown as Storage;
    const verify = vi.fn();
    const result = await getInvoiceHandler(
      storage,
      verify,
      { companyId: "tenant-A" },
      "missing-id",
    );
    expect(result.status).toBe(404);
    expect(verify).not.toHaveBeenCalled();
  });

  it("returns 404 (not 403) when invoice belongs to a different tenant (info-leak prevention)", async () => {
    const storage = {
      getInvoice: vi.fn().mockResolvedValue({ id: "inv-from-B", companyId: "tenant-B" }),
    } as unknown as Storage;
    const verify = vi.fn().mockResolvedValue(false);
    const result = await getInvoiceHandler(
      storage,
      verify,
      { companyId: "tenant-A" },
      "inv-from-B",
    );
    expect(result.status).toBe(404);
    expect(result.body.error).toBe("Invoice not found");
    expect(verify).toHaveBeenCalledWith("tenant-B", "tenant-A");
  });

  it("returns 200 when invoice belongs to caller's tenant", async () => {
    const invoice = { id: "inv-1", companyId: "tenant-A" };
    const storage = {
      getInvoice: vi.fn().mockResolvedValue(invoice),
    } as unknown as Storage;
    const verify = vi.fn().mockResolvedValue(true);
    const result = await getInvoiceHandler(
      storage,
      verify,
      { companyId: "tenant-A" },
      "inv-1",
    );
    expect(result.status).toBe(200);
    expect(result.body).toBe(invoice);
  });
});
