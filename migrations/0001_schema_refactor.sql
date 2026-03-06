-- =====================================================
-- Spendly v4 Database Schema Refactoring Migration
-- Generated: 2026-03-03
-- Phases: 1-6 (Indexes, Date fixes, Settings, FKs, Departments, Cleanup)
--
-- IMPORTANT: Review this SQL before applying.
-- This migration will be applied via `npx drizzle-kit push` from within the ECS container.
-- This file serves as documentation of all expected changes.
-- =====================================================

-- ==================== PHASE 1: INDEXES + CARD TRANSACTIONS ====================

-- 1a. Add companyId column to card_transactions
ALTER TABLE card_transactions ADD COLUMN IF NOT EXISTS company_id text;

-- 1b. Add missing indexes
CREATE INDEX IF NOT EXISTS card_transactions_card_id_idx ON card_transactions (card_id);
CREATE INDEX IF NOT EXISTS card_transactions_date_idx ON card_transactions (date);
CREATE INDEX IF NOT EXISTS card_transactions_company_id_idx ON card_transactions (company_id);
CREATE INDEX IF NOT EXISTS vendors_company_id_idx ON vendors (company_id);
CREATE INDEX IF NOT EXISTS budgets_company_id_idx ON budgets (company_id);
CREATE INDEX IF NOT EXISTS departments_company_id_idx ON departments (company_id);
CREATE INDEX IF NOT EXISTS reports_company_id_idx ON reports (company_id);
CREATE INDEX IF NOT EXISTS payout_destinations_user_id_idx ON payout_destinations (user_id);
CREATE INDEX IF NOT EXISTS payout_destinations_vendor_id_idx ON payout_destinations (vendor_id);
CREATE INDEX IF NOT EXISTS company_invitations_company_id_idx ON company_invitations (company_id);

-- ==================== PHASE 2: DATE TYPES + NOTIFICATIONS + BILLS ====================

-- 2a. Convert bills.created_at and updated_at from timestamp to text
ALTER TABLE bills
  ALTER COLUMN created_at TYPE text USING to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  ALTER COLUMN updated_at TYPE text USING to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
ALTER TABLE bills ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE bills ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE bills ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE bills ALTER COLUMN updated_at SET DEFAULT now();

-- 2b. Add weekly_digest to notification_settings
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS weekly_digest boolean NOT NULL DEFAULT true;

-- 2c. Add bill payment tracking fields
ALTER TABLE bills ADD COLUMN IF NOT EXISTS paid_amount numeric(12, 2);
ALTER TABLE bills ADD COLUMN IF NOT EXISTS paid_date text;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS paid_by text;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS wallet_transaction_id text;

-- 2d. Add indexes to bills
CREATE INDEX IF NOT EXISTS bills_user_id_idx ON bills (user_id);
CREATE INDEX IF NOT EXISTS bills_company_id_idx ON bills (company_id);
CREATE INDEX IF NOT EXISTS bills_due_date_idx ON bills (due_date);
CREATE INDEX IF NOT EXISTS bills_status_idx ON bills (status);

-- ==================== PHASE 3: SETTINGS CONSOLIDATION + SINGLETONS ====================

-- 3a. Enrich companies table with settings fields
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Los_Angeles';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS fiscal_year_start text DEFAULT 'January';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS date_format text DEFAULT 'MM/DD/YYYY';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tax_id text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS registration_number text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#4f46e5';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#10b981';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_prefix text DEFAULT 'INV';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_footer text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_terms text DEFAULT 'Payment due within 30 days';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS show_logo_on_invoice boolean DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS show_logo_on_receipts boolean DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS auto_approve_below numeric(12, 2) DEFAULT 100;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS require_receipts boolean DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS expense_categories jsonb DEFAULT '["Software","Travel","Office","Marketing","Food","Equipment","Utilities","Legal","Other"]'::jsonb;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS country_code text DEFAULT 'US';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS region text DEFAULT 'North America';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS payment_provider text DEFAULT 'stripe';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS paystack_enabled boolean DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_enabled boolean DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS notifications_enabled boolean DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false;

-- 3b. Add valueType to system_settings
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS value_type text DEFAULT 'string';

-- 3c. Restructure company_balances from singleton to multi-tenant
-- Step 1: Create new table
CREATE TABLE IF NOT EXISTS company_balances_new (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL UNIQUE,
  local numeric(12, 2) NOT NULL DEFAULT 0,
  usd numeric(12, 2) NOT NULL DEFAULT 0,
  escrow numeric(12, 2) NOT NULL DEFAULT 0,
  local_currency text NOT NULL DEFAULT 'USD'
);

-- Step 2: Migrate data from old table (if old table has integer id)
-- Check if old table has integer id column before migrating
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_balances' AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    -- Copy data with a placeholder company_id
    INSERT INTO company_balances_new (company_id, local, usd, escrow, local_currency)
    SELECT
      COALESCE((SELECT id FROM companies LIMIT 1), 'default'),
      local, usd, escrow, local_currency
    FROM company_balances
    WHERE id = 1
    ON CONFLICT (company_id) DO NOTHING;

    -- Drop old table and rename new
    DROP TABLE company_balances;
    ALTER TABLE company_balances_new RENAME TO company_balances;
  ELSE
    -- Already migrated or new structure, just ensure the new table is dropped
    DROP TABLE IF EXISTS company_balances_new;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS company_balances_company_id_idx ON company_balances (company_id);

-- ==================== PHASE 4: FOREIGN KEY CONSTRAINTS ====================

-- Note: drizzle-kit push will handle adding .references() constraints.
-- These are listed here for documentation. FK additions require clean data.

-- Wave 1: Core entities
-- expenses.company_id → companies.id (onDelete: set null)
-- expenses.vendor_id → vendors.id (onDelete: set null)
-- bills.company_id → companies.id (onDelete: set null)
-- budgets.company_id → companies.id (onDelete: cascade)
-- virtual_cards.company_id → companies.id (onDelete: set null)
-- departments.company_id → companies.id (onDelete: cascade)
-- team_members.company_id → companies.id (onDelete: cascade)
-- team_members.department_id → departments.id (onDelete: set null)
-- payroll_entries.company_id → companies.id (onDelete: set null)
-- invoices.company_id → companies.id (onDelete: set null)
-- vendors.company_id → companies.id (onDelete: set null)
-- card_transactions.card_id → virtual_cards.id (onDelete: cascade)
-- card_transactions.company_id → companies.id (onDelete: set null)
-- company_members.company_id → companies.id (onDelete: cascade)
-- company_invitations.company_id → companies.id (onDelete: cascade)

-- Wave 2: Financial entities
-- wallets.company_id → companies.id (onDelete: set null)
-- wallet_transactions.wallet_id → wallets.id (onDelete: cascade)
-- payouts.destination_id → payout_destinations.id (onDelete: set null)
-- payout_destinations.vendor_id → vendors.id (onDelete: set null)
-- kyc_submissions.user_profile_id → user_profiles.id (onDelete: cascade)
-- company_balances.company_id → companies.id (onDelete: cascade)

-- Additional FKs for analytics/insights
-- analytics_snapshots.company_id → companies.id (onDelete: set null)
-- business_insights.company_id → companies.id (onDelete: set null)
-- reports.company_id → companies.id (onDelete: cascade)
-- virtual_accounts.company_id → companies.id (onDelete: set null)
-- audit_logs.company_id → companies.id (onDelete: set null)
-- scheduled_payments.company_id → companies.id (onDelete: set null)

-- Pre-FK cleanup: Set orphaned foreign keys to NULL
-- Run these BEFORE adding constraints:
UPDATE expenses SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
UPDATE expenses SET vendor_id = NULL WHERE vendor_id IS NOT NULL AND vendor_id NOT IN (SELECT id FROM vendors);
UPDATE bills SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
UPDATE budgets SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
UPDATE virtual_cards SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
UPDATE departments SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
UPDATE team_members SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
UPDATE team_members SET department_id = NULL WHERE department_id IS NOT NULL AND department_id NOT IN (SELECT id FROM departments);
UPDATE payroll_entries SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
UPDATE invoices SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
UPDATE vendors SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
UPDATE card_transactions SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
DELETE FROM card_transactions WHERE card_id NOT IN (SELECT id FROM virtual_cards);
UPDATE wallets SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
DELETE FROM wallet_transactions WHERE wallet_id NOT IN (SELECT id FROM wallets);
UPDATE payouts SET destination_id = NULL WHERE destination_id IS NOT NULL AND destination_id NOT IN (SELECT id FROM payout_destinations);
UPDATE payout_destinations SET vendor_id = NULL WHERE vendor_id IS NOT NULL AND vendor_id NOT IN (SELECT id FROM vendors);
DELETE FROM kyc_submissions WHERE user_profile_id NOT IN (SELECT id FROM user_profiles);
UPDATE analytics_snapshots SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
UPDATE business_insights SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
UPDATE reports SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
UPDATE virtual_accounts SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
UPDATE audit_logs SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
UPDATE scheduled_payments SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
DELETE FROM company_balances WHERE company_id NOT IN (SELECT id FROM companies);

-- ==================== PHASE 5: DEPARTMENTS + VENDORS ====================

-- 5a. Add departmentId FK to expenses and payroll_entries
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS department_id text;
ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS department_id text;

-- 5b. Add additional columns
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS company_id text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS payment_terms text;
ALTER TABLE virtual_cards ADD COLUMN IF NOT EXISTS company_id text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS company_id text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS company_id text;

-- ==================== PHASE 6: CLEANUP + NORMALIZATION ====================

-- 6a. Add walletTransactionId to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS wallet_transaction_id text;

-- 6b. Add additional indexes
CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions (date);
CREATE INDEX IF NOT EXISTS transactions_status_idx ON transactions (status);
CREATE INDEX IF NOT EXISTS transactions_type_idx ON transactions (type);
CREATE INDEX IF NOT EXISTS team_members_company_id_idx ON team_members (company_id);
CREATE INDEX IF NOT EXISTS payroll_entries_company_id_idx ON payroll_entries (company_id);
CREATE INDEX IF NOT EXISTS payroll_entries_employee_id_idx ON payroll_entries (employee_id);
CREATE INDEX IF NOT EXISTS invoices_company_id_idx ON invoices (company_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices (status);
CREATE INDEX IF NOT EXISTS virtual_cards_stripe_card_id_idx ON virtual_cards (stripe_card_id);
CREATE INDEX IF NOT EXISTS virtual_accounts_user_id_idx ON virtual_accounts (user_id);
CREATE INDEX IF NOT EXISTS virtual_accounts_company_id_idx ON virtual_accounts (company_id);
CREATE INDEX IF NOT EXISTS virtual_accounts_status_idx ON virtual_accounts (status);
CREATE INDEX IF NOT EXISTS wallets_user_id_idx ON wallets (user_id);
CREATE INDEX IF NOT EXISTS wallets_company_id_idx ON wallets (company_id);
CREATE INDEX IF NOT EXISTS wallet_transactions_wallet_id_idx ON wallet_transactions (wallet_id);
CREATE INDEX IF NOT EXISTS wallet_transactions_created_at_idx ON wallet_transactions (created_at);
CREATE INDEX IF NOT EXISTS payouts_status_idx ON payouts (status);
CREATE INDEX IF NOT EXISTS payouts_recipient_id_idx ON payouts (recipient_id);
CREATE INDEX IF NOT EXISTS payouts_created_at_idx ON payouts (created_at);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_type_entity_id_idx ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS expenses_user_id_idx ON expenses (user_id);
CREATE INDEX IF NOT EXISTS expenses_company_id_idx ON expenses (company_id);
CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses (date);
CREATE INDEX IF NOT EXISTS expenses_status_idx ON expenses (status);
CREATE INDEX IF NOT EXISTS expenses_company_id_status_idx ON expenses (company_id, status);
CREATE INDEX IF NOT EXISTS user_profiles_cognito_sub_idx ON user_profiles (cognito_sub);
CREATE INDEX IF NOT EXISTS user_profiles_email_idx ON user_profiles (email);
CREATE INDEX IF NOT EXISTS user_profiles_company_id_idx ON user_profiles (company_id);
CREATE INDEX IF NOT EXISTS user_profiles_kyc_status_idx ON user_profiles (kyc_status);
CREATE INDEX IF NOT EXISTS kyc_submissions_user_profile_id_idx ON kyc_submissions (user_profile_id);
CREATE INDEX IF NOT EXISTS kyc_submissions_status_idx ON kyc_submissions (status);
CREATE INDEX IF NOT EXISTS company_members_company_id_idx ON company_members (company_id);
CREATE INDEX IF NOT EXISTS company_members_user_id_idx ON company_members (user_id);
CREATE INDEX IF NOT EXISTS company_members_email_idx ON company_members (email);

-- ==================== DATA BACKFILL SCRIPTS ====================
-- Run AFTER schema migration is complete

-- Backfill 1: card_transactions.company_id from virtual_cards
UPDATE card_transactions ct
SET company_id = vc.company_id
FROM virtual_cards vc
WHERE ct.card_id = vc.id AND ct.company_id IS NULL AND vc.company_id IS NOT NULL;

-- Backfill 2: Normalize enum casing
UPDATE bills SET status = LOWER(status) WHERE status != LOWER(status);
UPDATE transactions SET status = LOWER(status) WHERE status != LOWER(status);
UPDATE transactions SET type = LOWER(type) WHERE type != LOWER(type);
UPDATE virtual_cards SET status = LOWER(status) WHERE status != LOWER(status);

-- Backfill 3: Sync notification settings from user_profiles → notification_settings
INSERT INTO notification_settings (user_id, email_enabled, sms_enabled, push_enabled, in_app_enabled,
  expense_notifications, payment_notifications, budget_notifications, weekly_digest,
  bill_notifications, security_notifications, marketing_notifications, created_at, updated_at)
SELECT
  up.cognito_sub,
  up.email_notifications,
  up.sms_notifications,
  up.push_notifications,
  true,
  up.expense_alerts,
  up.payment_reminders,
  up.budget_warnings,
  up.weekly_digest,
  true,
  true,
  false,
  now()::text,
  now()::text
FROM user_profiles up
WHERE NOT EXISTS (
  SELECT 1 FROM notification_settings ns WHERE ns.user_id = up.cognito_sub
);

-- ==================== VERIFICATION QUERIES ====================
-- Run these after migration to verify data integrity

-- Check for orphaned records (should all return 0)
-- SELECT count(*) FROM expenses WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
-- SELECT count(*) FROM bills WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
-- SELECT count(*) FROM card_transactions WHERE card_id NOT IN (SELECT id FROM virtual_cards);
-- SELECT count(*) FROM wallet_transactions WHERE wallet_id NOT IN (SELECT id FROM wallets);
-- SELECT count(*) FROM company_balances WHERE company_id NOT IN (SELECT id FROM companies);
