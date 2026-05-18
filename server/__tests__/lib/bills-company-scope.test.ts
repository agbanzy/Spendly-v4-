import { describe, it, expect, vi } from "vitest";

// TP-CRIT-01 (AUDIT_TRANSFERS_PAYOUTS_2026_05_17 §4.2) — contract tests
// for the /api/bills/pay company-fallback path. The previous code:
//
//   const balances = await storage.getBalances();        // no arg → singleton
//   await storage.updateBalances({ [field]: newValue }); // no companyId → singleton write
//
// Now:
//
//   const balances = await storage.getBalances(userCompany.companyId);
//   await storage.updateBalances({...}, userCompany.companyId);
//
// Plus a bill-ownership check: refuses 404 if the bill belongs to a
// different tenant (closes the cross-tenant data-injection variant).

type Company = { companyId: string } | null;
type Bill = { id: string; companyId?: string; amount: string; currency?: string };
type Balances = {
  usd: string;
  local: string;
  localCurrency: string;
};

type Storage = {
  getBalances: (companyId?: string) => Promise<Balances>;
  updateBalances: (
    balances: Partial<Balances>,
    companyId?: string,
  ) => Promise<Balances>;
};

/**
 * Mirror of the company-fallback branch in /api/bills/pay AFTER TP-CRIT-01.
 * Returns the path the route would take so tests can assert each step.
 */
async function billCompanyFallbackPath(
  storage: Storage,
  userCompany: Company,
  bill: Bill,
  billAmount: number,
  billCurrency: string,
): Promise<
  | { status: 403; reason: 'no-company-context' }
  | { status: 404; reason: 'cross-tenant-bill' }
  | { status: 400; reason: 'no-balance-for-currency' }
  | { status: 400; reason: 'insufficient' }
  | { status: 200; debitedField: 'usd' | 'local'; debitedCompanyId: string }
> {
  if (!userCompany?.companyId) return { status: 403, reason: 'no-company-context' };

  // Bill ownership check
  if (bill.companyId && bill.companyId !== userCompany.companyId) {
    return { status: 404, reason: 'cross-tenant-bill' };
  }

  const balances = await storage.getBalances(userCompany.companyId);

  let field: 'usd' | 'local';
  if (billCurrency === 'USD') {
    field = 'usd';
  } else if (billCurrency === balances.localCurrency) {
    field = 'local';
  } else {
    return { status: 400, reason: 'no-balance-for-currency' };
  }

  const currentBalance = parseFloat(String(balances[field] || 0));
  if (currentBalance < billAmount) {
    return { status: 400, reason: 'insufficient' };
  }

  await storage.updateBalances(
    { [field]: String(currentBalance - billAmount) },
    userCompany.companyId,
  );

  return { status: 200, debitedField: field, debitedCompanyId: userCompany.companyId };
}

describe("TP-CRIT-01 — /api/bills/pay company-fallback path is tenant-scoped", () => {
  it("returns 403 when no company context (fail-closed)", async () => {
    const storage = {
      getBalances: vi.fn(),
      updateBalances: vi.fn(),
    } as unknown as Storage;
    const result = await billCompanyFallbackPath(
      storage,
      null,
      { id: 'b1', amount: '100' },
      100,
      'USD',
    );
    expect(result.status).toBe(403);
    expect((result as any).reason).toBe('no-company-context');
    expect(storage.getBalances).not.toHaveBeenCalled();
    expect(storage.updateBalances).not.toHaveBeenCalled();
  });

  it("returns 404 when bill belongs to a different tenant (info-leak prevention)", async () => {
    const storage = {
      getBalances: vi.fn(),
      updateBalances: vi.fn(),
    } as unknown as Storage;
    const result = await billCompanyFallbackPath(
      storage,
      { companyId: 'tenant-A' },
      { id: 'b1', companyId: 'tenant-B', amount: '100' },
      100,
      'USD',
    );
    expect(result.status).toBe(404);
    expect((result as any).reason).toBe('cross-tenant-bill');
    expect(storage.getBalances).not.toHaveBeenCalled();
  });

  it("scopes getBalances to the caller's companyId (NOT the singleton fall-through)", async () => {
    const storage = {
      getBalances: vi.fn().mockResolvedValue({
        usd: '1000',
        local: '500000',
        localCurrency: 'NGN',
      }),
      updateBalances: vi.fn().mockResolvedValue({}),
    } as unknown as Storage;
    await billCompanyFallbackPath(
      storage,
      { companyId: 'tenant-A' },
      { id: 'b1', amount: '100' },
      100,
      'USD',
    );
    expect(storage.getBalances).toHaveBeenCalledWith('tenant-A');
    expect(storage.getBalances).not.toHaveBeenCalledWith(); // no no-arg call
  });

  it("scopes updateBalances to the caller's companyId (closes the WRITE leak)", async () => {
    const storage = {
      getBalances: vi.fn().mockResolvedValue({
        usd: '1000',
        local: '500000',
        localCurrency: 'NGN',
      }),
      updateBalances: vi.fn().mockResolvedValue({}),
    } as unknown as Storage;
    const result = await billCompanyFallbackPath(
      storage,
      { companyId: 'tenant-A' },
      { id: 'b1', amount: '100' },
      100,
      'USD',
    );
    expect(result.status).toBe(200);
    expect((result as any).debitedCompanyId).toBe('tenant-A');
    expect(storage.updateBalances).toHaveBeenCalledWith(
      { usd: '900' },
      'tenant-A',
    );
  });

  it("debits the local field for non-USD currency matching localCurrency", async () => {
    const storage = {
      getBalances: vi.fn().mockResolvedValue({
        usd: '0',
        local: '500000',
        localCurrency: 'NGN',
      }),
      updateBalances: vi.fn().mockResolvedValue({}),
    } as unknown as Storage;
    const result = await billCompanyFallbackPath(
      storage,
      { companyId: 'tenant-NG' },
      { id: 'b1', amount: '50000', currency: 'NGN' },
      50000,
      'NGN',
    );
    expect(result.status).toBe(200);
    expect((result as any).debitedField).toBe('local');
    expect(storage.updateBalances).toHaveBeenCalledWith(
      { local: '450000' },
      'tenant-NG',
    );
  });

  it("returns 400 when currency doesn't match USD or localCurrency", async () => {
    const storage = {
      getBalances: vi.fn().mockResolvedValue({
        usd: '0',
        local: '0',
        localCurrency: 'NGN',
      }),
      updateBalances: vi.fn(),
    } as unknown as Storage;
    const result = await billCompanyFallbackPath(
      storage,
      { companyId: 'tenant-A' },
      { id: 'b1', amount: '100', currency: 'EUR' },
      100,
      'EUR',
    );
    expect(result.status).toBe(400);
    expect((result as any).reason).toBe('no-balance-for-currency');
    expect(storage.updateBalances).not.toHaveBeenCalled();
  });

  it("returns 400 insufficient when balance < bill", async () => {
    const storage = {
      getBalances: vi.fn().mockResolvedValue({
        usd: '50',
        local: '0',
        localCurrency: 'NGN',
      }),
      updateBalances: vi.fn(),
    } as unknown as Storage;
    const result = await billCompanyFallbackPath(
      storage,
      { companyId: 'tenant-A' },
      { id: 'b1', amount: '100', currency: 'USD' },
      100,
      'USD',
    );
    expect(result.status).toBe(400);
    expect((result as any).reason).toBe('insufficient');
    expect(storage.updateBalances).not.toHaveBeenCalled();
  });
});
