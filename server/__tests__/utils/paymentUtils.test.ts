import { describe, it, expect, vi } from 'vitest';
import { Money, mapPaymentError, validateCurrencyForProvider } from '../../utils/paymentUtils';

// ============================================================================
// Money Utility Tests
// ============================================================================
describe('Money', () => {
  describe('toMinor', () => {
    it('converts dollars to cents correctly', () => {
      expect(Money.toMinor(10.50)).toBe(1050);
      expect(Money.toMinor(0.01)).toBe(1);
      expect(Money.toMinor(1000)).toBe(100000);
    });

    it('converts string amounts to cents', () => {
      expect(Money.toMinor('10.50')).toBe(1050);
      expect(Money.toMinor('0.01')).toBe(1);
    });

    it('handles floating point precision correctly', () => {
      // Classic floating point issue: 0.1 + 0.2 = 0.30000000000000004
      expect(Money.toMinor(0.1 + 0.2)).toBe(30);
      expect(Money.toMinor(19.99)).toBe(1999);
    });

    it('handles zero', () => {
      expect(Money.toMinor(0)).toBe(0);
    });
  });

  describe('toMajor', () => {
    it('converts cents to dollars correctly', () => {
      expect(Money.toMajor(1050)).toBe(10.50);
      expect(Money.toMajor(1)).toBe(0.01);
      expect(Money.toMajor(100000)).toBe(1000);
    });

    it('handles zero', () => {
      expect(Money.toMajor(0)).toBe(0);
    });
  });

  describe('add', () => {
    it('adds two amounts safely', () => {
      expect(Money.add(10.50, 5.25)).toBe(15.75);
      expect(Money.add(0.1, 0.2)).toBe(0.30);
    });

    it('adds string amounts', () => {
      expect(Money.add('10.50', '5.25')).toBe(15.75);
    });

    it('handles large amounts', () => {
      expect(Money.add(999999.99, 0.01)).toBe(1000000);
    });
  });

  describe('subtract', () => {
    it('subtracts two amounts safely', () => {
      expect(Money.subtract(10.50, 5.25)).toBe(5.25);
      expect(Money.subtract(0.3, 0.1)).toBe(0.20);
    });

    it('handles negative results', () => {
      expect(Money.subtract(5, 10)).toBe(-5);
    });
  });

  describe('compare', () => {
    it('compares amounts correctly', () => {
      expect(Money.compare(10, 5)).toBe(1);
      expect(Money.compare(5, 10)).toBe(-1);
      expect(Money.compare(10, 10)).toBe(0);
    });

    it('handles string and number comparison', () => {
      expect(Money.compare('10.50', 10.50)).toBe(0);
      expect(Money.compare('10.51', '10.50')).toBe(1);
    });

    it('handles precision edge cases', () => {
      expect(Money.compare(0.1 + 0.2, 0.3)).toBe(0);
    });
  });

  describe('format', () => {
    it('formats USD correctly', () => {
      expect(Money.format(10.50, 'USD')).toBe('$10.50');
      expect(Money.format(1000, 'USD')).toBe('$1000.00');
    });

    it('formats GBP correctly', () => {
      expect(Money.format(10.50, 'GBP')).toBe('£10.50');
    });

    it('formats EUR correctly', () => {
      expect(Money.format(10.50, 'EUR')).toBe('€10.50');
    });

    it('formats NGN correctly', () => {
      expect(Money.format(10.50, 'NGN')).toBe('₦10.50');
    });

    it('handles unknown currency with code prefix', () => {
      expect(Money.format(10.50, 'XYZ')).toBe('XYZ 10.50');
    });

    it('formats string amounts', () => {
      expect(Money.format('10.50', 'USD')).toBe('$10.50');
    });
  });

  describe('isValid', () => {
    it('accepts valid positive amounts', () => {
      expect(Money.isValid(10.50)).toBe(true);
      expect(Money.isValid(0.01)).toBe(true);
      expect(Money.isValid(999999999)).toBe(true);
    });

    it('rejects zero', () => {
      expect(Money.isValid(0)).toBe(false);
    });

    it('rejects negative amounts', () => {
      expect(Money.isValid(-10)).toBe(false);
    });

    it('rejects NaN', () => {
      expect(Money.isValid(NaN)).toBe(false);
    });

    it('rejects Infinity', () => {
      expect(Money.isValid(Infinity)).toBe(false);
    });

    it('rejects amounts over 1 billion', () => {
      expect(Money.isValid(1_000_000_001)).toBe(false);
    });

    it('validates string amounts', () => {
      expect(Money.isValid('10.50')).toBe(true);
      expect(Money.isValid('abc')).toBe(false);
    });
  });
});

// ============================================================================
// mapPaymentError Tests
// ============================================================================
describe('mapPaymentError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps insufficient funds errors', () => {
    const result = mapPaymentError(new Error('Insufficient balance for transfer'));
    expect(result.userMessage).toContain('Insufficient funds');
    expect(result.statusCode).toBe(400);
    expect(result.correlationId).toMatch(/^pay_/);
  });

  it('maps invalid account errors', () => {
    const result = mapPaymentError(new Error('Invalid account number'));
    expect(result.userMessage).toContain('recipient account details');
    expect(result.statusCode).toBe(400);
  });

  it('maps duplicate transaction errors', () => {
    const result = mapPaymentError(new Error('Duplicate transaction detected'));
    expect(result.userMessage).toContain('already been processed');
    expect(result.statusCode).toBe(409);
  });

  it('maps rate limit errors', () => {
    const result = mapPaymentError(new Error('Rate limit exceeded'));
    expect(result.userMessage).toContain('Too many requests');
    expect(result.statusCode).toBe(429);
  });

  it('maps authentication errors to 503', () => {
    const result = mapPaymentError(new Error('Authentication failed: bad API key'));
    expect(result.userMessage).toContain('temporarily unavailable');
    expect(result.statusCode).toBe(503);
  });

  it('maps timeout errors to 503', () => {
    const result = mapPaymentError(new Error('Request timeout'));
    expect(result.userMessage).toContain('temporarily unreachable');
    expect(result.statusCode).toBe(503);
  });

  it('maps currency errors', () => {
    const result = mapPaymentError(new Error('Currency not supported for this region'));
    expect(result.userMessage).toContain('currency is not supported');
    expect(result.statusCode).toBe(400);
  });

  it('returns generic error for unknown errors', () => {
    const result = mapPaymentError(new Error('Something weird happened'));
    expect(result.userMessage).toContain('error occurred processing');
    expect(result.statusCode).toBe(500);
  });

  it('includes provider in response', () => {
    const result = mapPaymentError(new Error('Insufficient balance'), 'stripe');
    expect(result.provider).toBe('stripe');
  });

  it('generates unique correlation IDs', () => {
    const r1 = mapPaymentError(new Error('err1'));
    const r2 = mapPaymentError(new Error('err2'));
    expect(r1.correlationId).not.toBe(r2.correlationId);
  });

  it('does not leak internal error details', () => {
    const internalError = new Error('STRIPE_SECRET_KEY=sk_live_xxx failed at line 42 in /server/routes.ts');
    const result = mapPaymentError(internalError);
    expect(result.userMessage).not.toContain('STRIPE_SECRET_KEY');
    expect(result.userMessage).not.toContain('sk_live');
    expect(result.userMessage).not.toContain('/server/routes.ts');
  });
});

// ============================================================================
// validateCurrencyForProvider Tests
// ============================================================================
describe('validateCurrencyForProvider', () => {
  describe('Stripe currencies', () => {
    it('accepts supported Stripe currencies', () => {
      const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK'];
      for (const c of currencies) {
        expect(validateCurrencyForProvider(c, 'stripe').valid).toBe(true);
      }
    });

    it('rejects unsupported Stripe currencies', () => {
      const result = validateCurrencyForProvider('NGN', 'stripe');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('not supported by stripe');
    });

    it('is case-insensitive', () => {
      expect(validateCurrencyForProvider('usd', 'stripe').valid).toBe(true);
      expect(validateCurrencyForProvider('Usd', 'stripe').valid).toBe(true);
    });
  });

  describe('Paystack currencies', () => {
    it('accepts supported Paystack currencies', () => {
      const currencies = ['NGN', 'GHS', 'ZAR', 'KES', 'USD', 'EGP', 'XOF', 'RWF'];
      for (const c of currencies) {
        expect(validateCurrencyForProvider(c, 'paystack').valid).toBe(true);
      }
    });

    it('rejects unsupported Paystack currencies', () => {
      const result = validateCurrencyForProvider('EUR', 'paystack');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('not supported by paystack');
    });
  });

  it('rejects unknown provider', () => {
    const result = validateCurrencyForProvider('USD', 'unknown' as any);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Unknown payment provider');
  });
});
