import { describe, it, expect, vi } from "vitest";

// AUD-PR-010 / AUD-DB-010 Phase 1 — contract tests for the Stripe
// Connect parallel-write gate. The implementation is in:
//   - server/routes/payouts.routes.ts (gate resolution)
//   - server/storage.ts (helpers for stripeConnectAccountId + flags)
//   - server/webhookHandlers.ts:handleAccountUpdated (status mapping)
//
// These tests model the gate's decision logic without spinning up
// Express. Real route-level integration follows once a pilot tenant
// is selected per STRIPE_CONNECT_MIGRATION_PLAN.md.

// --- Gate decision: which stripeAccountId gets passed to paymentService ---

interface Destination {
  providerRecipientId?: string;
  stripeConnectAccountId?: string;
}

interface PayoutFlags {
  useStripeConnect?: boolean;
  [k: string]: boolean | undefined;
}

/**
 * Mirror of the resolution logic in payouts.routes.ts:
 *   const useStripeConnect =
 *     payoutFlags.useStripeConnect === true &&
 *     typeof destination.stripeConnectAccountId === 'string' &&
 *     destination.stripeConnectAccountId.length > 0;
 *   const resolvedStripeAccountId = useStripeConnect
 *     ? destination.stripeConnectAccountId
 *     : destination.providerRecipientId;
 */
function resolveStripeAccountId(
  destination: Destination,
  flags: PayoutFlags,
): { useStripeConnect: boolean; resolved: string | undefined } {
  const useStripeConnect =
    flags.useStripeConnect === true &&
    typeof destination.stripeConnectAccountId === 'string' &&
    destination.stripeConnectAccountId.length > 0;
  const resolved = useStripeConnect
    ? destination.stripeConnectAccountId
    : destination.providerRecipientId;
  return { useStripeConnect, resolved };
}

describe("Stripe Connect gate — both signals required", () => {
  it("uses Connect when flag=true AND destination has stripeConnectAccountId", () => {
    const r = resolveStripeAccountId(
      { stripeConnectAccountId: 'acct_new', providerRecipientId: 'acct_legacy' },
      { useStripeConnect: true },
    );
    expect(r.useStripeConnect).toBe(true);
    expect(r.resolved).toBe('acct_new');
  });

  it("falls back to legacy when flag=true but stripeConnectAccountId is empty", () => {
    const r = resolveStripeAccountId(
      { stripeConnectAccountId: '', providerRecipientId: 'acct_legacy' },
      { useStripeConnect: true },
    );
    expect(r.useStripeConnect).toBe(false);
    expect(r.resolved).toBe('acct_legacy');
  });

  it("falls back to legacy when flag=true but stripeConnectAccountId is undefined", () => {
    const r = resolveStripeAccountId(
      { providerRecipientId: 'acct_legacy' },
      { useStripeConnect: true },
    );
    expect(r.useStripeConnect).toBe(false);
    expect(r.resolved).toBe('acct_legacy');
  });

  it("falls back to legacy when stripeConnectAccountId is set but flag is false", () => {
    const r = resolveStripeAccountId(
      { stripeConnectAccountId: 'acct_new', providerRecipientId: 'acct_legacy' },
      { useStripeConnect: false },
    );
    expect(r.useStripeConnect).toBe(false);
    expect(r.resolved).toBe('acct_legacy');
  });

  it("falls back to legacy when stripeConnectAccountId is set but flag is missing", () => {
    const r = resolveStripeAccountId(
      { stripeConnectAccountId: 'acct_new', providerRecipientId: 'acct_legacy' },
      {},
    );
    expect(r.useStripeConnect).toBe(false);
    expect(r.resolved).toBe('acct_legacy');
  });

  it("returns undefined when neither field is set (paymentService falls through to bank-token path)", () => {
    const r = resolveStripeAccountId({}, { useStripeConnect: true });
    expect(r.useStripeConnect).toBe(false);
    expect(r.resolved).toBeUndefined();
  });
});

// --- account.updated → status mapping (mirrors handleAccountUpdated) ---

interface StripeAccountSnapshot {
  deleted?: boolean;
  payouts_enabled?: boolean;
  charges_enabled?: boolean;
  requirements?: { disabled_reason?: string | null };
}

function mapAccountStatus(
  account: StripeAccountSnapshot,
): 'pending' | 'verified' | 'restricted' | 'disabled' {
  if (account.deleted === true) return 'disabled';
  if (account.payouts_enabled === true) return 'verified';
  if (account.requirements?.disabled_reason) return 'restricted';
  return 'pending';
}

describe("Stripe Connect account.updated → status mapping", () => {
  it("payouts_enabled=true maps to verified", () => {
    expect(mapAccountStatus({ payouts_enabled: true })).toBe('verified');
  });

  it("disabled_reason set maps to restricted", () => {
    expect(
      mapAccountStatus({
        payouts_enabled: false,
        requirements: { disabled_reason: 'requirements.past_due' },
      }),
    ).toBe('restricted');
  });

  it("deleted=true takes priority over everything", () => {
    expect(
      mapAccountStatus({
        deleted: true,
        payouts_enabled: true,
        charges_enabled: true,
      }),
    ).toBe('disabled');
  });

  it("nothing set yet maps to pending", () => {
    expect(mapAccountStatus({})).toBe('pending');
  });

  it("disabled_reason being null (not absent) is treated as no reason", () => {
    expect(
      mapAccountStatus({
        payouts_enabled: false,
        requirements: { disabled_reason: null },
      }),
    ).toBe('pending');
  });

  it("payouts_enabled false but charges_enabled true is still pending (Express not done)", () => {
    expect(
      mapAccountStatus({
        payouts_enabled: false,
        charges_enabled: true,
      }),
    ).toBe('pending');
  });
});

// --- setCompanyPayoutFlags shape validation ---

function validateFlags(input: unknown): { cleaned: Record<string, boolean>; rejected: string[] } {
  const cleaned: Record<string, boolean> = {};
  const rejected: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { cleaned, rejected };
  }
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === 'boolean') {
      cleaned[k] = v;
    } else {
      rejected.push(k);
    }
  }
  return { cleaned, rejected };
}

describe("Stripe Connect — payoutFlags shape validation", () => {
  it("accepts boolean values", () => {
    const r = validateFlags({ useStripeConnect: true, foo: false });
    expect(r.cleaned).toEqual({ useStripeConnect: true, foo: false });
    expect(r.rejected).toEqual([]);
  });

  it("rejects non-boolean values", () => {
    const r = validateFlags({ useStripeConnect: 'yes' as any });
    expect(r.cleaned).toEqual({});
    expect(r.rejected).toEqual(['useStripeConnect']);
  });

  it("rejects null values", () => {
    const r = validateFlags({ useStripeConnect: null as any });
    expect(r.cleaned).toEqual({});
    expect(r.rejected).toEqual(['useStripeConnect']);
  });

  it("rejects array body", () => {
    const r = validateFlags([true] as any);
    expect(r.cleaned).toEqual({});
    expect(r.rejected).toEqual([]);
  });

  it("rejects null body", () => {
    const r = validateFlags(null as any);
    expect(r.cleaned).toEqual({});
  });

  it("preserves false values (matters for explicitly disabling a previously-enabled flag)", () => {
    const r = validateFlags({ useStripeConnect: false });
    expect(r.cleaned).toEqual({ useStripeConnect: false });
  });
});
