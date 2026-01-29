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
