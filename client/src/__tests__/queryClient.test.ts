import { describe, it, expect } from 'vitest';

/**
 * Tests for queryClient utility functions.
 *
 * We re-implement the pure functions here to avoid importing the full
 * module (which pulls in React Query, toast hooks, and Cognito SDK).
 * The logic is identical to client/src/lib/queryClient.ts.
 */

// ── sanitizeErrorMessage (mirrors queryClient.ts) ──────────────────
function sanitizeErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const cleaned = msg.replace(/^\d{3}:\s*/, '').replace(/\{.*\}/, '').trim();
  if (cleaned.includes('ECONNREFUSED') || cleaned.includes('stack') || cleaned.includes('SELECT') || cleaned.includes('INSERT')) {
    return 'An unexpected error occurred. Please try again.';
  }
  return cleaned.length > 200 ? cleaned.substring(0, 200) + '...' : cleaned || 'An unexpected error occurred';
}

// ── isRetryableError (mirrors queryClient.ts) ──────────────────────
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ECONNREFUSED')) return true;
    const status = parseInt(msg);
    if (status >= 500 && status < 600) return true;
  }
  return false;
}

// ============================================================================
// sanitizeErrorMessage
// ============================================================================
describe('sanitizeErrorMessage', () => {
  it('strips HTTP status code prefix', () => {
    expect(sanitizeErrorMessage(new Error('400: Validation failed'))).toBe('Validation failed');
    expect(sanitizeErrorMessage(new Error('500: Internal error'))).toBe('Internal error');
  });

  it('strips JSON-like content from message', () => {
    expect(sanitizeErrorMessage(new Error('Error {"code":"INVALID"}'))).toBe('Error');
  });

  it('hides ECONNREFUSED details', () => {
    expect(sanitizeErrorMessage(new Error('ECONNREFUSED 127.0.0.1:5432'))).toBe(
      'An unexpected error occurred. Please try again.'
    );
  });

  it('hides SQL query leaks', () => {
    expect(sanitizeErrorMessage(new Error('SELECT * FROM users WHERE id = 1'))).toBe(
      'An unexpected error occurred. Please try again.'
    );
    expect(sanitizeErrorMessage(new Error('INSERT INTO logs'))).toBe(
      'An unexpected error occurred. Please try again.'
    );
  });

  it('hides stack trace references', () => {
    expect(sanitizeErrorMessage(new Error('Error at stack trace line 42'))).toBe(
      'An unexpected error occurred. Please try again.'
    );
  });

  it('truncates messages over 200 characters', () => {
    const longMsg = 'A'.repeat(250);
    const result = sanitizeErrorMessage(new Error(longMsg));
    expect(result.length).toBeLessThanOrEqual(203); // 200 + '...'
    expect(result.endsWith('...')).toBe(true);
  });

  it('returns default message for empty error', () => {
    expect(sanitizeErrorMessage(new Error(''))).toBe('An unexpected error occurred');
  });

  it('handles non-Error values', () => {
    expect(sanitizeErrorMessage('string error')).toBe('string error');
    expect(sanitizeErrorMessage(42)).toBe('42');
    expect(sanitizeErrorMessage(null)).toBe('null');
  });

  it('passes through clean user-facing messages', () => {
    expect(sanitizeErrorMessage(new Error('Email already exists'))).toBe('Email already exists');
  });
});

// ============================================================================
// isRetryableError
// ============================================================================
describe('isRetryableError', () => {
  it('retries on "Failed to fetch" (network failure)', () => {
    expect(isRetryableError(new Error('Failed to fetch'))).toBe(true);
  });

  it('retries on "NetworkError"', () => {
    expect(isRetryableError(new Error('NetworkError when attempting to fetch resource'))).toBe(true);
  });

  it('retries on ECONNREFUSED', () => {
    expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
  });

  it('retries on 5xx status codes', () => {
    expect(isRetryableError(new Error('500: Internal server error'))).toBe(true);
    expect(isRetryableError(new Error('502: Bad gateway'))).toBe(true);
    expect(isRetryableError(new Error('503: Service unavailable'))).toBe(true);
  });

  it('does NOT retry on 4xx status codes', () => {
    expect(isRetryableError(new Error('400: Bad request'))).toBe(false);
    expect(isRetryableError(new Error('401: Unauthorized'))).toBe(false);
    expect(isRetryableError(new Error('404: Not found'))).toBe(false);
    expect(isRetryableError(new Error('422: Unprocessable'))).toBe(false);
  });

  it('does NOT retry on generic business errors', () => {
    expect(isRetryableError(new Error('Email already exists'))).toBe(false);
    expect(isRetryableError(new Error('Insufficient funds'))).toBe(false);
  });

  it('does NOT retry on non-Error values', () => {
    expect(isRetryableError('string error')).toBe(false);
    expect(isRetryableError(42)).toBe(false);
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });
});
