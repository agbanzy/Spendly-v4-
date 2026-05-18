import { paymentLogger } from "../utils/paymentUtils";

/**
 * TP-HIGH-08 (AUDIT_TRANSFERS_PAYOUTS_2026_05_17 §4.4) — retry helper
 * for transient provider errors (TLS reset, 5xx, ECONNRESET, ETIMEDOUT).
 *
 * Two attempts max by default, 5-second exponential backoff. Combined
 * with the payout-id-derived idempotency key from PR #25 the retry is
 * safe — the provider returns the original transfer/payout, not a
 * duplicate.
 *
 * Kept in server/lib/ (not server/paymentService.ts) so the test
 * suite can import it without pulling in the storage + db modules.
 *
 * Usage (inside paymentService):
 *   const transfer = await withProviderRetry('paystack.initiateTransfer',
 *     () => paystackClient.initiateTransfer(...));
 */
export async function withProviderRetry<T>(
  operationName: string,
  fn: () => Promise<T>,
  opts: { attempts?: number; backoffMs?: number } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 2;
  const backoffMs = opts.backoffMs ?? 5000;
  let lastError: any;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (!isRetryable(err) || attempt === attempts) {
        if (attempt > 1) {
          paymentLogger.warn('provider_call_retry_exhausted', {
            operation: operationName,
            attempt,
            error: err.message,
            code: err.code,
          });
        }
        throw err;
      }
      paymentLogger.warn('provider_call_retrying', {
        operation: operationName,
        attempt,
        error: err.message,
        code: err.code,
        nextAttemptInMs: backoffMs,
      });
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  throw lastError;
}

/**
 * Heuristic for transient errors. Conservative — only retries when
 * clearly not a permanent rejection (4xx, validation, etc.).
 */
export function isRetryable(err: any): boolean {
  if (!err) return false;
  const code = err.code;
  const status = err.statusCode || err.status;
  if (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    code === 'EPIPE'
  ) return true;
  if (typeof status === 'number' && status >= 500 && status < 600) return true;
  if (err.type === 'StripeConnectionError' || err.type === 'StripeAPIError') return true;
  return false;
}
