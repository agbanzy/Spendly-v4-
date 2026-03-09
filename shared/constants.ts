// ── Financiar Shared Constants ───────────────────────────────────
// Single source of truth for countries, currencies, providers.
// Used by both client and server — never duplicate these elsewhere.

export interface CountryConfig {
  code: string;
  name: string;
  dial: string;
  currency: string;
  currencySymbol: string;
  provider: 'stripe' | 'paystack';
  region: string;
  /** Paystack API country key for bank list fetching. Empty for Stripe countries (use static lists). */
  bankListKey: string;
}

export const SUPPORTED_COUNTRIES: CountryConfig[] = [
  // ── Stripe — North America ──
  { code: 'US', name: 'United States', dial: '+1', currency: 'USD', currencySymbol: '$', provider: 'stripe', region: 'North America', bankListKey: '' },
  { code: 'CA', name: 'Canada', dial: '+1', currency: 'CAD', currencySymbol: 'C$', provider: 'stripe', region: 'North America', bankListKey: '' },

  // ── Stripe — Europe ──
  { code: 'GB', name: 'United Kingdom', dial: '+44', currency: 'GBP', currencySymbol: '£', provider: 'stripe', region: 'United Kingdom', bankListKey: '' },
  { code: 'DE', name: 'Germany', dial: '+49', currency: 'EUR', currencySymbol: '€', provider: 'stripe', region: 'Europe', bankListKey: '' },
  { code: 'FR', name: 'France', dial: '+33', currency: 'EUR', currencySymbol: '€', provider: 'stripe', region: 'Europe', bankListKey: '' },
  { code: 'ES', name: 'Spain', dial: '+34', currency: 'EUR', currencySymbol: '€', provider: 'stripe', region: 'Europe', bankListKey: '' },
  { code: 'IT', name: 'Italy', dial: '+39', currency: 'EUR', currencySymbol: '€', provider: 'stripe', region: 'Europe', bankListKey: '' },
  { code: 'NL', name: 'Netherlands', dial: '+31', currency: 'EUR', currencySymbol: '€', provider: 'stripe', region: 'Europe', bankListKey: '' },
  { code: 'BE', name: 'Belgium', dial: '+32', currency: 'EUR', currencySymbol: '€', provider: 'stripe', region: 'Europe', bankListKey: '' },
  { code: 'AT', name: 'Austria', dial: '+43', currency: 'EUR', currencySymbol: '€', provider: 'stripe', region: 'Europe', bankListKey: '' },
  { code: 'CH', name: 'Switzerland', dial: '+41', currency: 'CHF', currencySymbol: 'CHF', provider: 'stripe', region: 'Europe', bankListKey: '' },
  { code: 'SE', name: 'Sweden', dial: '+46', currency: 'SEK', currencySymbol: 'kr', provider: 'stripe', region: 'Europe', bankListKey: '' },
  { code: 'NO', name: 'Norway', dial: '+47', currency: 'NOK', currencySymbol: 'kr', provider: 'stripe', region: 'Europe', bankListKey: '' },
  { code: 'DK', name: 'Denmark', dial: '+45', currency: 'DKK', currencySymbol: 'kr', provider: 'stripe', region: 'Europe', bankListKey: '' },
  { code: 'FI', name: 'Finland', dial: '+358', currency: 'EUR', currencySymbol: '€', provider: 'stripe', region: 'Europe', bankListKey: '' },
  { code: 'IE', name: 'Ireland', dial: '+353', currency: 'EUR', currencySymbol: '€', provider: 'stripe', region: 'Europe', bankListKey: '' },
  { code: 'PT', name: 'Portugal', dial: '+351', currency: 'EUR', currencySymbol: '€', provider: 'stripe', region: 'Europe', bankListKey: '' },

  // ── Stripe — Oceania ──
  { code: 'AU', name: 'Australia', dial: '+61', currency: 'AUD', currencySymbol: 'A$', provider: 'stripe', region: 'Australia', bankListKey: '' },

  // ── Paystack — Africa ──
  { code: 'NG', name: 'Nigeria', dial: '+234', currency: 'NGN', currencySymbol: '₦', provider: 'paystack', region: 'Nigeria', bankListKey: 'nigeria' },
  { code: 'GH', name: 'Ghana', dial: '+233', currency: 'GHS', currencySymbol: 'GH₵', provider: 'paystack', region: 'Ghana', bankListKey: 'ghana' },
  { code: 'ZA', name: 'South Africa', dial: '+27', currency: 'ZAR', currencySymbol: 'R', provider: 'paystack', region: 'South Africa', bankListKey: 'south_africa' },
  { code: 'KE', name: 'Kenya', dial: '+254', currency: 'KES', currencySymbol: 'KSh', provider: 'paystack', region: 'Kenya', bankListKey: 'kenya' },
  { code: 'EG', name: 'Egypt', dial: '+20', currency: 'EGP', currencySymbol: 'E£', provider: 'paystack', region: 'Egypt', bankListKey: 'egypt' },
  { code: 'RW', name: 'Rwanda', dial: '+250', currency: 'RWF', currencySymbol: 'RF', provider: 'paystack', region: 'Rwanda', bankListKey: 'rwanda' },
  { code: 'CI', name: "Côte d'Ivoire", dial: '+225', currency: 'XOF', currencySymbol: 'CFA', provider: 'paystack', region: "Côte d'Ivoire", bankListKey: 'cote_divoire' },
];

// ── Lookup helpers ──────────────────────────────────────────────

const countryMap = new Map(SUPPORTED_COUNTRIES.map(c => [c.code, c]));

export function getCountryConfig(code: string): CountryConfig | undefined {
  return countryMap.get(code.toUpperCase());
}

export function getCurrencyForCountry(code: string): { currency: string; symbol: string } {
  const config = getCountryConfig(code);
  return {
    currency: config?.currency || 'USD',
    symbol: config?.currencySymbol || '$',
  };
}

export function getCurrencySymbol(currency: string): string {
  const country = SUPPORTED_COUNTRIES.find(c => c.currency === currency);
  return country?.currencySymbol || currency + ' ';
}

export function getProviderForCountry(code: string): 'stripe' | 'paystack' {
  return getCountryConfig(code)?.provider || 'stripe';
}

export function isPaystackCountry(code: string): boolean {
  return getProviderForCountry(code) === 'paystack';
}

export function getCountriesByProvider(provider: 'stripe' | 'paystack'): CountryConfig[] {
  return SUPPORTED_COUNTRIES.filter(c => c.provider === provider);
}

export function getCountryDialCode(code: string): string {
  return getCountryConfig(code)?.dial || '';
}

// ── Currency symbol lookup map (for dropdowns/display) ──────────

export const CURRENCY_SYMBOLS: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const c of SUPPORTED_COUNTRIES) {
    if (!map[c.currency]) map[c.currency] = c.currencySymbol;
  }
  return map;
})();

// ── Currency formatting ─────────────────────────────────────────

export function formatCurrencyAmount(amount: number | string, currency: string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
  const sym = getCurrencySymbol(currency);
  return `${sym}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Payment limits ──────────────────────────────────────────────

export const PAYMENT_LIMITS: Record<string, { min: number; max: number }> = {
  USD: { min: 1, max: 999999 },
  EUR: { min: 1, max: 999999 },
  GBP: { min: 1, max: 999999 },
  CAD: { min: 1, max: 999999 },
  AUD: { min: 1, max: 999999 },
  CHF: { min: 1, max: 999999 },
  SEK: { min: 10, max: 9999999 },
  NOK: { min: 10, max: 9999999 },
  DKK: { min: 10, max: 9999999 },
  NGN: { min: 100, max: 10000000 },
  KES: { min: 10, max: 1000000 },
  GHS: { min: 1, max: 100000 },
  ZAR: { min: 10, max: 1000000 },
  EGP: { min: 10, max: 1000000 },
  RWF: { min: 100, max: 10000000 },
  XOF: { min: 100, max: 10000000 },
};

// ── Legacy compatibility (REGION_CONFIGS for server/paymentService.ts) ──

export interface RegionConfig {
  region: string;
  countries: string[];
  currency: string;
  paymentProvider: 'stripe' | 'paystack';
  currencySymbol: string;
}

/** @deprecated Use SUPPORTED_COUNTRIES and helper functions instead */
export const REGION_CONFIGS: RegionConfig[] = (() => {
  const regionMap = new Map<string, RegionConfig>();
  for (const c of SUPPORTED_COUNTRIES) {
    const existing = regionMap.get(c.region);
    if (existing) {
      existing.countries.push(c.code);
    } else {
      regionMap.set(c.region, {
        region: c.region,
        countries: [c.code],
        currency: c.currency,
        paymentProvider: c.provider,
        currencySymbol: c.currencySymbol,
      });
    }
  }
  return Array.from(regionMap.values());
})();

/** @deprecated Use getCountryConfig instead */
export function getRegionConfig(countryCode: string): RegionConfig | undefined {
  return REGION_CONFIGS.find(config => config.countries.includes(countryCode.toUpperCase()));
}

/** @deprecated Use getProviderForCountry instead */
export function getPaymentProvider(countryCode: string): 'stripe' | 'paystack' {
  return getProviderForCountry(countryCode);
}

/** Paystack bank list country name mapping */
export function getBankListKey(countryCode: string): string {
  return getCountryConfig(countryCode)?.bankListKey || '';
}

// ── Routing format hints (which field to show for bank details) ──

export type BankDetailFormat = 'routing_number' | 'sort_code' | 'iban' | 'bsb' | 'bank_code' | 'transit';

export function getBankDetailFormat(countryCode: string): BankDetailFormat {
  switch (countryCode.toUpperCase()) {
    case 'US': return 'routing_number';
    case 'CA': return 'transit';
    case 'GB': return 'sort_code';
    case 'AU': return 'bsb';
    case 'NG': case 'GH': case 'ZA': case 'KE': case 'EG': case 'RW': case 'CI':
      return 'bank_code';
    default: return 'iban'; // EU countries
  }
}

export function getBankDetailLabel(format: BankDetailFormat): string {
  switch (format) {
    case 'routing_number': return 'Routing Number';
    case 'sort_code': return 'Sort Code';
    case 'iban': return 'IBAN';
    case 'bsb': return 'BSB Number';
    case 'bank_code': return 'Bank Code';
    case 'transit': return 'Transit + Institution Number';
  }
}
