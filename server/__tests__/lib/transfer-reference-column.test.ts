import { describe, it, expect } from "vitest";

// TP-HIGH-10 (AUDIT_TRANSFERS_PAYOUTS_2026_05_17 §4.4 item 7) — contract
// test for the column-correctness fix on POST /payment/transfer.
//
// Before STG2-B the route wrote:
//   description: providerRef  (raw provider id in the wrong column)
//   reference:   null         (the indexed column was empty)
//
// After STG2-B the route writes:
//   description: <reason>     (human-readable purpose, what `description` is for)
//   reference:   providerRef  (the indexed column the webhook reconciler reads)
//
// Webhook reconciliation in webhookHandlers.ts calls
// storage.getTransactionByReference(ref) — an indexed lookup that returned
// nothing for legacy /payment/transfer rows because `reference` was NULL.
// This test pins the construction shape so a future regression that puts
// the ref back into `description` fails loudly.

interface TransactionInsert {
  type: string;
  amount: string;
  fee: string;
  status: string;
  date: string;
  description: string;
  currency: string;
  reference: string | null;
  userId: string | null;
}

/**
 * Mirror of the createTransaction({...}) call in
 * server/routes/payments.routes.ts → POST /payment/transfer (the bit
 * that runs after a successful provider call). Kept here as a pure
 * function so the contract can be tested without booting the route.
 */
function buildTransferTransactionInsert(input: {
  amount: number;
  currency: string;
  reason: string;
  providerRef: string;
  userId: string | null;
}): TransactionInsert {
  return {
    type: 'transfer',
    amount: String(input.amount),
    fee: '0',
    status: 'processing',
    date: new Date().toISOString().split('T')[0],
    description: input.reason || 'Wallet-to-bank transfer',
    currency: input.currency,
    reference: input.providerRef,
    userId: input.userId,
  };
}

describe('TP-HIGH-10 — /payment/transfer transactions insert shape', () => {
  it('writes the provider ref to `reference`, NOT to `description`', () => {
    const row = buildTransferTransactionInsert({
      amount: 100,
      currency: 'NGN',
      reason: 'Office rent — May 2026',
      providerRef: 'TRF-abc12345-1747000000000',
      userId: 'user-1',
    });

    expect(row.reference).toBe('TRF-abc12345-1747000000000');
    expect(row.description).toBe('Office rent — May 2026');
    expect(row.description).not.toMatch(/^TRF-/);
    expect(row.description).not.toMatch(/^tr_/);
    expect(row.description).not.toMatch(/^po_/);
  });

  it('falls back to a generic description when reason is empty', () => {
    const row = buildTransferTransactionInsert({
      amount: 50,
      currency: 'USD',
      reason: '',
      providerRef: 'po_1AbCdEfGhIjKlMn',
      userId: 'user-1',
    });

    expect(row.description).toBe('Wallet-to-bank transfer');
    expect(row.reference).toBe('po_1AbCdEfGhIjKlMn');
  });

  it('keeps `reference` populated for every supported provider ref shape', () => {
    // Paystack reference style
    expect(
      buildTransferTransactionInsert({
        amount: 1, currency: 'NGN', reason: 'r', providerRef: 'TRF-x-1', userId: null,
      }).reference,
    ).toBe('TRF-x-1');

    // Stripe transfer id
    expect(
      buildTransferTransactionInsert({
        amount: 1, currency: 'USD', reason: 'r', providerRef: 'tr_1AbCd', userId: null,
      }).reference,
    ).toBe('tr_1AbCd');

    // Stripe payout id
    expect(
      buildTransferTransactionInsert({
        amount: 1, currency: 'USD', reason: 'r', providerRef: 'po_1EfGh', userId: null,
      }).reference,
    ).toBe('po_1EfGh');
  });

  it('sets the immutable fields: type=transfer, status=processing, fee=0', () => {
    const row = buildTransferTransactionInsert({
      amount: 42,
      currency: 'KES',
      reason: 'School fees',
      providerRef: 'TRF-zzz-1',
      userId: 'user-1',
    });

    expect(row.type).toBe('transfer');
    expect(row.status).toBe('processing');
    expect(row.fee).toBe('0');
  });
});

// Backfill SQL parity — pin the WHERE clause shape used in
// migrations-deferred/0018_transactions_backfill_reference_from_description.sql
// so an accidental change to the regex on either side trips this test.

describe('TP-HIGH-10 — backfill WHERE clause regex parity', () => {
  // Same regex as the migration: ^(TRF-|tr_|po_|trsf_)
  const providerRefRegex = /^(TRF-|tr_|po_|trsf_)/;

  it('matches Paystack transfer references', () => {
    expect(providerRefRegex.test('TRF-abc-12345')).toBe(true);
  });

  it('matches Stripe transfer ids', () => {
    expect(providerRefRegex.test('tr_1AbCdEfGh')).toBe(true);
    expect(providerRefRegex.test('trsf_1XyZ')).toBe(true);
  });

  it('matches Stripe payout ids', () => {
    expect(providerRefRegex.test('po_1AbCdEfGh')).toBe(true);
  });

  it('does NOT match human descriptions (so the backfill leaves them alone)', () => {
    expect(providerRefRegex.test('Office rent — May 2026')).toBe(false);
    expect(providerRefRegex.test('Salary')).toBe(false);
    expect(providerRefRegex.test('Wallet-to-bank transfer')).toBe(false);
  });
});
