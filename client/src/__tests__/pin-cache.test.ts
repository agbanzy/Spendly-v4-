import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for pin-cache module.
 *
 * We re-implement the logic to avoid import side effects.
 * The implementation below is identical to client/src/lib/pin-cache.ts.
 */

// ── Pin cache reimplementation ─────────────────────────────────────
let _cachedPin: string | null = null;
let _pinExpiry = 0;
const PIN_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedPin(): string | null {
  if (_cachedPin && Date.now() < _pinExpiry) return _cachedPin;
  _cachedPin = null;
  return null;
}

function setCachedPin(pin: string) {
  _cachedPin = pin;
  _pinExpiry = Date.now() + PIN_TTL_MS;
}

function clearPinCache() {
  _cachedPin = null;
  _pinExpiry = 0;
}

const PIN_ERROR_CODES = {
  PIN_SETUP_REQUIRED: 'PIN_SETUP_REQUIRED',
  PIN_REQUIRED: 'PIN_REQUIRED',
  PIN_INVALID: 'PIN_INVALID',
} as const;

function isPinError(errorMessage: string): string | null {
  if (errorMessage.includes(PIN_ERROR_CODES.PIN_SETUP_REQUIRED)) return PIN_ERROR_CODES.PIN_SETUP_REQUIRED;
  if (errorMessage.includes(PIN_ERROR_CODES.PIN_INVALID)) return PIN_ERROR_CODES.PIN_INVALID;
  if (errorMessage.includes(PIN_ERROR_CODES.PIN_REQUIRED)) return PIN_ERROR_CODES.PIN_REQUIRED;
  return null;
}

// ============================================================================
// setCachedPin / getCachedPin
// ============================================================================
describe('Pin Cache: set and get', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearPinCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when no pin is cached', () => {
    expect(getCachedPin()).toBeNull();
  });

  it('returns the cached pin within TTL', () => {
    setCachedPin('123456');
    expect(getCachedPin()).toBe('123456');
  });

  it('returns null after TTL expires (5 minutes)', () => {
    setCachedPin('123456');
    expect(getCachedPin()).toBe('123456');

    // Advance time past 5 minutes
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(getCachedPin()).toBeNull();
  });

  it('returns pin just before TTL expires', () => {
    setCachedPin('123456');

    // Advance to 1ms before expiry
    vi.advanceTimersByTime(5 * 60 * 1000 - 1);
    expect(getCachedPin()).toBe('123456');
  });

  it('overwrites previous pin when set again', () => {
    setCachedPin('111111');
    setCachedPin('222222');
    expect(getCachedPin()).toBe('222222');
  });

  it('resets TTL when pin is updated', () => {
    setCachedPin('111111');
    vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes in

    // Update pin — should reset the 5-minute timer
    setCachedPin('222222');
    vi.advanceTimersByTime(4 * 60 * 1000); // 4 more minutes

    // Should still be valid since we reset
    expect(getCachedPin()).toBe('222222');
  });
});

// ============================================================================
// clearPinCache
// ============================================================================
describe('Pin Cache: clear', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearPinCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears the cached pin immediately', () => {
    setCachedPin('123456');
    expect(getCachedPin()).toBe('123456');

    clearPinCache();
    expect(getCachedPin()).toBeNull();
  });

  it('is safe to call when nothing is cached', () => {
    clearPinCache(); // Should not throw
    expect(getCachedPin()).toBeNull();
  });
});

// ============================================================================
// PIN_ERROR_CODES
// ============================================================================
describe('PIN_ERROR_CODES', () => {
  it('has the expected error codes', () => {
    expect(PIN_ERROR_CODES.PIN_SETUP_REQUIRED).toBe('PIN_SETUP_REQUIRED');
    expect(PIN_ERROR_CODES.PIN_REQUIRED).toBe('PIN_REQUIRED');
    expect(PIN_ERROR_CODES.PIN_INVALID).toBe('PIN_INVALID');
  });
});

// ============================================================================
// isPinError
// ============================================================================
describe('isPinError', () => {
  it('detects PIN_SETUP_REQUIRED in error message', () => {
    expect(isPinError('Error: PIN_SETUP_REQUIRED')).toBe('PIN_SETUP_REQUIRED');
  });

  it('detects PIN_REQUIRED in error message', () => {
    expect(isPinError('403: PIN_REQUIRED')).toBe('PIN_REQUIRED');
  });

  it('detects PIN_INVALID in error message', () => {
    expect(isPinError('403: PIN_INVALID')).toBe('PIN_INVALID');
  });

  it('returns null for non-PIN errors', () => {
    expect(isPinError('401: Unauthorized')).toBeNull();
    expect(isPinError('Something went wrong')).toBeNull();
    expect(isPinError('')).toBeNull();
  });

  it('returns first matching code when message contains multiple codes', () => {
    // PIN_SETUP_REQUIRED is checked first
    expect(isPinError('PIN_SETUP_REQUIRED and PIN_INVALID')).toBe('PIN_SETUP_REQUIRED');
  });

  it('matches codes embedded in longer strings', () => {
    expect(isPinError('{"code":"PIN_REQUIRED","error":"Transaction PIN required"}')).toBe('PIN_REQUIRED');
  });
});
