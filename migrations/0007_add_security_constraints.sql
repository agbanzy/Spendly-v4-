-- Security constraints migration
-- Fixes H8: Add unique constraint on wallets(user_id, currency) to prevent duplicate wallets
-- Fixes H9: Add unique constraint on wallet_transactions(reference) to prevent double-crediting

-- H8: Prevent duplicate wallets per user per currency
-- First remove any duplicates (keep the one with the highest balance)
DELETE FROM wallets w1
USING wallets w2
WHERE w1.id < w2.id
  AND w1.user_id = w2.user_id
  AND w1.currency = w2.currency;

ALTER TABLE wallets
  ADD CONSTRAINT wallets_user_currency_unique UNIQUE (user_id, currency);

-- H9: Prevent duplicate wallet transaction references (idempotency at DB level)
-- First remove any duplicate references (keep the earliest)
DELETE FROM wallet_transactions wt1
USING wallet_transactions wt2
WHERE wt1.id > wt2.id
  AND wt1.reference = wt2.reference;

ALTER TABLE wallet_transactions
  ADD CONSTRAINT wallet_transactions_reference_unique UNIQUE (reference);

-- Additional: Add unique constraint on transactions reference for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS transactions_reference_unique
  ON transactions (reference)
  WHERE reference IS NOT NULL;
