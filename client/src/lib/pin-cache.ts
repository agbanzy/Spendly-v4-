// ── Transaction PIN Cache ────────────────────────────────────────
// Module-level cache for verified PINs. Avoids re-prompting on every
// sensitive action within a short window. Cleared on logout.

let _cachedPin: string | null = null;
let _pinExpiry = 0;
const PIN_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getCachedPin(): string | null {
  if (_cachedPin && Date.now() < _pinExpiry) return _cachedPin;
  _cachedPin = null;
  return null;
}

export function setCachedPin(pin: string) {
  _cachedPin = pin;
  _pinExpiry = Date.now() + PIN_TTL_MS;
}

export function clearPinCache() {
  _cachedPin = null;
  _pinExpiry = 0;
}

// PIN error codes returned by the server
export const PIN_ERROR_CODES = {
  PIN_SETUP_REQUIRED: 'PIN_SETUP_REQUIRED',
  PIN_REQUIRED: 'PIN_REQUIRED',
  PIN_INVALID: 'PIN_INVALID',
} as const;

/** Check if an error message contains a PIN-related server error code */
export function isPinError(errorMessage: string): string | null {
  if (errorMessage.includes(PIN_ERROR_CODES.PIN_SETUP_REQUIRED)) return PIN_ERROR_CODES.PIN_SETUP_REQUIRED;
  if (errorMessage.includes(PIN_ERROR_CODES.PIN_INVALID)) return PIN_ERROR_CODES.PIN_INVALID;
  if (errorMessage.includes(PIN_ERROR_CODES.PIN_REQUIRED)) return PIN_ERROR_CODES.PIN_REQUIRED;
  return null;
}
