export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '\u20AC', GBP: '\u00A3', NGN: '\u20A6',
  KES: 'KSh', GHS: '\u20B5', ZAR: 'R', EGP: 'E\u00A3',
  RWF: 'RF', XOF: 'CFA', CAD: 'C$', AUD: 'A$',
  CHF: 'CHF', SEK: 'kr', NOK: 'kr', DKK: 'kr',
};

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency + ' ';
}

export function formatCurrencyAmount(amount: number | string, currency: string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
  const sym = getCurrencySymbol(currency);
  return `${sym}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const PAYMENT_LIMITS: Record<string, { min: number; max: number }> = {
  USD: { min: 1, max: 999999 },
  EUR: { min: 1, max: 999999 },
  GBP: { min: 1, max: 999999 },
  NGN: { min: 100, max: 10000000 },
  KES: { min: 10, max: 1000000 },
  GHS: { min: 1, max: 100000 },
  ZAR: { min: 10, max: 1000000 },
};

export const AFRICAN_COUNTRIES = ['NG', 'GH', 'KE', 'ZA', 'EG', 'RW', 'CI'] as const;

export type AfricanCountryCode = typeof AFRICAN_COUNTRIES[number];

export function isPaystackRegion(countryCode: string): boolean {
  return AFRICAN_COUNTRIES.includes(countryCode as AfricanCountryCode);
}

export const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  'NG': 'nigeria',
  'GH': 'ghana',
  'ZA': 'south africa',
  'KE': 'kenya',
  'EG': 'egypt',
  'CI': "cote d'ivoire",
  'RW': 'rwanda',
};
