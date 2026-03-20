/**
 * Payment validators — IBAN checksum (MOD-97), NUBAN checksum (CBN algorithm),
 * and transfer request validation.
 */

import {
  getCountryConfig,
  PAYMENT_LIMITS,
  SUPPORTED_COUNTRIES,
  type CountryConfig,
} from '../../shared/constants';

// ── IBAN validation ──────────────────────────────────────────────

/** Expected IBAN lengths per country (ISO 13616). */
const IBAN_LENGTHS: Record<string, number> = {
  AL: 28, AD: 24, AT: 20, AZ: 28, BH: 22, BY: 28, BE: 16, BA: 20,
  BR: 29, BG: 22, CR: 22, HR: 21, CY: 28, CZ: 24, DK: 18, DO: 28,
  TL: 23, EG: 29, SV: 28, EE: 20, FO: 18, FI: 18, FR: 27, GE: 22,
  DE: 22, GI: 23, GR: 27, GL: 18, GT: 28, HU: 28, IS: 26, IQ: 23,
  IE: 22, IL: 23, IT: 27, JO: 30, KZ: 20, XK: 20, KW: 30, LV: 21,
  LB: 28, LI: 21, LT: 20, LU: 20, MK: 19, MT: 31, MR: 27, MU: 30,
  MC: 27, MD: 24, ME: 22, NL: 18, NO: 15, PK: 24, PS: 29, PL: 28,
  PT: 25, QA: 29, RO: 24, LC: 32, SM: 27, ST: 25, SA: 24, RS: 22,
  SC: 31, SK: 24, SI: 19, ES: 24, SE: 24, CH: 21, TN: 24, TR: 26,
  UA: 29, AE: 23, GB: 22, VA: 22, VG: 24,
};

/**
 * Validate an IBAN string using country-specific length check and the MOD-97 checksum algorithm.
 * Returns `{ valid: true, country }` on success or `{ valid: false, country, error }` on failure.
 */
export function validateIBAN(iban: string): { valid: boolean; country: string; error?: string } {
  // Normalise: strip spaces and uppercase
  const cleaned = iban.replace(/\s+/g, '').toUpperCase();
  const country = cleaned.substring(0, 2);

  // Must start with two letters
  if (!/^[A-Z]{2}/.test(cleaned)) {
    return { valid: false, country, error: 'IBAN must start with a 2-letter country code' };
  }

  // Check digits must be numeric
  if (!/^[A-Z]{2}\d{2}/.test(cleaned)) {
    return { valid: false, country, error: 'IBAN check digits (positions 3-4) must be numeric' };
  }

  // Remaining characters must be alphanumeric
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned)) {
    return { valid: false, country, error: 'IBAN contains invalid characters' };
  }

  // Country-specific length
  const expectedLength = IBAN_LENGTHS[country];
  if (expectedLength) {
    if (cleaned.length !== expectedLength) {
      return {
        valid: false,
        country,
        error: `IBAN for ${country} must be exactly ${expectedLength} characters (got ${cleaned.length})`,
      };
    }
  } else if (cleaned.length < 15 || cleaned.length > 34) {
    return { valid: false, country, error: 'IBAN length is outside the valid range (15-34)' };
  }

  // MOD-97 checksum (ISO 7064)
  // Move first 4 chars to end, replace letters with 2-digit numbers (A=10 .. Z=35), compute mod 97.
  const rearranged = cleaned.substring(4) + cleaned.substring(0, 4);
  let numericString = '';
  for (const ch of rearranged) {
    if (ch >= '0' && ch <= '9') {
      numericString += ch;
    } else {
      numericString += String(ch.charCodeAt(0) - 55); // A=10 … Z=35
    }
  }

  // Compute mod 97 on potentially very long number — process in chunks
  let remainder = 0;
  for (let i = 0; i < numericString.length; i += 7) {
    const chunk = String(remainder) + numericString.substring(i, i + 7);
    remainder = parseInt(chunk, 10) % 97;
  }

  if (remainder !== 1) {
    return { valid: false, country, error: 'IBAN checksum (MOD-97) is invalid' };
  }

  return { valid: true, country };
}

// ── NUBAN validation (Nigeria) ───────────────────────────────────

/**
 * Validate a Nigerian Uniform Bank Account Number (NUBAN) using the CBN algorithm.
 *
 * The algorithm concatenates the 3-digit bank code with the 10-digit account number
 * (producing a 13-digit string), applies weights `[3,7,3,3,7,3,3,7,3,3,7,3,3]`
 * but only the first 12 are used in the sum; the 13th digit (i.e. account number
 * digit 10) is the check digit.
 *
 * Specifically for NUBAN:
 *   serial = bankCode (3 digits) + first 9 digits of accountNumber
 *   weights = [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3]
 *   sum = Σ (serial[i] * weight[i])
 *   checkDigit = (10 - (sum % 10)) % 10
 *   valid if checkDigit === 10th digit of accountNumber
 */
export function validateNUBAN(accountNumber: string, bankCode: string): boolean {
  // Basic format check
  if (!/^\d{10}$/.test(accountNumber)) return false;
  if (!/^\d{3}$/.test(bankCode)) return false;

  const serial = bankCode + accountNumber.substring(0, 9);
  const weights = [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3];

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(serial[i], 10) * weights[i];
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(accountNumber[9], 10);
}

// ── Currency ↔ Country validation ────────────────────────────────

/** Map from currency code to the set of country codes that legitimately use it. */
const CURRENCY_TO_COUNTRIES: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const c of SUPPORTED_COUNTRIES) {
    if (!map[c.currency]) map[c.currency] = [];
    map[c.currency].push(c.code);
  }
  return map;
})();

/**
 * Check whether a destination country is valid for a given transfer currency.
 * Returns `{ valid: true }` or `{ valid: false, error }`.
 */
export function validateCurrencyCountryMatch(
  currency: string,
  countryCode: string,
): { valid: boolean; error?: string } {
  const upper = countryCode.toUpperCase();
  const config = getCountryConfig(upper);
  if (!config) {
    return { valid: false, error: `Country '${upper}' is not supported` };
  }

  // The currency must match the country's native currency
  if (config.currency !== currency.toUpperCase()) {
    return {
      valid: false,
      error: `Currency ${currency.toUpperCase()} is not valid for ${config.name} (${upper}). Expected ${config.currency}.`,
    };
  }

  return { valid: true };
}

// ── Account format validation per country ────────────────────────

/**
 * Validate that the account identifier is in the correct format for the destination country.
 */
export function validateAccountFormatForCountry(
  countryCode: string,
  details: {
    accountNumber?: string;
    bankCode?: string;
    routingNumber?: string;
    sortCode?: string;
    bsbNumber?: string;
    iban?: string;
  },
): { valid: boolean; error?: string } {
  const country = countryCode.toUpperCase();
  const config = getCountryConfig(country);
  if (!config) {
    return { valid: false, error: `Country '${country}' is not supported` };
  }

  if (config.provider === 'paystack') {
    // African countries — need accountNumber + bankCode
    if (!details.accountNumber) {
      return { valid: false, error: 'Account number is required' };
    }
    if (!details.bankCode) {
      return { valid: false, error: 'Bank code is required' };
    }

    switch (country) {
      case 'NG':
        if (!/^\d{10}$/.test(details.accountNumber)) {
          return { valid: false, error: 'Nigerian account number must be exactly 10 digits' };
        }
        if (!/^\d{3}$/.test(details.bankCode)) {
          return { valid: false, error: 'Nigerian bank code must be 3 digits' };
        }
        // NUBAN checksum
        if (!validateNUBAN(details.accountNumber, details.bankCode)) {
          return { valid: false, error: 'Nigerian account number failed NUBAN checksum validation' };
        }
        break;
      case 'GH':
        if (!/^\d{10,16}$/.test(details.accountNumber)) {
          return { valid: false, error: 'Ghanaian account number must be 10-16 digits' };
        }
        break;
      case 'ZA':
        if (!/^\d{8,12}$/.test(details.accountNumber)) {
          return { valid: false, error: 'South African account number must be 8-12 digits' };
        }
        if (!/^\d{6}$/.test(details.bankCode)) {
          return { valid: false, error: 'South African branch code must be 6 digits' };
        }
        break;
      case 'KE':
        // M-Pesa mobile or bank account
        if (!/^(254|0)[17]\d{8,9}$/.test(details.accountNumber) && !/^\d{8,14}$/.test(details.accountNumber)) {
          return { valid: false, error: 'Kenyan account/mobile number format is invalid' };
        }
        break;
      case 'EG':
        if (!/^\d{10,29}$/.test(details.accountNumber.replace(/\s/g, ''))) {
          return { valid: false, error: 'Egyptian account number must be 10-29 digits' };
        }
        break;
      case 'RW':
        if (!/^(250|07)\d{7,9}$/.test(details.accountNumber) && !/^\d{8,16}$/.test(details.accountNumber)) {
          return { valid: false, error: 'Rwandan account/mobile number format is invalid' };
        }
        break;
      case 'CI':
        if (!/^(225|0)\d{8,10}$/.test(details.accountNumber) && !/^\d{8,16}$/.test(details.accountNumber)) {
          return { valid: false, error: 'Ivorian account/mobile number format is invalid' };
        }
        break;
    }
  } else {
    // Stripe countries
    switch (country) {
      case 'US':
      case 'CA':
        if (!details.routingNumber && !details.bankCode) {
          return { valid: false, error: 'Routing number is required for US/CA transfers' };
        }
        if (!details.accountNumber) {
          return { valid: false, error: 'Account number is required for US/CA transfers' };
        }
        break;
      case 'GB':
        if (!details.sortCode && !details.bankCode) {
          return { valid: false, error: 'Sort code is required for UK transfers' };
        }
        if (!details.accountNumber) {
          return { valid: false, error: 'Account number is required for UK transfers' };
        }
        break;
      case 'AU':
        if (!details.bsbNumber && !details.bankCode) {
          return { valid: false, error: 'BSB number is required for AU transfers' };
        }
        if (!details.accountNumber) {
          return { valid: false, error: 'Account number is required for AU transfers' };
        }
        break;
      default: {
        // EU — require IBAN
        const ibanValue = details.iban || details.accountNumber;
        if (!ibanValue) {
          return { valid: false, error: 'IBAN is required for EU transfers' };
        }
        const ibanResult = validateIBAN(ibanValue);
        if (!ibanResult.valid) {
          return { valid: false, error: ibanResult.error };
        }
        break;
      }
    }
  }

  return { valid: true };
}

// ── Full transfer request validation ─────────────────────────────

export interface TransferValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Comprehensive transfer request validation. Checks:
 * 1. Currency matches destination country
 * 2. Amount within country-specific limits
 * 3. Account format valid for country
 * 4. Provider available for the route
 */
export function validateTransferRequest(params: {
  amount: number;
  countryCode: string;
  currency: string;
  recipientDetails: {
    accountNumber?: string;
    bankCode?: string;
    routingNumber?: string;
    sortCode?: string;
    bsbNumber?: string;
    iban?: string;
  };
}): TransferValidationResult {
  const errors: string[] = [];
  const { amount, countryCode, currency, recipientDetails } = params;
  const upper = countryCode.toUpperCase();

  // 1. Country must be supported
  const config = getCountryConfig(upper);
  if (!config) {
    errors.push(`Country '${upper}' is not supported for transfers`);
    return { valid: false, errors };
  }

  // 2. Currency must match country
  const currencyCheck = validateCurrencyCountryMatch(currency, upper);
  if (!currencyCheck.valid) {
    errors.push(currencyCheck.error!);
  }

  // 3. Amount within limits
  const limits = PAYMENT_LIMITS[currency.toUpperCase()];
  if (limits) {
    if (amount < limits.min) {
      errors.push(`Amount ${amount} is below the minimum of ${limits.min} ${currency}`);
    }
    if (amount > limits.max) {
      errors.push(`Amount ${amount} exceeds the maximum of ${limits.max} ${currency}`);
    }
  }

  // 4. Account format valid for country
  const formatCheck = validateAccountFormatForCountry(upper, recipientDetails);
  if (!formatCheck.valid) {
    errors.push(formatCheck.error!);
  }

  // 5. Provider available
  // This is implicit — if the country is supported, a provider is available.
  // But we double-check that the config maps to a known provider.
  if (config.provider !== 'stripe' && config.provider !== 'paystack') {
    errors.push(`No payment provider available for ${config.name}`);
  }

  return { valid: errors.length === 0, errors };
}
