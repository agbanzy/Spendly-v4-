import { describe, it, expect, vi } from "vitest";

// AUD-DB-007 — Sprint-3 contract tests for the per-company,
// per-currency daily payout limit. Models the gate's decision logic
// without spinning up Express. Real DB-backed integration tests under
// AUD-PR-009 (testcontainers) will follow.

// Mirror of the per-currency limits map in payouts.routes.ts.
const DAILY_PAYOUT_LIMITS: Record<string, number> = {
  USD: 100000,
  EUR: 90000,
  GBP: 80000,
  AUD: 150000,
  CAD: 130000,
  NGN: 100000000,
  GHS: 1000000,
  ZAR: 2000000,
  KES: 10000000,
  EGP: 4000000,
  RWF: 100000000,
  XOF: 60000000,
  DEFAULT: 100000,
};

type Storage = {
  getDailyPayoutTotalForCompany: (companyId: string, currency: string) => Promise<number>;
};

/**
 * Mirror of the limit gate in /payouts/:id/process and per-row in
 * /payouts/batch. Returns { allowed, reason?, dailyLimit, used } so
 * tests can assert both sides cleanly.
 */
async function dailyLimitGate(
  storage: Storage,
  companyId: string,
  currency: string,
  requestedAmount: number,
): Promise<{ allowed: boolean; dailyLimit: number; used: number; reason?: string }> {
  const dailyLimit = DAILY_PAYOUT_LIMITS[currency] ?? DAILY_PAYOUT_LIMITS.DEFAULT;
  const used = await storage.getDailyPayoutTotalForCompany(companyId, currency);
  if (used + requestedAmount > dailyLimit) {
    return { allowed: false, dailyLimit, used, reason: 'daily-limit-exceeded' };
  }
  return { allowed: true, dailyLimit, used };
}

describe("AUD-DB-007 — daily payout limit gate", () => {
  it("allows a payout well under the limit", async () => {
    const storage = {
      getDailyPayoutTotalForCompany: vi.fn().mockResolvedValue(1000),
    };
    const result = await dailyLimitGate(storage, 'tenant-A', 'USD', 5000);
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(1000);
    expect(result.dailyLimit).toBe(100000);
  });

  it("blocks when the new amount + used would exceed the limit", async () => {
    const storage = {
      getDailyPayoutTotalForCompany: vi.fn().mockResolvedValue(99000),
    };
    const result = await dailyLimitGate(storage, 'tenant-A', 'USD', 2000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('daily-limit-exceeded');
    expect(result.used).toBe(99000);
    expect(result.dailyLimit).toBe(100000);
  });

  it("allows exactly hitting the limit (used + amount === limit)", async () => {
    const storage = {
      getDailyPayoutTotalForCompany: vi.fn().mockResolvedValue(99000),
    };
    const result = await dailyLimitGate(storage, 'tenant-A', 'USD', 1000);
    expect(result.allowed).toBe(true);
    expect(result.used + 1000).toBe(result.dailyLimit);
  });

  it("blocks when even a single dollar would tip over the limit", async () => {
    const storage = {
      getDailyPayoutTotalForCompany: vi.fn().mockResolvedValue(100000),
    };
    const result = await dailyLimitGate(storage, 'tenant-A', 'USD', 1);
    expect(result.allowed).toBe(false);
  });

  it("uses the per-currency limit (NGN gets a much higher cap)", async () => {
    const storage = {
      getDailyPayoutTotalForCompany: vi.fn().mockResolvedValue(50_000_000),
    };
    const result = await dailyLimitGate(storage, 'tenant-A', 'NGN', 49_000_000);
    expect(result.allowed).toBe(true);
    expect(result.dailyLimit).toBe(100_000_000);
  });

  it("falls back to DEFAULT for unknown currencies", async () => {
    const storage = {
      getDailyPayoutTotalForCompany: vi.fn().mockResolvedValue(0),
    };
    const result = await dailyLimitGate(storage, 'tenant-A', 'ZZZ', 100001);
    expect(result.allowed).toBe(false);
    expect(result.dailyLimit).toBe(100000); // DEFAULT
  });

  it("scopes the running total to (companyId, currency) — different tenants don't poison each other", async () => {
    // Storage returns 99000 only for tenant-A USD. Tenant-B USD sees 0.
    const storage = {
      getDailyPayoutTotalForCompany: vi.fn(async (companyId: string, currency: string) => {
        if (companyId === 'tenant-A' && currency === 'USD') return 99000;
        return 0;
      }),
    };
    const a = await dailyLimitGate(storage, 'tenant-A', 'USD', 2000);
    const b = await dailyLimitGate(storage, 'tenant-B', 'USD', 50000);
    expect(a.allowed).toBe(false);
    expect(b.allowed).toBe(true);
  });

  it("scopes by currency too — USD usage doesn't burn through the EUR limit", async () => {
    const storage = {
      getDailyPayoutTotalForCompany: vi.fn(async (companyId: string, currency: string) => {
        if (companyId === 'tenant-A' && currency === 'USD') return 99000;
        return 0; // EUR running total is fresh
      }),
    };
    const usd = await dailyLimitGate(storage, 'tenant-A', 'USD', 2000);
    const eur = await dailyLimitGate(storage, 'tenant-A', 'EUR', 80000);
    expect(usd.allowed).toBe(false);
    expect(eur.allowed).toBe(true);
  });
});

describe("AUD-DB-007 — DAILY_PAYOUT_LIMITS map shape", () => {
  it("includes a DEFAULT fallback", () => {
    expect(DAILY_PAYOUT_LIMITS.DEFAULT).toBeGreaterThan(0);
  });

  it("includes USD, EUR, GBP, NGN, GHS, ZAR, KES at minimum", () => {
    const required = ['USD', 'EUR', 'GBP', 'NGN', 'GHS', 'ZAR', 'KES'];
    for (const c of required) {
      expect(DAILY_PAYOUT_LIMITS[c]).toBeGreaterThan(0);
    }
  });

  it("African-currency limits are higher than USD (because the unit is smaller)", () => {
    expect(DAILY_PAYOUT_LIMITS.NGN).toBeGreaterThan(DAILY_PAYOUT_LIMITS.USD);
    expect(DAILY_PAYOUT_LIMITS.KES).toBeGreaterThan(DAILY_PAYOUT_LIMITS.USD);
  });
});
