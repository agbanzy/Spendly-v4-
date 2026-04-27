import { describe, it, expect, vi } from "vitest";

// AUD-PR-010 / AUD-DB-010 Phase 1 — contract tests for the
// PATCH /api/admin/payout-flags endpoint's validation pipeline.
// Models the route handler's allowlist + boolean-shape check
// without spinning up Express.

const KNOWN_FLAGS = new Set<string>(['useStripeConnect']);

interface ValidatedResult {
  validated: Record<string, boolean>;
  rejected: Array<{ flag: string; reason: string }>;
}

function validateFlagsBody(input: unknown): ValidatedResult | { invalid: true } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { invalid: true };
  }
  const validated: Record<string, boolean> = {};
  const rejected: Array<{ flag: string; reason: string }> = [];
  for (const [k, v] of Object.entries(input)) {
    if (!KNOWN_FLAGS.has(k)) {
      rejected.push({ flag: k, reason: 'unknown-flag' });
      continue;
    }
    if (typeof v !== 'boolean') {
      rejected.push({ flag: k, reason: 'value-not-boolean' });
      continue;
    }
    validated[k] = v;
  }
  return { validated, rejected };
}

describe("PATCH /admin/payout-flags — body validation", () => {
  it("accepts a known flag with boolean value", () => {
    const r = validateFlagsBody({ useStripeConnect: true });
    expect((r as ValidatedResult).validated).toEqual({ useStripeConnect: true });
    expect((r as ValidatedResult).rejected).toEqual([]);
  });

  it("preserves the false value when explicitly disabling a flag", () => {
    const r = validateFlagsBody({ useStripeConnect: false });
    expect((r as ValidatedResult).validated).toEqual({ useStripeConnect: false });
  });

  it("rejects a flag not in the KNOWN_FLAGS allowlist", () => {
    const r = validateFlagsBody({ enableSomeFutureFeature: true });
    expect((r as ValidatedResult).validated).toEqual({});
    expect((r as ValidatedResult).rejected).toEqual([
      { flag: 'enableSomeFutureFeature', reason: 'unknown-flag' },
    ]);
  });

  it("rejects a known flag with a non-boolean value", () => {
    const r = validateFlagsBody({ useStripeConnect: 'true' as any });
    expect((r as ValidatedResult).validated).toEqual({});
    expect((r as ValidatedResult).rejected).toEqual([
      { flag: 'useStripeConnect', reason: 'value-not-boolean' },
    ]);
  });

  it("rejects a known flag with null value", () => {
    const r = validateFlagsBody({ useStripeConnect: null as any });
    expect((r as ValidatedResult).validated).toEqual({});
    expect((r as ValidatedResult).rejected[0].reason).toBe('value-not-boolean');
  });

  it("treats a body that's not an object as invalid (caller returns 400)", () => {
    expect(validateFlagsBody(null)).toEqual({ invalid: true });
    expect(validateFlagsBody([true])).toEqual({ invalid: true });
    expect(validateFlagsBody('useStripeConnect=true')).toEqual({ invalid: true });
    expect(validateFlagsBody(42)).toEqual({ invalid: true });
  });

  it("partial validity: keeps the good keys, surfaces the bad", () => {
    const r = validateFlagsBody({
      useStripeConnect: true,
      foo: false,
      bar: 'no',
    });
    expect((r as ValidatedResult).validated).toEqual({ useStripeConnect: true });
    expect((r as ValidatedResult).rejected.map((x) => x.flag).sort()).toEqual(['bar', 'foo']);
  });

  it("empty body produces empty results without throwing", () => {
    const r = validateFlagsBody({});
    expect((r as ValidatedResult).validated).toEqual({});
    expect((r as ValidatedResult).rejected).toEqual([]);
  });
});

// --- Storage helpers (model the storage.setCompanyPayoutFlags shape) ---

function setFlagsContract(flags: Record<string, boolean>): Record<string, boolean> {
  // Mirror of storage.setCompanyPayoutFlags — drops non-boolean values.
  const cleaned: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(flags)) {
    if (typeof v === 'boolean') cleaned[k] = v;
  }
  return cleaned;
}

describe("storage.setCompanyPayoutFlags — defence-in-depth", () => {
  it("retains booleans", () => {
    expect(setFlagsContract({ useStripeConnect: true, foo: false })).toEqual({
      useStripeConnect: true,
      foo: false,
    });
  });

  it("drops non-booleans without affecting the rest", () => {
    expect(
      setFlagsContract({ useStripeConnect: true, badKey: 'truthy' as any }),
    ).toEqual({ useStripeConnect: true });
  });

  it("returns an empty map when given an empty input", () => {
    expect(setFlagsContract({})).toEqual({});
  });
});
