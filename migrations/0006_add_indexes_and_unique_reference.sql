-- Phase 1: Add missing indexes and partial unique constraint on transaction reference
-- This migration is idempotent (uses IF NOT EXISTS / ON CONFLICT DO NOTHING)

-- Missing foreign key indexes on expenses
CREATE INDEX IF NOT EXISTS "expenses_department_id_idx" ON "expenses" ("department_id");
CREATE INDEX IF NOT EXISTS "expenses_vendor_id_idx" ON "expenses" ("vendor_id");

-- Missing user_id index on transactions
CREATE INDEX IF NOT EXISTS "transactions_user_id_idx" ON "transactions" ("user_id");

-- Partial unique index: each non-null reference must be unique
-- (NULL references are allowed to have duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_reference_unique_idx"
  ON "transactions" ("reference") WHERE "reference" IS NOT NULL;
