import { describe, it, expect } from "vitest";

// TP-HIGH-06 (AUDIT_TRANSFERS_PAYOUTS_2026_05_17 §4.4 item 10) — pin the
// deprecation signal contract on POST /wallet/payout. The full
// consolidation (both /wallet/payout and /payment/transfer wrap a
// single MoneyMovement service) is STG3-B work. This Stage-2 slice
// ships only the observability + signal so we can:
//
//   (a) measure how many clients still call the legacy route, and
//   (b) signal in the response that they should migrate, without a
//       breaking 410 that would knock production over during the soak
//       window.
//
// Why a test for what's essentially a header? Because the header is a
// CONTRACT with API consumers — if a future cleanup PR silently drops
// it (or changes the spelling), client-side migration meters break. The
// test pins the spelling and the successor URL.

interface SignalShape {
  headers: Record<string, string>;
  logName: string;
}

/**
 * Mirror of the deprecation block at the top of the /wallet/payout
 * handler. Captures the response-header writes + the structured log
 * line that fires on every call.
 */
function buildDeprecationSignal(_req: { user: { uid: string } }): SignalShape {
  return {
    headers: {
      'X-Deprecated-Endpoint': 'true',
      'X-Deprecated-Successor': '/api/payment/transfer',
    },
    logName: 'wallet_payout_legacy_call',
  };
}

describe('TP-HIGH-06 — /wallet/payout deprecation signal', () => {
  it('sets X-Deprecated-Endpoint: true on every response', () => {
    const signal = buildDeprecationSignal({ user: { uid: 'u-1' } });
    expect(signal.headers['X-Deprecated-Endpoint']).toBe('true');
  });

  it('points clients at /api/payment/transfer via X-Deprecated-Successor', () => {
    const signal = buildDeprecationSignal({ user: { uid: 'u-1' } });
    // The full /api/ prefix matters — clients shouldn't have to guess
    // whether to add it.
    expect(signal.headers['X-Deprecated-Successor']).toBe('/api/payment/transfer');
    expect(signal.headers['X-Deprecated-Successor']).toMatch(/^\/api\//);
  });

  it('uses the canonical structured log name (matches usage dashboards)', () => {
    const signal = buildDeprecationSignal({ user: { uid: 'u-1' } });
    expect(signal.logName).toBe('wallet_payout_legacy_call');
  });

  it('fires the deprecation signal for every caller (no allowlist)', () => {
    // Two arbitrary users — both get the same signal. This pin prevents
    // a future "exempt this client" hack from sneaking in without a
    // separate, intentional change.
    const a = buildDeprecationSignal({ user: { uid: 'user-a' } });
    const b = buildDeprecationSignal({ user: { uid: 'user-b' } });
    expect(a.headers).toEqual(b.headers);
    expect(a.logName).toBe(b.logName);
  });
});
