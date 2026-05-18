import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withProviderRetry, isRetryable } from "../../lib/provider-retry";

// TP-HIGH-08 (AUDIT_TRANSFERS_PAYOUTS_2026_05_17 §4.4) — provider retry
// helper. Wraps Stripe / Paystack SDK calls; retries on transient errors
// (TLS reset, 5xx, network blips) without changing the idempotency key
// — combined with PR #25's payout-id-derived keys, retries dedup on
// the provider side.

describe("isRetryable — classifier", () => {
  it("returns true for network reset codes", () => {
    expect(isRetryable({ code: 'ECONNRESET' })).toBe(true);
    expect(isRetryable({ code: 'ETIMEDOUT' })).toBe(true);
    expect(isRetryable({ code: 'ENOTFOUND' })).toBe(true);
    expect(isRetryable({ code: 'EAI_AGAIN' })).toBe(true);
    expect(isRetryable({ code: 'EPIPE' })).toBe(true);
  });

  it("returns true for 5xx server errors", () => {
    expect(isRetryable({ statusCode: 500 })).toBe(true);
    expect(isRetryable({ statusCode: 502 })).toBe(true);
    expect(isRetryable({ status: 503 })).toBe(true);
    expect(isRetryable({ status: 599 })).toBe(true);
  });

  it("returns true for Stripe transient error types", () => {
    expect(isRetryable({ type: 'StripeConnectionError' })).toBe(true);
    expect(isRetryable({ type: 'StripeAPIError' })).toBe(true);
  });

  it("returns false for 4xx client errors", () => {
    expect(isRetryable({ statusCode: 400 })).toBe(false);
    expect(isRetryable({ statusCode: 401 })).toBe(false);
    expect(isRetryable({ statusCode: 403 })).toBe(false);
    expect(isRetryable({ statusCode: 404 })).toBe(false);
    expect(isRetryable({ statusCode: 422 })).toBe(false);
  });

  it("returns false for non-transient Stripe types", () => {
    expect(isRetryable({ type: 'StripeInvalidRequestError' })).toBe(false);
    expect(isRetryable({ type: 'StripeAuthenticationError' })).toBe(false);
    expect(isRetryable({ type: 'StripeCardError' })).toBe(false);
  });

  it("returns false for plain Error instances (validation, app-level)", () => {
    expect(isRetryable(new Error('Insufficient funds'))).toBe(false);
  });

  it("returns false for null / undefined", () => {
    expect(isRetryable(null)).toBe(false);
    expect(isRetryable(undefined)).toBe(false);
  });
});

describe("withProviderRetry — orchestration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the result without retrying on success", async () => {
    const fn = vi.fn().mockResolvedValue({ id: 'ok' });
    const promise = withProviderRetry('test', fn);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual({ id: 'ok' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on transient error (ECONNRESET) and succeeds on attempt 2", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('network'), { code: 'ECONNRESET' }))
      .mockResolvedValueOnce({ id: 'recovered' });
    const promise = withProviderRetry('test', fn);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual({ id: 'recovered' });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on 502 and succeeds on attempt 2", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('bad gateway'), { statusCode: 502 }))
      .mockResolvedValueOnce({ id: 'ok' });
    const promise = withProviderRetry('test', fn);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ id: 'ok' });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on 4xx (client error)", async () => {
    const err = Object.assign(new Error('bad request'), { statusCode: 400 });
    const fn = vi.fn().mockRejectedValue(err);
    // Non-retryable: rejects synchronously, no timer wait needed.
    await expect(withProviderRetry('test', fn)).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on plain Error (app-level, e.g. validation)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Insufficient funds'));
    // Non-retryable: rejects synchronously, no timer wait needed.
    await expect(withProviderRetry('test', fn)).rejects.toThrow('Insufficient funds');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gives up after attempts limit and throws the last error", async () => {
    const err = Object.assign(new Error('persistent 503'), { statusCode: 503 });
    const fn = vi.fn().mockRejectedValue(err);
    const promise = withProviderRetry('test', fn, { attempts: 3, backoffMs: 100 });
    // Attach the rejection handler immediately so vi.runAllTimersAsync
    // doesn't see it as an unhandled rejection while flushing the backoff.
    const assertion = expect(promise).rejects.toBe(err);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("waits backoffMs between attempts", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('e1'), { statusCode: 503 }))
      .mockResolvedValueOnce({ id: 'ok' });
    const promise = withProviderRetry('test', fn, { backoffMs: 5000 });
    // First attempt fires immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);
    // Advance just under the backoff — still only 1 call
    await vi.advanceTimersByTimeAsync(4999);
    expect(fn).toHaveBeenCalledTimes(1);
    // Cross the backoff boundary
    await vi.advanceTimersByTimeAsync(1);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ id: 'ok' });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// TP-HIGH-09 — claimWebhookForProcessing contract.
// Note: full DB-level enforcement is via processed_webhooks.event_id
// UNIQUE constraint (already in schema); this helper makes the
// INSERT-then-check pattern explicit so handlers don't have to wrap
// check-then-write themselves.

interface WebhookStub {
  eventId: string;
  provider: string;
  eventType: string;
}

function modelClaimWebhook(
  webhook: WebhookStub,
  processed: Set<string>,
): boolean {
  if (processed.has(webhook.eventId)) return false;
  processed.add(webhook.eventId);
  return true;
}

describe("TP-HIGH-09 — claimWebhookForProcessing contract", () => {
  it("returns true on first call (claim won)", () => {
    const processed = new Set<string>();
    const result = modelClaimWebhook(
      { eventId: 'evt_abc', provider: 'stripe', eventType: 'payment_intent.succeeded' },
      processed,
    );
    expect(result).toBe(true);
  });

  it("returns false on subsequent call with same eventId (claim lost)", () => {
    const processed = new Set<string>();
    modelClaimWebhook(
      { eventId: 'evt_abc', provider: 'stripe', eventType: 'payment_intent.succeeded' },
      processed,
    );
    const second = modelClaimWebhook(
      { eventId: 'evt_abc', provider: 'stripe', eventType: 'payment_intent.succeeded' },
      processed,
    );
    expect(second).toBe(false);
  });

  it("treats different eventIds as separate claims (even cross-provider)", () => {
    const processed = new Set<string>();
    const stripe = modelClaimWebhook(
      { eventId: 'evt_stripe', provider: 'stripe', eventType: 'transfer.paid' },
      processed,
    );
    const paystack = modelClaimWebhook(
      { eventId: 'trf_paystack', provider: 'paystack', eventType: 'transfer.success' },
      processed,
    );
    expect(stripe).toBe(true);
    expect(paystack).toBe(true);
  });
});
