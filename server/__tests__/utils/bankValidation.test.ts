import { describe, it, expect } from 'vitest';
import { validateBankDetails, getRequiredBankFields } from '../../utils/bankValidation';

// ============================================================================
// Bank Detail Validation Tests
// Tests country-specific bank account validation for all 25 supported countries
// ============================================================================

// ============================================================================
// US (ACH) Validation Tests
// ============================================================================
describe('US Bank Validation', () => {
  it('accepts valid US bank details', () => {
    const result = validateBankDetails({
      countryCode: 'US',
      routingNumber: '021000021', // JPMorgan Chase
      accountNumber: '123456789',
      accountName: 'John Doe',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects invalid routing number length', () => {
    const result = validateBankDetails({
      countryCode: 'US',
      routingNumber: '12345', // Too short
      accountNumber: '123456789',
      accountName: 'John Doe',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('9 digits'))).toBe(true);
  });

  it('rejects invalid routing number checksum', () => {
    const result = validateBankDetails({
      countryCode: 'US',
      routingNumber: '123456789', // Invalid checksum
      accountNumber: '123456789',
      accountName: 'John Doe',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('checksum'))).toBe(true);
  });

  it('rejects missing routing number', () => {
    const result = validateBankDetails({
      countryCode: 'US',
      accountNumber: '123456789',
      accountName: 'John Doe',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Routing number'))).toBe(true);
  });

  it('rejects missing account number', () => {
    const result = validateBankDetails({
      countryCode: 'US',
      routingNumber: '021000021',
      accountName: 'John Doe',
    });
    expect(result.valid).toBe(false);
  });

  it('rejects account number too short', () => {
    const result = validateBankDetails({
      countryCode: 'US',
      routingNumber: '021000021',
      accountNumber: '123',
      accountName: 'John Doe',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('4-17 digits'))).toBe(true);
  });
});

// ============================================================================
// UK (BACS) Validation Tests
// ============================================================================
describe('UK Bank Validation', () => {
  it('accepts valid UK sort code and account number', () => {
    const result = validateBankDetails({
      countryCode: 'GB',
      sortCode: '200000',
      accountNumber: '12345678',
      accountName: 'Jane Smith',
    });
    expect(result.valid).toBe(true);
  });

  it('accepts sort code with hyphens', () => {
    const result = validateBankDetails({
      countryCode: 'GB',
      sortCode: '20-00-00',
      accountNumber: '12345678',
      accountName: 'Jane Smith',
    });
    expect(result.valid).toBe(true);
  });

  it('accepts valid UK IBAN instead of sort code', () => {
    const result = validateBankDetails({
      countryCode: 'GB',
      iban: 'GB29 NWBK 6016 1331 9268 19',
      accountName: 'Jane Smith',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid sort code length', () => {
    const result = validateBankDetails({
      countryCode: 'GB',
      sortCode: '2000',
      accountNumber: '12345678',
      accountName: 'Jane Smith',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('6 digits'))).toBe(true);
  });

  it('rejects invalid UK account number length', () => {
    const result = validateBankDetails({
      countryCode: 'GB',
      sortCode: '200000',
      accountNumber: '1234',
      accountName: 'Jane Smith',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('8 digits'))).toBe(true);
  });
});

// ============================================================================
// Australia (BECS) Validation Tests
// ============================================================================
describe('AU Bank Validation', () => {
  it('accepts valid Australian bank details', () => {
    const result = validateBankDetails({
      countryCode: 'AU',
      bsb: '062000',
      accountNumber: '123456789',
      accountName: 'Bruce Wayne',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid BSB', () => {
    const result = validateBankDetails({
      countryCode: 'AU',
      bsb: '1234',
      accountNumber: '123456789',
      accountName: 'Bruce Wayne',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('BSB'))).toBe(true);
  });

  it('rejects missing BSB', () => {
    const result = validateBankDetails({
      countryCode: 'AU',
      accountNumber: '123456789',
      accountName: 'Bruce Wayne',
    });
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// SEPA/IBAN Validation Tests (EU countries)
// ============================================================================
describe('SEPA IBAN Validation', () => {
  it('accepts valid German IBAN', () => {
    const result = validateBankDetails({
      countryCode: 'DE',
      iban: 'DE89370400440532013000',
      accountName: 'Hans Muller',
    });
    expect(result.valid).toBe(true);
  });

  it('accepts valid French IBAN', () => {
    const result = validateBankDetails({
      countryCode: 'FR',
      iban: 'FR7630006000011234567890189',
      accountName: 'Pierre Dupont',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects IBAN with wrong country prefix', () => {
    const result = validateBankDetails({
      countryCode: 'DE',
      iban: 'FR7630006000011234567890189', // French IBAN for German account
      accountName: 'Hans Muller',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('must start with DE'))).toBe(true);
  });

  it('rejects IBAN with wrong length', () => {
    const result = validateBankDetails({
      countryCode: 'DE',
      iban: 'DE8937040044053201300', // Too short
      accountName: 'Hans Muller',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('22 characters'))).toBe(true);
  });

  it('rejects invalid IBAN checksum', () => {
    const result = validateBankDetails({
      countryCode: 'DE',
      iban: 'DE00370400440532013000', // Invalid check digits
      accountName: 'Hans Muller',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('checksum'))).toBe(true);
  });

  it('accepts valid Dutch IBAN', () => {
    const result = validateBankDetails({
      countryCode: 'NL',
      iban: 'NL91ABNA0417164300',
      accountName: 'Jan de Vries',
    });
    expect(result.valid).toBe(true);
  });

  it('requires IBAN for EU countries', () => {
    const result = validateBankDetails({
      countryCode: 'DE',
      accountName: 'Hans Muller',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('IBAN is required'))).toBe(true);
  });
});

// ============================================================================
// Nigeria (NUBAN) Validation Tests
// ============================================================================
describe('NG Bank Validation', () => {
  it('accepts valid Nigerian NUBAN', () => {
    const result = validateBankDetails({
      countryCode: 'NG',
      accountNumber: '0123456789',
      bankName: 'Access Bank',
      accountName: 'Chidi Okafor',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects non-10-digit NUBAN', () => {
    const result = validateBankDetails({
      countryCode: 'NG',
      accountNumber: '123456',
      bankName: 'Access Bank',
      accountName: 'Chidi Okafor',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('10 digits'))).toBe(true);
  });

  it('requires bank name', () => {
    const result = validateBankDetails({
      countryCode: 'NG',
      accountNumber: '0123456789',
      accountName: 'Chidi Okafor',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Bank name'))).toBe(true);
  });
});

// ============================================================================
// South Africa Validation Tests
// ============================================================================
describe('ZA Bank Validation', () => {
  it('accepts valid South African bank details', () => {
    const result = validateBankDetails({
      countryCode: 'ZA',
      accountNumber: '1234567890',
      routingNumber: '250655',
      accountName: 'Thabo Mbeki',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid branch code', () => {
    const result = validateBankDetails({
      countryCode: 'ZA',
      accountNumber: '1234567890',
      routingNumber: '1234', // Too short
      accountName: 'Thabo Mbeki',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('6 digits'))).toBe(true);
  });
});

// ============================================================================
// Canada Validation Tests
// ============================================================================
describe('CA Bank Validation', () => {
  it('accepts valid Canadian bank details', () => {
    const result = validateBankDetails({
      countryCode: 'CA',
      routingNumber: '12345678',
      accountNumber: '1234567',
      accountName: 'Wayne Gretzky',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid transit number length', () => {
    const result = validateBankDetails({
      countryCode: 'CA',
      routingNumber: '1234',
      accountNumber: '1234567',
      accountName: 'Wayne Gretzky',
    });
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// Common Validation Tests
// ============================================================================
describe('Common Validations', () => {
  it('requires account holder name', () => {
    const result = validateBankDetails({
      countryCode: 'US',
      routingNumber: '021000021',
      accountNumber: '123456789',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Account holder name'))).toBe(true);
  });

  it('rejects short account holder name', () => {
    const result = validateBankDetails({
      countryCode: 'US',
      routingNumber: '021000021',
      accountNumber: '123456789',
      accountName: 'J',
    });
    expect(result.valid).toBe(false);
  });

  it('rejects unsupported country', () => {
    const result = validateBankDetails({
      countryCode: 'XX',
      accountNumber: '123456789',
      accountName: 'Test User',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('not supported'))).toBe(true);
  });

  it('handles lowercase country codes', () => {
    const result = validateBankDetails({
      countryCode: 'us',
      routingNumber: '021000021',
      accountNumber: '123456789',
      accountName: 'John Doe',
    });
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// getRequiredBankFields Tests
// ============================================================================
describe('getRequiredBankFields', () => {
  it('returns routing + account for US', () => {
    const fields = getRequiredBankFields('US');
    expect(fields).toContain('routingNumber');
    expect(fields).toContain('accountNumber');
    expect(fields).toContain('accountName');
  });

  it('returns sort code + account for UK', () => {
    const fields = getRequiredBankFields('GB');
    expect(fields).toContain('sortCode');
    expect(fields).toContain('accountNumber');
  });

  it('returns BSB + account for AU', () => {
    const fields = getRequiredBankFields('AU');
    expect(fields).toContain('bsb');
    expect(fields).toContain('accountNumber');
  });

  it('returns IBAN for EU countries', () => {
    for (const code of ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'SE', 'NO', 'DK', 'FI', 'CH', 'PT', 'IE']) {
      const fields = getRequiredBankFields(code);
      expect(fields).toContain('iban');
    }
  });

  it('returns bank name + account for African countries', () => {
    for (const code of ['NG', 'GH', 'KE', 'RW', 'CI']) {
      const fields = getRequiredBankFields(code);
      expect(fields).toContain('bankName');
      expect(fields).toContain('accountNumber');
    }
  });

  it('returns IBAN for Egypt', () => {
    const fields = getRequiredBankFields('EG');
    expect(fields).toContain('iban');
  });

  it('returns routing + account for South Africa', () => {
    const fields = getRequiredBankFields('ZA');
    expect(fields).toContain('routingNumber');
    expect(fields).toContain('accountNumber');
  });
});
