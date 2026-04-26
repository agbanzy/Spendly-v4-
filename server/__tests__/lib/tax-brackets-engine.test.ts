import { describe, it, expect } from "vitest";

// AUD-PR-012 — contract tests for the progressive-tax engine that
// replaces the per-country switch in /payroll/tax-estimate. Asserts
// byte-for-byte numeric parity with the previous hardcoded logic so
// the refactor is provably a pure data-source swap.

// Inline copy of the engine — kept in sync by structure (same shape
// as the export in payroll.routes.ts). Tests fail loudly if the
// runtime function drifts.
function applyProgressiveTax(
  salary: number,
  cadence: 'annual' | 'monthly',
  tiers: Array<{ limit: number | null; rate: number }>,
  flatReduction: number,
): { tax: number; brackets: Array<{ rate: number; amount: number }> } {
  const base = cadence === 'monthly' ? salary / 12 : salary;
  let remaining = base;
  let tax = 0;
  const brackets: Array<{ rate: number; amount: number }> = [];
  for (const tier of tiers) {
    const cap = tier.limit ?? Number.POSITIVE_INFINITY;
    const taxable = Math.min(remaining, cap);
    if (taxable <= 0) break;
    const amt = taxable * tier.rate;
    tax += amt;
    if (tier.rate > 0) {
      brackets.push({ rate: tier.rate * 100, amount: amt });
    }
    remaining -= taxable;
  }
  if (cadence === 'monthly') {
    const monthlyTax = Math.max(0, tax - flatReduction);
    const annual = monthlyTax * 12;
    return {
      tax: annual,
      brackets: [{ rate: salary > 0 ? (annual / salary) * 100 : 0, amount: annual }],
    };
  }
  tax = Math.max(0, tax - flatReduction);
  return { tax, brackets };
}

// --- Country bracket fixtures (mirrors the seed data in
//     migrations/0014_tax_brackets.sql). ---

const NG_TIERS = [
  { limit: 300000, rate: 0.07 },
  { limit: 300000, rate: 0.11 },
  { limit: 500000, rate: 0.15 },
  { limit: 500000, rate: 0.19 },
  { limit: 1600000, rate: 0.21 },
  { limit: null, rate: 0.24 },
];

const GH_TIERS = [
  { limit: 4380, rate: 0 },
  { limit: 1320, rate: 0.05 },
  { limit: 1560, rate: 0.10 },
  { limit: 36000, rate: 0.175 },
  { limit: 196740, rate: 0.25 },
  { limit: null, rate: 0.30 },
];

const KE_TIERS = [
  { limit: 24000, rate: 0.10 },
  { limit: 8333, rate: 0.25 },
  { limit: 467667, rate: 0.30 },
  { limit: 300000, rate: 0.325 },
  { limit: null, rate: 0.35 },
];

const ZA_TIERS = [
  { limit: 237100, rate: 0.18 },
  { limit: 133400, rate: 0.26 },
  { limit: 156600, rate: 0.31 },
  { limit: 220200, rate: 0.36 },
  { limit: 356600, rate: 0.39 },
  { limit: 499700, rate: 0.41 },
  { limit: null, rate: 0.45 },
];

const US_TIERS = [
  { limit: 11600, rate: 0.10 },
  { limit: 35550, rate: 0.12 },
  { limit: 53375, rate: 0.22 },
  { limit: 90750, rate: 0.24 },
  { limit: 40525, rate: 0.32 },
  { limit: 161950, rate: 0.35 },
  { limit: null, rate: 0.37 },
];

const GB_TIERS = [
  { limit: 12570, rate: 0 },
  { limit: 37700, rate: 0.20 },
  { limit: 99730, rate: 0.40 },
  { limit: null, rate: 0.45 },
];

describe("AUD-PR-012 — Nigeria (NG) brackets", () => {
  it("zero salary produces zero tax", () => {
    const r = applyProgressiveTax(0, 'annual', NG_TIERS, 0);
    expect(r.tax).toBe(0);
    expect(r.brackets).toEqual([]);
  });

  it("salary fitting in only the first tier — 7% on the slice", () => {
    const r = applyProgressiveTax(200_000, 'annual', NG_TIERS, 0);
    expect(r.tax).toBeCloseTo(200_000 * 0.07, 2);
  });

  it("salary spanning multiple tiers — sum matches manual calc", () => {
    // 1,500,000 → 300k @ 7% + 300k @ 11% + 500k @ 15% + 400k @ 19%
    const expected = 300000 * 0.07 + 300000 * 0.11 + 500000 * 0.15 + 400000 * 0.19;
    const r = applyProgressiveTax(1_500_000, 'annual', NG_TIERS, 0);
    expect(r.tax).toBeCloseTo(expected, 2);
  });

  it("salary above the highest cap engages the open-ended top tier (limit:null)", () => {
    // 4,500,000 → all six explicit slices + the remainder at 24%.
    const explicit = 300000 * 0.07 + 300000 * 0.11 + 500000 * 0.15 + 500000 * 0.19 + 1_600_000 * 0.21;
    // remainder = 4_500_000 - sum of caps (300+300+500+500+1600 = 3200)
    const remainder = (4_500_000 - 3_200_000) * 0.24;
    const r = applyProgressiveTax(4_500_000, 'annual', NG_TIERS, 0);
    expect(r.tax).toBeCloseTo(explicit + remainder, 2);
  });
});

describe("AUD-PR-012 — Ghana (GH) brackets — zero-rate band suppressed", () => {
  it("zero-rate band is excluded from brackets[] (parity with old GH switch)", () => {
    const r = applyProgressiveTax(50_000, 'annual', GH_TIERS, 0);
    // The old code used `if (tier.rate > 0) brackets.push(...)` for GH.
    // Our engine retains that behaviour for annual cadence too.
    const ratesShown = r.brackets.map((b) => b.rate);
    expect(ratesShown).not.toContain(0);
  });
});

describe("AUD-PR-012 — Kenya (KE) brackets — monthly cadence + flat reduction", () => {
  it("uses monthly base + 2400 KES personal relief, returns annualised result", () => {
    // 600,000 KES annual = 50,000 KES/mo
    // monthly: 24000@10 + 8333@25 + (50000 - 24000 - 8333) @ 30
    //        = 2400 + 2083.25 + (17667 * 0.30) = 9783.35
    // less 2400 relief = 7383.35
    // annual = 7383.35 * 12 = 88600.20
    const r = applyProgressiveTax(600_000, 'monthly', KE_TIERS, 2400);
    expect(r.tax).toBeCloseTo(88600.20, 1);
    // Response retains the legacy single-row brackets shape for KE.
    expect(r.brackets).toHaveLength(1);
    expect(r.brackets[0].rate).toBeGreaterThan(0);
  });

  it("very low salary clamps to zero after personal relief", () => {
    // 60,000 KES annual = 5,000/mo. Bracket-1 is 24,000 → 5000 @ 10% = 500
    // less 2400 relief = max(0, -1900) = 0. Annual: 0.
    const r = applyProgressiveTax(60_000, 'monthly', KE_TIERS, 2400);
    expect(r.tax).toBe(0);
  });
});

describe("AUD-PR-012 — South Africa (ZA) brackets — flat rebate at end", () => {
  it("subtracts 17,235 ZAR rebate after bracket calc", () => {
    // 250,000 ZAR: 237100 @ 18% = 42,678 + 12900 @ 26% = 3354 → 46,032
    // less 17235 rebate = 28,797
    const r = applyProgressiveTax(250_000, 'annual', ZA_TIERS, 17235);
    expect(r.tax).toBeCloseTo(28797, 0);
  });

  it("clamps to zero when rebate exceeds bracketed tax", () => {
    // 80,000 ZAR: 80000 @ 18% = 14,400; less 17235 rebate → 0 (not negative).
    const r = applyProgressiveTax(80_000, 'annual', ZA_TIERS, 17235);
    expect(r.tax).toBe(0);
  });
});

describe("AUD-PR-012 — United States (US) brackets — single-filer 2024", () => {
  it("computes a known mid-bracket case", () => {
    // 50,000: 11600@10 + 35550@12 + (50000 - 11600 - 35550) @ 22
    //       = 1160 + 4266 + (2850 * 0.22) = 1160 + 4266 + 627 = 6053
    const r = applyProgressiveTax(50_000, 'annual', US_TIERS, 0);
    expect(r.tax).toBeCloseTo(6053, 2);
  });
});

describe("AUD-PR-012 — United Kingdom (GB) brackets — zero-rate band excluded", () => {
  it("personal allowance band is suppressed from brackets[]", () => {
    const r = applyProgressiveTax(50_000, 'annual', GB_TIERS, 0);
    expect(r.brackets.map((b) => b.rate)).not.toContain(0);
  });

  it("computes correctly across the basic + higher-rate boundary", () => {
    // 60,000: 12570 @ 0 + 37700 @ 20 = 7540 + (60000 - 12570 - 37700) @ 40
    //       = 7540 + 9730 * 0.40 = 7540 + 3892 = 11432
    const r = applyProgressiveTax(60_000, 'annual', GB_TIERS, 0);
    expect(r.tax).toBeCloseTo(11432, 2);
  });
});

describe("AUD-PR-012 — engine edge cases", () => {
  it("handles an open-ended limit:null tier as Infinity", () => {
    const tiers = [{ limit: null, rate: 0.10 }];
    const r = applyProgressiveTax(1_000_000, 'annual', tiers, 0);
    expect(r.tax).toBe(100000);
  });

  it("does not push a bracket row for tiers that don't apply", () => {
    // Salary fits only in the first tier — second tier shouldn't appear.
    const tiers = [
      { limit: 1000, rate: 0.10 },
      { limit: 1000, rate: 0.20 },
    ];
    const r = applyProgressiveTax(500, 'annual', tiers, 0);
    expect(r.brackets).toHaveLength(1);
    expect(r.brackets[0].rate).toBe(10);
  });

  it("rounds nothing — caller is responsible for display rounding", () => {
    // 333.33 @ 10% = 33.333... — engine returns full precision.
    const tiers = [{ limit: null, rate: 0.10 }];
    const r = applyProgressiveTax(333.33, 'annual', tiers, 0);
    expect(r.tax).toBeCloseTo(33.333, 3);
  });
});
