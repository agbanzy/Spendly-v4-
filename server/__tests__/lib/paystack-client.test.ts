import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateTransferDetails,
  validateStripeBankDetails,
  getPaystackPublicKey,
} from '../../paystackClient';

// ============================================================================
// isRetryable logic (mirrors the private function in paystackClient.ts)
// ============================================================================
function isRetryable(error: any, statusCode?: number): boolean {
  if (error.name === 'AbortError' || error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') return true;
  if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) return true;
  if (statusCode && statusCode >= 500) return true;
  return false;
}

describe('isRetryable', () => {
  it('returns true for AbortError (timeout)', () => {
    const err = new Error('Request aborted');
    err.name = 'AbortError';
    expect(isRetryable(err)).toBe(true);
  });

  it('returns true for ECONNRESET', () => {
    const err: any = new Error('Connection reset');
    err.code = 'ECONNRESET';
    expect(isRetryable(err)).toBe(true);
  });

  it('returns true for ECONNREFUSED', () => {
    const err: any = new Error('Connection refused');
    err.code = 'ECONNREFUSED';
    expect(isRetryable(err)).toBe(true);
  });

  it('returns true for "Failed to fetch" message', () => {
    expect(isRetryable(new Error('Failed to fetch'))).toBe(true);
  });

  it('returns true for "NetworkError" message', () => {
    expect(isRetryable(new Error('NetworkError when attempting to fetch'))).toBe(true);
  });

  it('returns true for 5xx status codes', () => {
    expect(isRetryable(new Error('Server error'), 500)).toBe(true);
    expect(isRetryable(new Error('Server error'), 502)).toBe(true);
    expect(isRetryable(new Error('Server error'), 503)).toBe(true);
  });

  it('returns false for 4xx status codes', () => {
    expect(isRetryable(new Error('Bad request'), 400)).toBe(false);
    expect(isRetryable(new Error('Unauthorized'), 401)).toBe(false);
    expect(isRetryable(new Error('Not found'), 404)).toBe(false);
  });

  it('returns false for generic errors without retryable indicators', () => {
    expect(isRetryable(new Error('Validation failed'))).toBe(false);
    expect(isRetryable(new Error('Invalid account'))).toBe(false);
  });
});

// ============================================================================
// getPaystackPublicKey
// ============================================================================
describe('getPaystackPublicKey', () => {
  const originalEnv = process.env.VITE_PAYSTACK_PUBLIC_KEY;

  beforeEach(() => {
    delete process.env.VITE_PAYSTACK_PUBLIC_KEY;
  });

  afterAll(() => {
    if (originalEnv) {
      process.env.VITE_PAYSTACK_PUBLIC_KEY = originalEnv;
    }
  });

  it('throws if VITE_PAYSTACK_PUBLIC_KEY is not set', () => {
    expect(() => getPaystackPublicKey()).toThrow('VITE_PAYSTACK_PUBLIC_KEY');
  });

  it('returns the key when set', () => {
    process.env.VITE_PAYSTACK_PUBLIC_KEY = 'pk_test_123';
    expect(getPaystackPublicKey()).toBe('pk_test_123');
  });
});

// ============================================================================
// validateTransferDetails — Nigerian (NUBAN)
// ============================================================================
describe('validateTransferDetails: Nigeria (NG)', () => {
  it('accepts valid 10-digit account number with 3-digit bank code', () => {
    const result = validateTransferDetails('NG', '0123456789', '058');
    expect(result.valid).toBe(true);
  });

  it('rejects account number that is not 10 digits', () => {
    expect(validateTransferDetails('NG', '012345', '058').valid).toBe(false);
    expect(validateTransferDetails('NG', '01234567890', '058').valid).toBe(false);
  });

  it('rejects bank code that is not 3 digits', () => {
    expect(validateTransferDetails('NG', '0123456789', '05').valid).toBe(false);
    expect(validateTransferDetails('NG', '0123456789', '0583').valid).toBe(false);
  });

  it('rejects empty account number', () => {
    const result = validateTransferDetails('NG', '', '058');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Account number is required');
  });

  it('rejects empty bank code', () => {
    const result = validateTransferDetails('NG', '0123456789', '');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Bank code is required');
  });

  it('is case-insensitive for country code', () => {
    expect(validateTransferDetails('ng', '0123456789', '058').valid).toBe(true);
  });
});

// ============================================================================
// validateTransferDetails — Ghana (GH)
// ============================================================================
describe('validateTransferDetails: Ghana (GH)', () => {
  it('accepts 13-digit account number', () => {
    expect(validateTransferDetails('GH', '1234567890123', '001').valid).toBe(true);
  });

  it('accepts 10-digit account number', () => {
    expect(validateTransferDetails('GH', '1234567890', '001').valid).toBe(true);
  });

  it('rejects account number shorter than 10 digits', () => {
    expect(validateTransferDetails('GH', '123456789', '001').valid).toBe(false);
  });
});

// ============================================================================
// validateTransferDetails — South Africa (ZA)
// ============================================================================
describe('validateTransferDetails: South Africa (ZA)', () => {
  it('accepts valid account and branch code', () => {
    expect(validateTransferDetails('ZA', '1234567890', '123456').valid).toBe(true);
  });

  it('rejects invalid branch code (not 6 digits)', () => {
    expect(validateTransferDetails('ZA', '1234567890', '12345').valid).toBe(false);
  });
});

// ============================================================================
// validateTransferDetails — Kenya (KE) Mobile Money
// ============================================================================
describe('validateTransferDetails: Kenya (KE)', () => {
  it('accepts valid M-Pesa number starting with 254', () => {
    expect(validateTransferDetails('KE', '254712345678', 'MPESA').valid).toBe(true);
  });

  it('accepts valid M-Pesa number starting with 07', () => {
    expect(validateTransferDetails('KE', '0712345678', 'MPESA').valid).toBe(true);
  });
});

// ============================================================================
// validateTransferDetails — Unknown country falls back
// ============================================================================
describe('validateTransferDetails: Unknown country', () => {
  it('uses nuban as default and accepts valid details', () => {
    const result = validateTransferDetails('XX', '1234567890', '123');
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// validateStripeBankDetails — US
// ============================================================================
describe('validateStripeBankDetails: US', () => {
  it('accepts valid US routing + account numbers', () => {
    const result = validateStripeBankDetails('US', {
      routingNumber: '123456789',
      accountNumber: '12345678',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects routing number not 9 digits', () => {
    expect(validateStripeBankDetails('US', {
      routingNumber: '12345',
      accountNumber: '12345678',
    }).valid).toBe(false);
  });

  it('rejects account number shorter than 4 digits', () => {
    expect(validateStripeBankDetails('US', {
      routingNumber: '123456789',
      accountNumber: '123',
    }).valid).toBe(false);
  });
});

// ============================================================================
// validateStripeBankDetails — UK
// ============================================================================
describe('validateStripeBankDetails: UK (GB)', () => {
  it('accepts valid sort code and 8-digit account', () => {
    const result = validateStripeBankDetails('GB', {
      sortCode: '20-00-00',
      accountNumber: '12345678',
    });
    expect(result.valid).toBe(true);
  });

  it('accepts sort code without hyphens', () => {
    const result = validateStripeBankDetails('GB', {
      sortCode: '200000',
      accountNumber: '12345678',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid sort code', () => {
    expect(validateStripeBankDetails('GB', {
      sortCode: '20-00',
      accountNumber: '12345678',
    }).valid).toBe(false);
  });

  it('rejects account number not 8 digits', () => {
    expect(validateStripeBankDetails('GB', {
      sortCode: '200000',
      accountNumber: '1234567',
    }).valid).toBe(false);
  });
});

// ============================================================================
// validateStripeBankDetails — Australia
// ============================================================================
describe('validateStripeBankDetails: Australia (AU)', () => {
  it('accepts valid BSB and account number', () => {
    const result = validateStripeBankDetails('AU', {
      bsbNumber: '062-000',
      accountNumber: '123456789',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects account number shorter than 5 digits', () => {
    expect(validateStripeBankDetails('AU', {
      bsbNumber: '062000',
      accountNumber: '1234',
    }).valid).toBe(false);
  });
});

// ============================================================================
// validateStripeBankDetails — EU (IBAN)
// ============================================================================
describe('validateStripeBankDetails: EU / SEPA (IBAN)', () => {
  it('accepts a valid IBAN', () => {
    const result = validateStripeBankDetails('DE', {
      iban: 'DE89 3704 0044 0532 0130 00',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid IBAN format', () => {
    const result = validateStripeBankDetails('DE', {
      iban: '12345',
    });
    expect(result.valid).toBe(false);
  });

  it('falls back to account number if no IBAN', () => {
    const result = validateStripeBankDetails('FR', {
      accountNumber: '1234567890',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects short account number without IBAN', () => {
    const result = validateStripeBankDetails('FR', {
      accountNumber: '1234',
    });
    expect(result.valid).toBe(false);
  });

  it('requires IBAN or account number for EU', () => {
    const result = validateStripeBankDetails('FR', {});
    expect(result.valid).toBe(false);
    expect(result.message).toContain('IBAN or account number');
  });
});
