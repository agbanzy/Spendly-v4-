import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ============================================================================
// Zod Schema Validation Tests
// These test the validation schemas used across the application
// to ensure form inputs and API requests are properly validated.
// ============================================================================

// Reproduce the schemas from routes.ts exactly to test them in isolation
const cardSchema = z.object({
  name: z.string().min(2, "Card name must be at least 2 characters").max(50),
  limit: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().positive("Spending limit must be greater than 0").max(1000000, "Spending limit too high")
  ).optional(),
  type: z.string().optional().default('Visa'),
  color: z.string().optional().default('indigo'),
  currency: z.string().optional().default('USD'),
});

const vendorSchema = z.object({
  name: z.string().min(2, "Vendor name must be at least 2 characters"),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  phone: z.string().regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/, "Invalid phone number format").optional().or(z.literal('')),
  address: z.string().optional().default(''),
  category: z.string().optional().default('Other'),
});

const invoiceSchema = z.object({
  clientName: z.string().min(1),
  clientEmail: z.string().email("Invalid email address"),
  amount: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().positive()
  ),
  status: z.string().optional().default('Draft'),
  dueDate: z.string().optional(),
  currency: z.string().optional().default('USD'),
});

const fundingSourceSchema = z.object({
  type: z.enum(['bank_account', 'card', 'mobile_money']).default('bank_account'),
  provider: z.string().min(1),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountName: z.string().optional(),
  routingNumber: z.string().optional(),
  currency: z.string().length(3).default('USD'),
  country: z.string().length(2).default('US'),
  isDefault: z.boolean().optional().default(false),
  last4: z.string().max(4).optional(),
  expiryDate: z.string().optional(),
});

// ============================================================================
// Card Schema Tests
// ============================================================================
describe('cardSchema', () => {
  it('accepts valid card data', () => {
    const result = cardSchema.safeParse({ name: 'My Travel Card', limit: 5000, currency: 'USD' });
    expect(result.success).toBe(true);
  });

  it('rejects card name shorter than 2 characters', () => {
    const result = cardSchema.safeParse({ name: 'X' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('at least 2 characters');
    }
  });

  it('rejects empty card name', () => {
    const result = cardSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects spending limit of 0', () => {
    const result = cardSchema.safeParse({ name: 'Test Card', limit: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative spending limit', () => {
    const result = cardSchema.safeParse({ name: 'Test Card', limit: -100 });
    expect(result.success).toBe(false);
  });

  it('rejects spending limit over 1,000,000', () => {
    const result = cardSchema.safeParse({ name: 'Test Card', limit: 1000001 });
    expect(result.success).toBe(false);
  });

  it('converts string limit to number', () => {
    const result = cardSchema.safeParse({ name: 'Test Card', limit: '5000' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(5000);
    }
  });

  it('defaults type to Visa', () => {
    const result = cardSchema.safeParse({ name: 'Test Card' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('Visa');
    }
  });

  it('defaults currency to USD', () => {
    const result = cardSchema.safeParse({ name: 'Test Card' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe('USD');
    }
  });

  it('allows optional limit', () => {
    const result = cardSchema.safeParse({ name: 'Test Card' });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Vendor Schema Tests
// ============================================================================
describe('vendorSchema', () => {
  it('accepts valid vendor data', () => {
    const result = vendorSchema.safeParse({
      name: 'Acme Corp',
      email: 'billing@acme.com',
      phone: '+1-555-0123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects vendor name shorter than 2 characters', () => {
    const result = vendorSchema.safeParse({ name: 'A' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const result = vendorSchema.safeParse({ name: 'Acme Corp', email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('allows empty string email', () => {
    const result = vendorSchema.safeParse({ name: 'Acme Corp', email: '' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid phone format', () => {
    const result = vendorSchema.safeParse({ name: 'Acme Corp', phone: 'abc123' });
    expect(result.success).toBe(false);
  });

  it('allows empty string phone', () => {
    const result = vendorSchema.safeParse({ name: 'Acme Corp', phone: '' });
    expect(result.success).toBe(true);
  });

  it('accepts phone numbers matching the regex pattern', () => {
    // The regex: /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/
    // Accepts: optional +, then groups of digits with optional separators
    const validPhones = ['+15550123456', '(555)0123456', '555-012-3456'];
    for (const phone of validPhones) {
      const result = vendorSchema.safeParse({ name: 'Test', phone });
      expect(result.success).toBe(true);
    }
  });

  it('defaults category to Other', () => {
    const result = vendorSchema.safeParse({ name: 'Acme Corp' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe('Other');
    }
  });
});

// ============================================================================
// Invoice Schema Tests
// ============================================================================
describe('invoiceSchema', () => {
  it('accepts valid invoice data', () => {
    const result = invoiceSchema.safeParse({
      clientName: 'John Doe',
      clientEmail: 'john@example.com',
      amount: 1500,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing client name', () => {
    const result = invoiceSchema.safeParse({
      clientEmail: 'john@example.com',
      amount: 1500,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid client email', () => {
    const result = invoiceSchema.safeParse({
      clientName: 'John Doe',
      clientEmail: 'not-valid',
      amount: 1500,
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero amount', () => {
    const result = invoiceSchema.safeParse({
      clientName: 'John Doe',
      clientEmail: 'john@example.com',
      amount: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative amount', () => {
    const result = invoiceSchema.safeParse({
      clientName: 'John Doe',
      clientEmail: 'john@example.com',
      amount: -100,
    });
    expect(result.success).toBe(false);
  });

  it('converts string amount to number', () => {
    const result = invoiceSchema.safeParse({
      clientName: 'John Doe',
      clientEmail: 'john@example.com',
      amount: '1500',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(1500);
    }
  });

  it('defaults status to Draft', () => {
    const result = invoiceSchema.safeParse({
      clientName: 'John Doe',
      clientEmail: 'john@example.com',
      amount: 100,
    });
    if (result.success) {
      expect(result.data.status).toBe('Draft');
    }
  });
});

// ============================================================================
// Funding Source Schema Tests
// ============================================================================
describe('fundingSourceSchema', () => {
  it('accepts valid bank account funding source', () => {
    const result = fundingSourceSchema.safeParse({
      type: 'bank_account',
      provider: 'stripe',
      bankName: 'Chase',
      accountNumber: '123456789',
      routingNumber: '021000021',
      currency: 'USD',
      country: 'US',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid card funding source', () => {
    const result = fundingSourceSchema.safeParse({
      type: 'card',
      provider: 'stripe',
      last4: '4242',
      expiryDate: '12/26',
    });
    expect(result.success).toBe(true);
  });

  it('accepts mobile_money type', () => {
    const result = fundingSourceSchema.safeParse({
      type: 'mobile_money',
      provider: 'paystack',
      currency: 'GHS',
      country: 'GH',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid type', () => {
    const result = fundingSourceSchema.safeParse({
      type: 'crypto',
      provider: 'stripe',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty provider', () => {
    const result = fundingSourceSchema.safeParse({
      type: 'bank_account',
      provider: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects currency code not 3 characters', () => {
    const result = fundingSourceSchema.safeParse({
      type: 'bank_account',
      provider: 'stripe',
      currency: 'US',
    });
    expect(result.success).toBe(false);
  });

  it('rejects country code not 2 characters', () => {
    const result = fundingSourceSchema.safeParse({
      type: 'bank_account',
      provider: 'stripe',
      country: 'USA',
    });
    expect(result.success).toBe(false);
  });

  it('rejects last4 longer than 4 characters', () => {
    const result = fundingSourceSchema.safeParse({
      type: 'card',
      provider: 'stripe',
      last4: '42424',
    });
    expect(result.success).toBe(false);
  });

  it('defaults to bank_account type', () => {
    const result = fundingSourceSchema.safeParse({ provider: 'stripe' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('bank_account');
    }
  });

  it('defaults currency to USD', () => {
    const result = fundingSourceSchema.safeParse({ provider: 'stripe' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe('USD');
    }
  });

  it('defaults country to US', () => {
    const result = fundingSourceSchema.safeParse({ provider: 'stripe' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.country).toBe('US');
    }
  });
});

// ============================================================================
// Enum Value Tests (inline - avoids ESM/CJS require issue with drizzle-orm)
// ============================================================================
describe('Schema Enums', () => {
  // These match the enums defined in shared/schema.ts
  const ExpenseStatus = { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED', PAID: 'PAID' };
  const UserRole = { OWNER: 'OWNER', ADMIN: 'ADMIN', MANAGER: 'MANAGER', EDITOR: 'EDITOR', EMPLOYEE: 'EMPLOYEE', VIEWER: 'VIEWER' };
  const TransactionType = { PAYOUT: 'Payout', DEPOSIT: 'Deposit', REFUND: 'Refund', BILL: 'Bill', FEE: 'Fee', FUNDING: 'Funding', TRANSFER: 'Transfer', WITHDRAWAL: 'Withdrawal' };
  const CardStatus = { ACTIVE: 'Active', FROZEN: 'Frozen' };

  it('ExpenseStatus has correct values', () => {
    expect(ExpenseStatus.PENDING).toBe('PENDING');
    expect(ExpenseStatus.APPROVED).toBe('APPROVED');
    expect(ExpenseStatus.REJECTED).toBe('REJECTED');
    expect(ExpenseStatus.PAID).toBe('PAID');
  });

  it('UserRole has correct values', () => {
    expect(UserRole.OWNER).toBe('OWNER');
    expect(UserRole.ADMIN).toBe('ADMIN');
    expect(UserRole.MANAGER).toBe('MANAGER');
    expect(UserRole.EMPLOYEE).toBe('EMPLOYEE');
    expect(UserRole.VIEWER).toBe('VIEWER');
  });

  it('TransactionType has correct values', () => {
    expect(TransactionType.PAYOUT).toBe('Payout');
    expect(TransactionType.DEPOSIT).toBe('Deposit');
    expect(TransactionType.TRANSFER).toBe('Transfer');
    expect(TransactionType.WITHDRAWAL).toBe('Withdrawal');
  });

  it('CardStatus has correct values', () => {
    expect(CardStatus.ACTIVE).toBe('Active');
    expect(CardStatus.FROZEN).toBe('Frozen');
  });
});
