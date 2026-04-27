import { describe, it, expect, vi } from "vitest";

// AUD-DB-007 follow-up — contract tests for the per-company daily
// payout limit override. Models the storage helper's shape validation
// and the gate's override-then-floor lookup.

// --- Shape validation (mirrors setCompanyDailyPayoutLimits in storage.ts) ---

function validateLimits(input: unknown): {
  cleaned: Record<string, number>;
  rejected: Array<{ currency: string; reason: string }>;
} {
  const cleaned: Record<string, number> = {};
  const rejected: Array<{ currency: string; reason: string }> = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { cleaned, rejected };
  }
  for (const [k, v] of Object.entries(input)) {
    if (!/^[A-Z]{3}$/.test(k)) {
      rejected.push({ currency: k, reason: 'currency-not-iso-3-letter' });
      continue;
    }
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
      rejected.push({ currency: k, reason: 'value-not-positive-number' });
      continue;
    }
    cleaned[k] = v as number;
  }
  return { cleaned, rejected };
}

describe("AUD-DB-007 follow-up — limit-map shape validation", () => {
  it("accepts a well-formed map", () => {
    const r = validateLimits({ USD: 200000, EUR: 180000, NGN: 200000000 });
    expect(r.cleaned).toEqual({ USD: 200000, EUR: 180000, NGN: 200000000 });
    expect(r.rejected).toEqual([]);
  });

  it("rejects lowercase currency codes", () => {
    const r = validateLimits({ usd: 200000 });
    expect(r.cleaned).toEqual({});
    expect(r.rejected[0]).toEqual({ currency: 'usd', reason: 'currency-not-iso-3-letter' });
  });

  it("rejects 4-letter currency codes", () => {
    const r = validateLimits({ USDD: 200000 });
    expect(r.cleaned).toEqual({});
    expect(r.rejected[0].reason).toBe('currency-not-iso-3-letter');
  });

  it("rejects negative values", () => {
    const r = validateLimits({ USD: -100 });
    expect(r.cleaned).toEqual({});
    expect(r.rejected[0].reason).toBe('value-not-positive-number');
  });

  it("rejects zero values (must be > 0)", () => {
    const r = validateLimits({ USD: 0 });
    expect(r.cleaned).toEqual({});
    expect(r.rejected[0].reason).toBe('value-not-positive-number');
  });

  it("rejects non-numeric values", () => {
    const r = validateLimits({ USD: 'one hundred thousand' as any });
    expect(r.cleaned).toEqual({});
    expect(r.rejected[0].reason).toBe('value-not-positive-number');
  });

  it("rejects NaN and Infinity", () => {
    const r1 = validateLimits({ USD: NaN });
    expect(r1.cleaned).toEqual({});
    const r2 = validateLimits({ USD: Number.POSITIVE_INFINITY });
    expect(r2.cleaned).toEqual({});
  });

  it("partial validity: keeps the good keys, rejects the bad", () => {
    const r = validateLimits({ USD: 200000, eur: 180000, NGN: -1, GBP: 80000 });
    expect(r.cleaned).toEqual({ USD: 200000, GBP: 80000 });
    expect(r.rejected.map((x) => x.currency).sort()).toEqual(['NGN', 'eur']);
  });

  it("rejects array bodies (caller passed wrong shape)", () => {
    const r = validateLimits([100, 200] as any);
    expect(r.cleaned).toEqual({});
    expect(r.rejected).toEqual([]);
  });

  it("rejects null body", () => {
    const r = validateLimits(null as any);
    expect(r.cleaned).toEqual({});
  });
});

// --- Override-then-floor gate (mirrors the route lookup) ---

const HARDCODED_FLOOR: Record<string, number> = {
  USD: 100000,
  NGN: 100000000,
  DEFAULT: 100000,
};

type Storage = {
  getCompanyDailyPayoutLimit: (companyId: string, currency: string) => Promise<number | undefined>;
  getDailyPayoutTotalForCompany: (companyId: string, currency: string) => Promise<number>;
};

async function gateWithOverride(
  storage: Storage,
  companyId: string,
  currency: string,
  requestedAmount: number,
): Promise<{ allowed: boolean; dailyLimit: number; source: 'override' | 'floor' | 'default' }> {
  const override = await storage.getCompanyDailyPayoutLimit(companyId, currency);
  let dailyLimit: number;
  let source: 'override' | 'floor' | 'default';
  if (typeof override === 'number') {
    dailyLimit = override;
    source = 'override';
  } else if (HARDCODED_FLOOR[currency]) {
    dailyLimit = HARDCODED_FLOOR[currency];
    source = 'floor';
  } else {
    dailyLimit = HARDCODED_FLOOR.DEFAULT;
    source = 'default';
  }
  const used = await storage.getDailyPayoutTotalForCompany(companyId, currency);
  return { allowed: used + requestedAmount <= dailyLimit, dailyLimit, source };
}

describe("AUD-DB-007 follow-up — override-then-floor gate", () => {
  it("uses the override when present (raises cap above floor)", async () => {
    const storage = {
      getCompanyDailyPayoutLimit: vi.fn().mockResolvedValue(500_000),
      getDailyPayoutTotalForCompany: vi.fn().mockResolvedValue(300_000),
    };
    const r = await gateWithOverride(storage, 'tenant-A', 'USD', 100_000);
    expect(r.source).toBe('override');
    expect(r.dailyLimit).toBe(500_000);
    expect(r.allowed).toBe(true); // 300k + 100k = 400k <= 500k
  });

  it("uses the override when present (lowers cap below floor)", async () => {
    const storage = {
      getCompanyDailyPayoutLimit: vi.fn().mockResolvedValue(50_000),
      getDailyPayoutTotalForCompany: vi.fn().mockResolvedValue(40_000),
    };
    const r = await gateWithOverride(storage, 'tenant-A', 'USD', 20_000);
    expect(r.source).toBe('override');
    expect(r.dailyLimit).toBe(50_000);
    expect(r.allowed).toBe(false); // 40k + 20k = 60k > 50k
  });

  it("falls back to the hardcoded floor when no override is set", async () => {
    const storage = {
      getCompanyDailyPayoutLimit: vi.fn().mockResolvedValue(undefined),
      getDailyPayoutTotalForCompany: vi.fn().mockResolvedValue(0),
    };
    const r = await gateWithOverride(storage, 'tenant-A', 'USD', 100_001);
    expect(r.source).toBe('floor');
    expect(r.dailyLimit).toBe(100_000);
    expect(r.allowed).toBe(false);
  });

  it("falls back to DEFAULT for an unknown currency without override", async () => {
    const storage = {
      getCompanyDailyPayoutLimit: vi.fn().mockResolvedValue(undefined),
      getDailyPayoutTotalForCompany: vi.fn().mockResolvedValue(0),
    };
    const r = await gateWithOverride(storage, 'tenant-A', 'ZZZ', 50_000);
    expect(r.source).toBe('default');
    expect(r.dailyLimit).toBe(100_000); // DEFAULT
    expect(r.allowed).toBe(true);
  });

  it("override of zero is treated as undefined (storage returns undefined for v <= 0)", async () => {
    // The storage helper documented to return undefined for v <= 0.
    // We model that here so the gate falls through to floor.
    const storage = {
      getCompanyDailyPayoutLimit: vi.fn().mockResolvedValue(undefined),
      getDailyPayoutTotalForCompany: vi.fn().mockResolvedValue(0),
    };
    const r = await gateWithOverride(storage, 'tenant-A', 'USD', 1);
    expect(r.source).toBe('floor');
  });

  it("allows hitting the override exactly", async () => {
    const storage = {
      getCompanyDailyPayoutLimit: vi.fn().mockResolvedValue(200_000),
      getDailyPayoutTotalForCompany: vi.fn().mockResolvedValue(150_000),
    };
    const r = await gateWithOverride(storage, 'tenant-A', 'USD', 50_000);
    expect(r.allowed).toBe(true);
    expect(r.dailyLimit).toBe(200_000);
  });

  it("blocks one cent over the override", async () => {
    const storage = {
      getCompanyDailyPayoutLimit: vi.fn().mockResolvedValue(200_000),
      getDailyPayoutTotalForCompany: vi.fn().mockResolvedValue(150_000),
    };
    const r = await gateWithOverride(storage, 'tenant-A', 'USD', 50_001);
    expect(r.allowed).toBe(false);
  });

  it("scopes by (companyId, currency) — different tenants don't poison each other's overrides", async () => {
    const storage = {
      getCompanyDailyPayoutLimit: vi.fn(async (companyId: string, currency: string) => {
        if (companyId === 'tenant-A' && currency === 'USD') return 50_000;
        if (companyId === 'tenant-B' && currency === 'USD') return 500_000;
        return undefined;
      }),
      getDailyPayoutTotalForCompany: vi.fn().mockResolvedValue(0),
    };
    const a = await gateWithOverride(storage, 'tenant-A', 'USD', 60_000);
    const b = await gateWithOverride(storage, 'tenant-B', 'USD', 60_000);
    expect(a.allowed).toBe(false); // tenant-A capped at 50k
    expect(b.allowed).toBe(true);  // tenant-B raised to 500k
  });
});
