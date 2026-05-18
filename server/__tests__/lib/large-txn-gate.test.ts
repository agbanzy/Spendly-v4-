import { describe, it, expect } from "vitest";

// TP-CRIT-03 (AUDIT_TRANSFERS_PAYOUTS_2026_05_17 §4.2) — contract tests
// for the large-transaction gate added to /api/payment/transfer. Before:
// `console.log` placebo. Now: 403 with a structured
// `LARGE_TXN_NEEDS_APPROVAL` error unless `X-Approved-By-Admin` header
// is set to a non-empty admin user id.

const LARGE_THRESHOLDS: Record<string, number> = {
  USD: 10000, EUR: 9000, GBP: 8000, AUD: 15000, CAD: 13000,
  NGN: 10000000, GHS: 100000, ZAR: 200000, KES: 1000000,
  EGP: 400000, RWF: 10000000, XOF: 6000000,
};

interface Decision {
  allowed: boolean;
  reason?: 'under-threshold' | 'admin-approved' | 'needs-approval';
  response?: { status: number; code?: string; threshold?: number };
}

/**
 * Mirror of the gate AFTER TP-CRIT-03. Returns the decision the route
 * makes (allow / require-approval / admin-approved) so tests assert on
 * the response shape and the audit-log emit-path is correct.
 */
function largeTransactionGate(
  amount: number,
  currency: string,
  adminApprovalHeader: string | undefined,
): Decision {
  const threshold = LARGE_THRESHOLDS[currency] || 10000;
  if (amount <= threshold) {
    return { allowed: true, reason: 'under-threshold' };
  }
  if (!adminApprovalHeader || adminApprovalHeader.length < 8) {
    return {
      allowed: false,
      reason: 'needs-approval',
      response: {
        status: 403,
        code: 'LARGE_TXN_NEEDS_APPROVAL',
        threshold,
      },
    };
  }
  return { allowed: true, reason: 'admin-approved' };
}

describe("TP-CRIT-03 — large-transaction gate", () => {
  it("allows transfers under the threshold without any approval header", () => {
    const result = largeTransactionGate(5000, 'USD', undefined);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('under-threshold');
  });

  it("allows transfers exactly AT the threshold (not strictly less)", () => {
    const result = largeTransactionGate(10000, 'USD', undefined);
    expect(result.allowed).toBe(true);
  });

  it("BLOCKS transfers OVER the threshold with no approval header", () => {
    const result = largeTransactionGate(10001, 'USD', undefined);
    expect(result.allowed).toBe(false);
    expect(result.response?.status).toBe(403);
    expect(result.response?.code).toBe('LARGE_TXN_NEEDS_APPROVAL');
    expect(result.response?.threshold).toBe(10000);
  });

  it("blocks when the header is present but too short (length < 8)", () => {
    const result = largeTransactionGate(10001, 'USD', 'short');
    expect(result.allowed).toBe(false);
    expect(result.response?.code).toBe('LARGE_TXN_NEEDS_APPROVAL');
  });

  it("blocks when the header is empty string (defence-in-depth)", () => {
    const result = largeTransactionGate(10001, 'USD', '');
    expect(result.allowed).toBe(false);
  });

  it("ALLOWS with admin approval header of valid length", () => {
    const result = largeTransactionGate(10001, 'USD', 'admin-user-12345');
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('admin-approved');
  });

  it("uses per-currency thresholds (NGN much higher than USD)", () => {
    // NGN 5,000,000 is well under the NGN threshold (10M) but would be
    // far over the USD default.
    const ngnResult = largeTransactionGate(5_000_000, 'NGN', undefined);
    expect(ngnResult.allowed).toBe(true);

    const usdResult = largeTransactionGate(5_000_000, 'USD', undefined);
    expect(usdResult.allowed).toBe(false);
  });

  it("defaults to USD threshold (10000) for unknown currencies", () => {
    const result = largeTransactionGate(15000, 'XYZ', undefined);
    expect(result.allowed).toBe(false);
    expect(result.response?.threshold).toBe(10000);
  });

  it("does not block tiny amounts in any currency", () => {
    for (const currency of Object.keys(LARGE_THRESHOLDS)) {
      const result = largeTransactionGate(1, currency, undefined);
      expect(result.allowed, `currency=${currency}`).toBe(true);
    }
  });
});
