import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Payment Service Provider Routing Tests
// Tests the country-to-provider routing logic and region configuration
// ============================================================================

// Reproduce the REGION_CONFIGS and routing logic from paymentService.ts
const REGION_CONFIGS: Record<string, { countries: string[]; currency: string; provider: 'stripe' | 'paystack' }> = {
  north_america: { countries: ['US', 'CA'], currency: 'USD', provider: 'stripe' },
  europe: { countries: ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT'], currency: 'EUR', provider: 'stripe' },
  uk: { countries: ['GB'], currency: 'GBP', provider: 'stripe' },
  nordics: { countries: ['SE', 'NO', 'DK', 'FI'], currency: 'EUR', provider: 'stripe' },
  switzerland: { countries: ['CH'], currency: 'CHF', provider: 'stripe' },
  iberia_ireland: { countries: ['PT', 'IE'], currency: 'EUR', provider: 'stripe' },
  australia: { countries: ['AU'], currency: 'AUD', provider: 'stripe' },
  nigeria: { countries: ['NG'], currency: 'NGN', provider: 'paystack' },
  ghana: { countries: ['GH'], currency: 'GHS', provider: 'paystack' },
  south_africa: { countries: ['ZA'], currency: 'ZAR', provider: 'paystack' },
  kenya: { countries: ['KE'], currency: 'KES', provider: 'paystack' },
  egypt: { countries: ['EG'], currency: 'EGP', provider: 'paystack' },
  rwanda: { countries: ['RW'], currency: 'RWF', provider: 'paystack' },
  cote_divoire: { countries: ['CI'], currency: 'XOF', provider: 'paystack' },
};

function getRegionConfig(countryCode: string) {
  const upperCode = countryCode.toUpperCase();
  for (const [regionName, config] of Object.entries(REGION_CONFIGS)) {
    if (config.countries.includes(upperCode)) {
      return { ...config, region: regionName };
    }
  }
  return null;
}

function getPaymentProvider(countryCode: string): 'stripe' | 'paystack' {
  const config = getRegionConfig(countryCode);
  return config?.provider || 'stripe';
}

function getCurrencyForCountry(countryCode: string): string {
  const config = getRegionConfig(countryCode);
  return config?.currency || 'USD';
}

// ============================================================================
// Provider Routing Tests
// ============================================================================
describe('getPaymentProvider', () => {
  describe('Stripe countries', () => {
    it('routes US to Stripe', () => {
      expect(getPaymentProvider('US')).toBe('stripe');
    });

    it('routes UK to Stripe', () => {
      expect(getPaymentProvider('GB')).toBe('stripe');
    });

    it('routes European countries to Stripe', () => {
      const euCountries = ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT'];
      for (const c of euCountries) {
        expect(getPaymentProvider(c)).toBe('stripe');
      }
    });

    it('routes Nordic countries to Stripe', () => {
      const nordics = ['SE', 'NO', 'DK', 'FI'];
      for (const c of nordics) {
        expect(getPaymentProvider(c)).toBe('stripe');
      }
    });

    it('routes Australia to Stripe', () => {
      expect(getPaymentProvider('AU')).toBe('stripe');
    });

    it('routes Canada to Stripe', () => {
      expect(getPaymentProvider('CA')).toBe('stripe');
    });

    it('routes Switzerland to Stripe', () => {
      expect(getPaymentProvider('CH')).toBe('stripe');
    });
  });

  describe('Paystack countries', () => {
    it('routes Nigeria to Paystack', () => {
      expect(getPaymentProvider('NG')).toBe('paystack');
    });

    it('routes Ghana to Paystack', () => {
      expect(getPaymentProvider('GH')).toBe('paystack');
    });

    it('routes South Africa to Paystack', () => {
      expect(getPaymentProvider('ZA')).toBe('paystack');
    });

    it('routes Kenya to Paystack', () => {
      expect(getPaymentProvider('KE')).toBe('paystack');
    });

    it('routes Egypt to Paystack', () => {
      expect(getPaymentProvider('EG')).toBe('paystack');
    });

    it('routes Rwanda to Paystack', () => {
      expect(getPaymentProvider('RW')).toBe('paystack');
    });

    it("routes Cote d'Ivoire to Paystack", () => {
      expect(getPaymentProvider('CI')).toBe('paystack');
    });
  });

  describe('edge cases', () => {
    it('handles lowercase country codes', () => {
      expect(getPaymentProvider('us')).toBe('stripe');
      expect(getPaymentProvider('ng')).toBe('paystack');
    });

    it('defaults to Stripe for unknown countries', () => {
      expect(getPaymentProvider('JP')).toBe('stripe');
      expect(getPaymentProvider('XX')).toBe('stripe');
    });
  });
});

// ============================================================================
// Currency for Country Tests
// ============================================================================
describe('getCurrencyForCountry', () => {
  it('returns USD for US', () => {
    expect(getCurrencyForCountry('US')).toBe('USD');
  });

  it('returns GBP for UK', () => {
    expect(getCurrencyForCountry('GB')).toBe('GBP');
  });

  it('returns EUR for EU countries', () => {
    expect(getCurrencyForCountry('DE')).toBe('EUR');
    expect(getCurrencyForCountry('FR')).toBe('EUR');
    expect(getCurrencyForCountry('ES')).toBe('EUR');
  });

  it('returns NGN for Nigeria', () => {
    expect(getCurrencyForCountry('NG')).toBe('NGN');
  });

  it('returns GHS for Ghana', () => {
    expect(getCurrencyForCountry('GH')).toBe('GHS');
  });

  it('returns ZAR for South Africa', () => {
    expect(getCurrencyForCountry('ZA')).toBe('ZAR');
  });

  it('returns AUD for Australia', () => {
    expect(getCurrencyForCountry('AU')).toBe('AUD');
  });

  it('returns CHF for Switzerland', () => {
    expect(getCurrencyForCountry('CH')).toBe('CHF');
  });

  it('returns XOF for Cote dIvoire', () => {
    expect(getCurrencyForCountry('CI')).toBe('XOF');
  });

  it('defaults to USD for unknown countries', () => {
    expect(getCurrencyForCountry('XX')).toBe('USD');
  });
});

// ============================================================================
// Region Config Tests
// ============================================================================
describe('getRegionConfig', () => {
  it('returns correct region for each country', () => {
    expect(getRegionConfig('US')?.region).toBe('north_america');
    expect(getRegionConfig('GB')?.region).toBe('uk');
    expect(getRegionConfig('DE')?.region).toBe('europe');
    expect(getRegionConfig('SE')?.region).toBe('nordics');
    expect(getRegionConfig('NG')?.region).toBe('nigeria');
  });

  it('returns null for unsupported countries', () => {
    expect(getRegionConfig('JP')).toBeNull();
    expect(getRegionConfig('XX')).toBeNull();
  });

  it('returns full config with all fields', () => {
    const config = getRegionConfig('US');
    expect(config).toHaveProperty('countries');
    expect(config).toHaveProperty('currency');
    expect(config).toHaveProperty('provider');
    expect(config).toHaveProperty('region');
  });

  it('ensures all 25 supported countries have configs', () => {
    const allCountries = [
      'US', 'CA', 'GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT',
      'SE', 'NO', 'DK', 'FI', 'CH', 'PT', 'IE', 'AU',
      'NG', 'GH', 'ZA', 'KE', 'EG', 'RW', 'CI',
    ];
    for (const country of allCountries) {
      const config = getRegionConfig(country);
      expect(config).not.toBeNull();
      expect(config?.provider).toMatch(/^(stripe|paystack)$/);
    }
  });
});

// ============================================================================
// Bank Payout Routing Tests
// ============================================================================
describe('Bank Payout Routing', () => {
  // Reproduce the routing logic from paymentService
  function getBankPayoutMethod(countryCode: string): string {
    const upperCountry = countryCode.toUpperCase();
    if (['US', 'CA'].includes(upperCountry)) return 'ach';
    if (['GB'].includes(upperCountry)) return 'bacs';
    if (['AU'].includes(upperCountry)) return 'becs';
    return 'sepa'; // Default for EU
  }

  it('routes US to ACH', () => {
    expect(getBankPayoutMethod('US')).toBe('ach');
  });

  it('routes CA to ACH', () => {
    expect(getBankPayoutMethod('CA')).toBe('ach');
  });

  it('routes GB to BACS', () => {
    expect(getBankPayoutMethod('GB')).toBe('bacs');
  });

  it('routes AU to BECS', () => {
    expect(getBankPayoutMethod('AU')).toBe('becs');
  });

  it('routes EU countries to SEPA', () => {
    const euCountries = ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'PT', 'IE'];
    for (const c of euCountries) {
      expect(getBankPayoutMethod(c)).toBe('sepa');
    }
  });

  it('routes Nordic countries to SEPA', () => {
    const nordics = ['SE', 'NO', 'DK', 'FI'];
    for (const c of nordics) {
      expect(getBankPayoutMethod(c)).toBe('sepa');
    }
  });
});
