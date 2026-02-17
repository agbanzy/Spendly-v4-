import { describe, it, expect, vi } from 'vitest';

// ============================================================================
// Virtual Card & Virtual Account Logic Tests
// Tests the card issuance logic, provider routing, and account creation
// ============================================================================

// ============================================================================
// Card Provider Selection Tests
// ============================================================================
describe('Virtual Card Provider Selection', () => {
  const PAYSTACK_CURRENCIES = ['NGN', 'GHS', 'KES', 'ZAR', 'EGP', 'RWF', 'XOF'];

  function getCardProvider(currency: string): 'stripe' | 'paystack' {
    return PAYSTACK_CURRENCIES.includes(currency) ? 'paystack' : 'stripe';
  }

  it('routes African currencies to Paystack', () => {
    for (const c of PAYSTACK_CURRENCIES) {
      expect(getCardProvider(c)).toBe('paystack');
    }
  });

  it('routes USD to Stripe', () => {
    expect(getCardProvider('USD')).toBe('stripe');
  });

  it('routes EUR to Stripe', () => {
    expect(getCardProvider('EUR')).toBe('stripe');
  });

  it('routes GBP to Stripe', () => {
    expect(getCardProvider('GBP')).toBe('stripe');
  });

  it('routes AUD to Stripe', () => {
    expect(getCardProvider('AUD')).toBe('stripe');
  });

  it('routes unknown currencies to Stripe (default)', () => {
    expect(getCardProvider('JPY')).toBe('stripe');
    expect(getCardProvider('BRL')).toBe('stripe');
  });
});

// ============================================================================
// Card Status Transition Tests
// ============================================================================
describe('Card Status Transitions', () => {
  type CardStatus = 'Active' | 'Frozen' | 'Cancelled';

  interface CardStatusTransition {
    from: CardStatus;
    action: string;
    to: CardStatus;
    allowed: boolean;
  }

  const VALID_TRANSITIONS: CardStatusTransition[] = [
    { from: 'Active', action: 'freeze', to: 'Frozen', allowed: true },
    { from: 'Active', action: 'cancel', to: 'Cancelled', allowed: true },
    { from: 'Frozen', action: 'unfreeze', to: 'Active', allowed: true },
    { from: 'Frozen', action: 'cancel', to: 'Cancelled', allowed: true },
    { from: 'Cancelled', action: 'unfreeze', to: 'Active', allowed: false },
    { from: 'Cancelled', action: 'freeze', to: 'Frozen', allowed: false },
  ];

  function isTransitionAllowed(from: CardStatus, action: string): boolean {
    if (from === 'Cancelled') return false; // Cancelled is terminal
    if (action === 'freeze' && from === 'Active') return true;
    if (action === 'unfreeze' && from === 'Frozen') return true;
    if (action === 'cancel' && (from === 'Active' || from === 'Frozen')) return true;
    return false;
  }

  for (const t of VALID_TRANSITIONS) {
    it(`${t.allowed ? 'allows' : 'blocks'} ${t.action} from ${t.from}`, () => {
      expect(isTransitionAllowed(t.from, t.action)).toBe(t.allowed);
    });
  }

  it('blocks unknown actions', () => {
    expect(isTransitionAllowed('Active', 'destroy')).toBe(false);
  });
});

// ============================================================================
// Card Spending Limit Validation Tests
// ============================================================================
describe('Card Spending Limits', () => {
  function validateSpendingLimit(limit: number, currency: string): { valid: boolean; error?: string } {
    if (limit <= 0) return { valid: false, error: 'Limit must be positive' };
    if (limit > 1000000) return { valid: false, error: 'Limit too high' };
    if (!Number.isFinite(limit)) return { valid: false, error: 'Invalid limit' };
    return { valid: true };
  }

  it('accepts valid spending limits', () => {
    expect(validateSpendingLimit(1000, 'USD').valid).toBe(true);
    expect(validateSpendingLimit(0.01, 'USD').valid).toBe(true);
    expect(validateSpendingLimit(999999, 'USD').valid).toBe(true);
  });

  it('rejects zero limit', () => {
    expect(validateSpendingLimit(0, 'USD').valid).toBe(false);
  });

  it('rejects negative limit', () => {
    expect(validateSpendingLimit(-100, 'USD').valid).toBe(false);
  });

  it('rejects limit over 1M', () => {
    expect(validateSpendingLimit(1000001, 'USD').valid).toBe(false);
  });

  it('rejects Infinity', () => {
    expect(validateSpendingLimit(Infinity, 'USD').valid).toBe(false);
  });
});

// ============================================================================
// Card Funding Validation Tests
// ============================================================================
describe('Card Funding Validation', () => {
  interface FundingValidation {
    walletBalance: number;
    fundingAmount: number;
    walletCurrency: string;
    cardCurrency: string;
    exchangeRate?: number;
  }

  function validateFunding(params: FundingValidation): { valid: boolean; amountToDeduct: number; amountToCredit: number; error?: string } {
    const { walletBalance, fundingAmount, walletCurrency, cardCurrency, exchangeRate } = params;

    if (fundingAmount <= 0) return { valid: false, amountToDeduct: 0, amountToCredit: 0, error: 'Amount must be positive' };

    let amountToDeduct = fundingAmount;
    let amountToCredit = fundingAmount;

    if (walletCurrency !== cardCurrency) {
      if (!exchangeRate || exchangeRate <= 0) {
        return { valid: false, amountToDeduct: 0, amountToCredit: 0, error: 'Exchange rate required for cross-currency funding' };
      }
      amountToDeduct = fundingAmount;
      amountToCredit = Math.round(fundingAmount * exchangeRate * 100) / 100;
    }

    if (walletBalance < amountToDeduct) {
      return { valid: false, amountToDeduct, amountToCredit, error: 'Insufficient wallet balance' };
    }

    return { valid: true, amountToDeduct, amountToCredit };
  }

  it('approves same-currency funding with sufficient balance', () => {
    const result = validateFunding({
      walletBalance: 1000,
      fundingAmount: 500,
      walletCurrency: 'USD',
      cardCurrency: 'USD',
    });
    expect(result.valid).toBe(true);
    expect(result.amountToDeduct).toBe(500);
    expect(result.amountToCredit).toBe(500);
  });

  it('rejects funding with insufficient balance', () => {
    const result = validateFunding({
      walletBalance: 100,
      fundingAmount: 500,
      walletCurrency: 'USD',
      cardCurrency: 'USD',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Insufficient');
  });

  it('handles cross-currency funding with exchange rate', () => {
    const result = validateFunding({
      walletBalance: 1000,
      fundingAmount: 100,
      walletCurrency: 'USD',
      cardCurrency: 'EUR',
      exchangeRate: 0.92,
    });
    expect(result.valid).toBe(true);
    expect(result.amountToDeduct).toBe(100);
    expect(result.amountToCredit).toBe(92);
  });

  it('rejects cross-currency without exchange rate', () => {
    const result = validateFunding({
      walletBalance: 1000,
      fundingAmount: 100,
      walletCurrency: 'USD',
      cardCurrency: 'EUR',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Exchange rate required');
  });

  it('rejects negative funding amount', () => {
    const result = validateFunding({
      walletBalance: 1000,
      fundingAmount: -100,
      walletCurrency: 'USD',
      cardCurrency: 'USD',
    });
    expect(result.valid).toBe(false);
  });

  it('rejects zero funding amount', () => {
    const result = validateFunding({
      walletBalance: 1000,
      fundingAmount: 0,
      walletCurrency: 'USD',
      cardCurrency: 'USD',
    });
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// Virtual Account Country Routing Tests
// ============================================================================
describe('Virtual Account Provider Routing', () => {
  const PAYSTACK_COUNTRIES = ['NG', 'GH', 'ZA', 'KE', 'EG', 'RW', 'CI'];

  function getVirtualAccountProvider(countryCode: string): 'paystack_dva' | 'stripe_treasury' {
    return PAYSTACK_COUNTRIES.includes(countryCode.toUpperCase()) ? 'paystack_dva' : 'stripe_treasury';
  }

  it('routes African countries to Paystack DVA', () => {
    for (const c of PAYSTACK_COUNTRIES) {
      expect(getVirtualAccountProvider(c)).toBe('paystack_dva');
    }
  });

  it('routes US to Stripe Treasury', () => {
    expect(getVirtualAccountProvider('US')).toBe('stripe_treasury');
  });

  it('routes UK to Stripe Treasury', () => {
    expect(getVirtualAccountProvider('GB')).toBe('stripe_treasury');
  });

  it('routes EU to Stripe Treasury', () => {
    expect(getVirtualAccountProvider('DE')).toBe('stripe_treasury');
    expect(getVirtualAccountProvider('FR')).toBe('stripe_treasury');
  });

  it('routes AU to Stripe Treasury', () => {
    expect(getVirtualAccountProvider('AU')).toBe('stripe_treasury');
  });

  it('handles lowercase country codes', () => {
    expect(getVirtualAccountProvider('ng')).toBe('paystack_dva');
    expect(getVirtualAccountProvider('us')).toBe('stripe_treasury');
  });
});

// ============================================================================
// Stripe Issuing Card Number Validation Tests
// ============================================================================
describe('Card Number Validation', () => {
  // Luhn algorithm check (used to validate card numbers)
  function isValidLuhn(cardNumber: string): boolean {
    const digits = cardNumber.replace(/\s/g, '');
    if (!/^\d+$/.test(digits)) return false;

    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  it('validates known test card numbers', () => {
    expect(isValidLuhn('4242424242424242')).toBe(true); // Stripe test Visa
    expect(isValidLuhn('5555555555554444')).toBe(true); // Stripe test MC
  });

  it('rejects invalid card numbers', () => {
    expect(isValidLuhn('1234567890123456')).toBe(false);
    expect(isValidLuhn('0000000000000000')).toBe(true); // Edge: zeros pass Luhn
  });

  it('rejects non-numeric input', () => {
    expect(isValidLuhn('abcd1234')).toBe(false);
  });

  it('handles card numbers with spaces', () => {
    expect(isValidLuhn('4242 4242 4242 4242')).toBe(true);
  });
});
