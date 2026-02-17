/**
 * Bank Detail Validation per Country
 * Validates bank account details based on country-specific rules
 */

export interface BankValidationResult {
  valid: boolean;
  errors: string[];
}

interface BankDetails {
  countryCode: string;
  accountNumber?: string;
  routingNumber?: string;
  sortCode?: string;
  iban?: string;
  bsb?: string;
  bankName?: string;
  accountName?: string;
}

// IBAN validation (used for EU/UK countries)
function validateIBAN(iban: string): boolean {
  const cleanIban = iban.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(cleanIban)) return false;

  // Move first 4 chars to end
  const rearranged = cleanIban.substring(4) + cleanIban.substring(0, 4);

  // Replace letters with numbers (A=10, B=11, etc.)
  let numStr = '';
  for (const char of rearranged) {
    if (char >= 'A' && char <= 'Z') {
      numStr += (char.charCodeAt(0) - 55).toString();
    } else {
      numStr += char;
    }
  }

  // Mod 97 check
  let remainder = 0;
  for (let i = 0; i < numStr.length; i++) {
    remainder = (remainder * 10 + parseInt(numStr[i])) % 97;
  }

  return remainder === 1;
}

// Luhn check (used for some account numbers)
function luhnCheck(number: string): boolean {
  const digits = number.replace(/\D/g, '');
  let sum = 0;
  let isEven = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i]);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}

// Country-specific validators
const countryValidators: Record<string, (details: BankDetails) => BankValidationResult> = {
  // ============ US - ACH ============
  US: (details) => {
    const errors: string[] = [];
    if (!details.routingNumber) {
      errors.push('Routing number (ABA) is required for US accounts');
    } else if (!/^\d{9}$/.test(details.routingNumber)) {
      errors.push('US routing number must be exactly 9 digits');
    } else {
      // ABA checksum validation
      const d = details.routingNumber.split('').map(Number);
      const checksum = (3*(d[0]+d[3]+d[6]) + 7*(d[1]+d[4]+d[7]) + (d[2]+d[5]+d[8])) % 10;
      if (checksum !== 0) errors.push('Invalid US routing number checksum');
    }
    if (!details.accountNumber) {
      errors.push('Account number is required for US accounts');
    } else if (!/^\d{4,17}$/.test(details.accountNumber)) {
      errors.push('US account number must be 4-17 digits');
    }
    return { valid: errors.length === 0, errors };
  },

  // ============ CA - ACH ============
  CA: (details) => {
    const errors: string[] = [];
    if (!details.routingNumber) {
      errors.push('Transit/institution number is required for Canadian accounts');
    } else if (!/^\d{8,9}$/.test(details.routingNumber)) {
      errors.push('Canadian routing number must be 8-9 digits (transit + institution)');
    }
    if (!details.accountNumber) {
      errors.push('Account number is required');
    } else if (!/^\d{5,12}$/.test(details.accountNumber)) {
      errors.push('Canadian account number must be 5-12 digits');
    }
    return { valid: errors.length === 0, errors };
  },

  // ============ GB - BACS ============
  GB: (details) => {
    const errors: string[] = [];
    if (details.iban) {
      if (!validateIBAN(details.iban)) errors.push('Invalid UK IBAN');
      if (!details.iban.toUpperCase().startsWith('GB')) errors.push('UK IBAN must start with GB');
    } else {
      if (!details.sortCode) {
        errors.push('Sort code is required for UK accounts');
      } else if (!/^\d{6}$/.test(details.sortCode.replace(/-/g, ''))) {
        errors.push('UK sort code must be 6 digits');
      }
      if (!details.accountNumber) {
        errors.push('Account number is required for UK accounts');
      } else if (!/^\d{8}$/.test(details.accountNumber)) {
        errors.push('UK account number must be exactly 8 digits');
      }
    }
    return { valid: errors.length === 0, errors };
  },

  // ============ AU - BECS ============
  AU: (details) => {
    const errors: string[] = [];
    if (!details.bsb) {
      errors.push('BSB is required for Australian accounts');
    } else if (!/^\d{6}$/.test(details.bsb.replace(/-/g, ''))) {
      errors.push('Australian BSB must be 6 digits');
    }
    if (!details.accountNumber) {
      errors.push('Account number is required');
    } else if (!/^\d{5,9}$/.test(details.accountNumber)) {
      errors.push('Australian account number must be 5-9 digits');
    }
    return { valid: errors.length === 0, errors };
  },

  // ============ EU SEPA countries ============
  DE: (details) => validateSEPA(details, 'DE', 22),
  FR: (details) => validateSEPA(details, 'FR', 27),
  ES: (details) => validateSEPA(details, 'ES', 24),
  IT: (details) => validateSEPA(details, 'IT', 27),
  NL: (details) => validateSEPA(details, 'NL', 18),
  BE: (details) => validateSEPA(details, 'BE', 16),
  AT: (details) => validateSEPA(details, 'AT', 20),
  SE: (details) => validateSEPA(details, 'SE', 24),
  NO: (details) => validateSEPA(details, 'NO', 15),
  DK: (details) => validateSEPA(details, 'DK', 18),
  FI: (details) => validateSEPA(details, 'FI', 18),
  CH: (details) => validateSEPA(details, 'CH', 21),
  PT: (details) => validateSEPA(details, 'PT', 25),
  IE: (details) => validateSEPA(details, 'IE', 22),

  // ============ African countries (Paystack) ============
  NG: (details) => {
    const errors: string[] = [];
    if (!details.accountNumber) {
      errors.push('NUBAN account number is required');
    } else if (!/^\d{10}$/.test(details.accountNumber)) {
      errors.push('Nigerian NUBAN account number must be exactly 10 digits');
    }
    if (!details.bankName) {
      errors.push('Bank name/code is required for Nigerian accounts');
    }
    return { valid: errors.length === 0, errors };
  },

  GH: (details) => {
    const errors: string[] = [];
    if (!details.accountNumber) {
      errors.push('Account number is required');
    } else if (!/^\d{9,16}$/.test(details.accountNumber)) {
      errors.push('Ghanaian account number must be 9-16 digits');
    }
    if (!details.bankName) {
      errors.push('Bank name/code is required');
    }
    return { valid: errors.length === 0, errors };
  },

  ZA: (details) => {
    const errors: string[] = [];
    if (!details.accountNumber) {
      errors.push('Account number is required');
    } else if (!/^\d{7,11}$/.test(details.accountNumber)) {
      errors.push('South African account number must be 7-11 digits');
    }
    if (!details.routingNumber) {
      errors.push('Branch code is required for South African accounts');
    } else if (!/^\d{6}$/.test(details.routingNumber)) {
      errors.push('South African branch code must be 6 digits');
    }
    return { valid: errors.length === 0, errors };
  },

  KE: (details) => {
    const errors: string[] = [];
    if (!details.accountNumber) {
      errors.push('Account number is required');
    } else if (!/^\d{8,14}$/.test(details.accountNumber)) {
      errors.push('Kenyan account number must be 8-14 digits');
    }
    if (!details.bankName) {
      errors.push('Bank name/code is required');
    }
    return { valid: errors.length === 0, errors };
  },

  EG: (details) => {
    const errors: string[] = [];
    if (details.iban) {
      if (!validateIBAN(details.iban)) errors.push('Invalid Egyptian IBAN');
      if (!details.iban.toUpperCase().startsWith('EG')) errors.push('Egyptian IBAN must start with EG');
    } else if (!details.accountNumber) {
      errors.push('Account number or IBAN is required');
    }
    return { valid: errors.length === 0, errors };
  },

  RW: (details) => {
    const errors: string[] = [];
    if (!details.accountNumber) {
      errors.push('Account number is required');
    } else if (!/^\d{10,16}$/.test(details.accountNumber)) {
      errors.push('Rwandan account number must be 10-16 digits');
    }
    if (!details.bankName) {
      errors.push('Bank name is required');
    }
    return { valid: errors.length === 0, errors };
  },

  CI: (details) => {
    const errors: string[] = [];
    if (!details.accountNumber) {
      errors.push('Account number is required');
    }
    if (!details.bankName) {
      errors.push('Bank name is required');
    }
    return { valid: errors.length === 0, errors };
  },
};

// SEPA IBAN validation helper
function validateSEPA(details: BankDetails, countryPrefix: string, expectedLength: number): BankValidationResult {
  const errors: string[] = [];
  if (!details.iban) {
    errors.push(`IBAN is required for ${countryPrefix} accounts`);
  } else {
    const clean = details.iban.replace(/\s/g, '').toUpperCase();
    if (!clean.startsWith(countryPrefix)) {
      errors.push(`IBAN must start with ${countryPrefix}`);
    }
    if (clean.length !== expectedLength) {
      errors.push(`${countryPrefix} IBAN must be exactly ${expectedLength} characters`);
    }
    if (!validateIBAN(clean)) {
      errors.push('Invalid IBAN checksum');
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate bank details for a given country
 */
export function validateBankDetails(details: BankDetails): BankValidationResult {
  const countryCode = details.countryCode.toUpperCase();

  const validator = countryValidators[countryCode];
  if (!validator) {
    return {
      valid: false,
      errors: [`Bank validation not supported for country: ${countryCode}`],
    };
  }

  // Common validations
  const errors: string[] = [];
  if (!details.accountName || details.accountName.trim().length < 2) {
    errors.push('Account holder name is required (minimum 2 characters)');
  }

  const countryResult = validator(details);

  return {
    valid: errors.length === 0 && countryResult.valid,
    errors: [...errors, ...countryResult.errors],
  };
}

/**
 * Get required fields for a country
 */
export function getRequiredBankFields(countryCode: string): string[] {
  const code = countryCode.toUpperCase();
  const baseFields = ['accountName', 'countryCode'];

  switch (code) {
    case 'US':
    case 'CA':
      return [...baseFields, 'routingNumber', 'accountNumber'];
    case 'GB':
      return [...baseFields, 'sortCode', 'accountNumber']; // or IBAN
    case 'AU':
      return [...baseFields, 'bsb', 'accountNumber'];
    case 'NG':
    case 'GH':
    case 'KE':
    case 'RW':
    case 'CI':
      return [...baseFields, 'bankName', 'accountNumber'];
    case 'ZA':
      return [...baseFields, 'routingNumber', 'accountNumber'];
    case 'EG':
      return [...baseFields, 'iban']; // or accountNumber
    default:
      // SEPA countries
      if (['DE','FR','ES','IT','NL','BE','AT','SE','NO','DK','FI','CH','PT','IE'].includes(code)) {
        return [...baseFields, 'iban'];
      }
      return baseFields;
  }
}
