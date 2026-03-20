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

// ── Primary ID per country (one ID type for verification) ───────

export interface PrimaryIdConfig {
  key: string;
  label: string;
  placeholder: string;
  maxLength: number;
  /** Pattern hint for validation (informational, not enforced on client) */
  pattern?: string;
}

export const PRIMARY_ID_BY_COUNTRY: Record<string, PrimaryIdConfig> = {
  // Africa — Paystack
  NG: { key: 'bvn', label: 'Bank Verification Number (BVN)', placeholder: '22012345678', maxLength: 11, pattern: '^\\d{11}$' },
  GH: { key: 'ghana_card', label: 'Ghana Card Number', placeholder: 'GHA-XXXXXXXXX-X', maxLength: 15 },
  ZA: { key: 'sa_id', label: 'South African ID Number', placeholder: '13-digit ID number', maxLength: 13, pattern: '^\\d{13}$' },
  KE: { key: 'national_id', label: 'National ID Number', placeholder: '12345678', maxLength: 8, pattern: '^\\d{6,8}$' },
  EG: { key: 'national_id', label: 'National ID Number', placeholder: '14-digit ID number', maxLength: 14, pattern: '^\\d{14}$' },
  RW: { key: 'national_id', label: 'National ID Number', placeholder: '1199780012345', maxLength: 16, pattern: '^\\d{16}$' },
  CI: { key: 'cni', label: "Carte Nationale d'Identité", placeholder: 'ID number', maxLength: 12 },

  // North America — Stripe
  US: { key: 'ssn', label: 'Social Security Number (SSN)', placeholder: 'XXX-XX-XXXX', maxLength: 11, pattern: '^\\d{3}-?\\d{2}-?\\d{4}$' },
  CA: { key: 'sin', label: 'Social Insurance Number (SIN)', placeholder: 'XXX-XXX-XXX', maxLength: 11, pattern: '^\\d{3}-?\\d{3}-?\\d{3}$' },

  // Oceania
  AU: { key: 'tfn', label: 'Tax File Number (TFN)', placeholder: '12 345 678', maxLength: 11, pattern: '^\\d{8,9}$' },

  // UK
  GB: { key: 'ni_number', label: 'National Insurance Number', placeholder: 'AB 12 34 56 C', maxLength: 13 },

  // Europe — use passport or national ID
  DE: { key: 'national_id', label: 'Personalausweisnummer (ID Number)', placeholder: 'ID or passport number', maxLength: 20 },
  FR: { key: 'national_id', label: "Carte Nationale d'Identité", placeholder: 'ID or passport number', maxLength: 20 },
  ES: { key: 'national_id', label: 'DNI / NIE Number', placeholder: 'ID or passport number', maxLength: 20 },
  IT: { key: 'national_id', label: 'Carta d\'Identità Number', placeholder: 'ID or passport number', maxLength: 20 },
  NL: { key: 'national_id', label: 'BSN / ID Number', placeholder: 'ID or passport number', maxLength: 20 },
  BE: { key: 'national_id', label: 'National Register Number', placeholder: 'ID or passport number', maxLength: 20 },
  AT: { key: 'national_id', label: 'Personalausweis Number', placeholder: 'ID or passport number', maxLength: 20 },
  CH: { key: 'national_id', label: 'Identity Card / Passport Number', placeholder: 'ID or passport number', maxLength: 20 },
  SE: { key: 'national_id', label: 'Personnummer', placeholder: 'YYYYMMDD-XXXX', maxLength: 13 },
  NO: { key: 'national_id', label: 'Fødselsnummer', placeholder: 'DDMMYYXXXXX', maxLength: 11 },
  DK: { key: 'national_id', label: 'CPR-nummer', placeholder: 'DDMMYY-XXXX', maxLength: 11 },
  FI: { key: 'national_id', label: 'Henkilötunnus', placeholder: 'DDMMYY-XXXX', maxLength: 11 },
  IE: { key: 'national_id', label: 'PPS Number', placeholder: '1234567AB', maxLength: 10 },
  PT: { key: 'national_id', label: 'Cartão de Cidadão', placeholder: 'ID number', maxLength: 20 },
};

/** Get the primary ID config for a country code. Falls back to generic passport. */
export function getPrimaryIdForCountry(countryCode: string): PrimaryIdConfig {
  return PRIMARY_ID_BY_COUNTRY[countryCode.toUpperCase()] || {
    key: 'passport',
    label: 'Passport Number',
    placeholder: 'Passport number',
    maxLength: 20,
  };
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

// ── Preferred banks per country (for DVA / virtual account creation) ──

export const PREFERRED_BANKS: Record<string, Array<{ code: string; name: string }>> = {
  NG: [
    { code: 'wema-bank', name: 'Wema Bank' },
    { code: 'access-bank', name: 'Access Bank' },
    { code: 'test-bank', name: 'Test Bank' }, // Paystack test environment
  ],
  GH: [
    { code: 'gcb-bank', name: 'GCB Bank' },
    { code: 'fidelity-bank-ghana', name: 'Fidelity Bank Ghana' },
  ],
};

/**
 * Get the default preferred bank for a Paystack DVA country.
 * Returns the first bank in the preferred list, or 'wema-bank' as fallback.
 */
export function getPreferredBank(countryCode: string): { code: string; name: string } {
  const banks = PREFERRED_BANKS[countryCode.toUpperCase()];
  if (banks && banks.length > 0) return banks[0];
  return { code: 'wema-bank', name: 'Wema Bank' };
}

// ── Currency → Country mapping (which countries can receive a given currency) ──

export const CURRENCY_TO_COUNTRIES: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const c of SUPPORTED_COUNTRIES) {
    if (!map[c.currency]) map[c.currency] = [];
    map[c.currency].push(c.code);
  }
  return map;
})();

/**
 * Check whether a country is valid for a given currency.
 */
export function isCurrencyValidForCountry(currency: string, countryCode: string): boolean {
  const config = getCountryConfig(countryCode.toUpperCase());
  return config?.currency === currency.toUpperCase();
}

// ── Virtual account support matrix ──────────────────────────────

export type VirtualAccountMethod = 'paystack_dva' | 'mpesa_paybill' | 'bank_reference' | 'stripe_treasury' | 'unsupported';

/**
 * Determine which virtual account creation method to use for a given country.
 */
export function getVirtualAccountMethod(countryCode: string): VirtualAccountMethod {
  switch (countryCode.toUpperCase()) {
    case 'NG':
    case 'GH':
      return 'paystack_dva';
    case 'KE':
      return 'mpesa_paybill';
    case 'ZA':
      return 'bank_reference';
    case 'US':
    case 'CA':
    case 'GB':
    case 'AU':
    case 'DE':
    case 'FR':
    case 'ES':
    case 'IT':
    case 'NL':
    case 'BE':
    case 'AT':
    case 'CH':
    case 'SE':
    case 'NO':
    case 'DK':
    case 'FI':
    case 'IE':
    case 'PT':
      return 'stripe_treasury';
    default:
      return 'unsupported';
  }
}
