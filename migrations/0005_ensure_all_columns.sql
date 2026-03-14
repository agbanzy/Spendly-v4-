-- =====================================================
-- Migration 0005: Ensure all tables and columns exist
-- Generated: 2026-03-12
-- Purpose: Comprehensive catch-all to fix any missing tables/columns
-- that may have been missed by earlier migrations
-- All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- so this migration is fully idempotent and safe to re-run.
-- =====================================================

-- ==================== MISSING TABLES ====================

-- processed_webhooks table (missing from base migration 0000)
CREATE TABLE IF NOT EXISTS processed_webhooks (
  id SERIAL PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT now(),
  metadata JSONB
);

-- subscriptions table (in case 0004 was skipped)
CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'trialing',
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_subscription_id TEXT,
  provider_customer_id TEXT,
  provider_plan_id TEXT,
  trial_start_date TEXT,
  trial_end_date TEXT,
  current_period_start TEXT,
  current_period_end TEXT,
  canceled_at TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 500,
  currency TEXT NOT NULL DEFAULT 'USD',
  metadata JSONB,
  created_at TEXT NOT NULL DEFAULT now(),
  updated_at TEXT NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_company_id_idx ON subscriptions(company_id);

-- ==================== BILLS: MISSING COLUMNS ====================

ALTER TABLE bills ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12, 2);
ALTER TABLE bills ADD COLUMN IF NOT EXISTS paid_date TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS paid_by TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS wallet_transaction_id TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS approved_at TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS reviewer_comments TEXT;

-- ==================== EXPENSES: MISSING COLUMNS ====================

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS department_id TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_at TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS rejected_by TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS rejected_at TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approval_comments TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS reviewer_comments TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor_id TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'not_started';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payout_id TEXT;

-- ==================== PAYROLL ENTRIES: MISSING COLUMNS ====================

ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS department_id TEXT;
ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS deduction_breakdown JSONB;
ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS payout_destination_id TEXT;

-- ==================== TRANSACTIONS: MISSING COLUMNS ====================

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS wallet_transaction_id TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS company_id TEXT;

-- ==================== COMPANIES: MISSING COLUMNS ====================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Los_Angeles';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS fiscal_year_start TEXT DEFAULT 'January';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS date_format TEXT DEFAULT 'MM/DD/YYYY';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS registration_number TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#4f46e5';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#10b981';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'INV';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_footer TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_terms TEXT DEFAULT 'Payment due within 30 days';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS show_logo_on_invoice BOOLEAN DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS show_logo_on_receipts BOOLEAN DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS auto_approve_below NUMERIC(12, 2) DEFAULT 100;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS require_receipts BOOLEAN DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS expense_categories JSONB DEFAULT '["Software","Travel","Office","Marketing","Food","Equipment","Utilities","Legal","Other"]'::jsonb;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'US';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'North America';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'stripe';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS paystack_enabled BOOLEAN DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_enabled BOOLEAN DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;

-- ==================== BUDGETS: MISSING COLUMNS ====================

ALTER TABLE budgets ADD COLUMN IF NOT EXISTS company_id TEXT;

-- ==================== CARD TRANSACTIONS: MISSING COLUMNS ====================

ALTER TABLE card_transactions ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE card_transactions ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

-- ==================== INVOICES: MISSING COLUMNS ====================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company_id TEXT;

-- ==================== VIRTUAL ACCOUNTS: MISSING COLUMNS ====================

ALTER TABLE virtual_accounts ADD COLUMN IF NOT EXISTS routing_number TEXT;
ALTER TABLE virtual_accounts ADD COLUMN IF NOT EXISTS swift_code TEXT;
ALTER TABLE virtual_accounts ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'US';

-- ==================== VENDORS: MISSING COLUMNS ====================

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS notes TEXT;

-- ==================== VIRTUAL CARDS: MISSING COLUMNS ====================

ALTER TABLE virtual_cards ADD COLUMN IF NOT EXISTS company_id TEXT;

-- ==================== REPORTS: MISSING COLUMNS ====================

ALTER TABLE reports ADD COLUMN IF NOT EXISTS company_id TEXT;

-- ==================== AUDIT LOGS: MISSING COLUMNS ====================

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS company_id TEXT;

-- ==================== WALLET TRANSACTIONS: MISSING COLUMNS ====================

ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS reversed_at TEXT;
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS reversed_by_tx_id TEXT;

-- ==================== PAYOUTS: MISSING COLUMNS ====================

ALTER TABLE payouts ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS approved_at TEXT;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS first_approved_by TEXT;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS first_approved_at TEXT;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'none';
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS recurring BOOLEAN DEFAULT false;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS frequency TEXT DEFAULT 'monthly';
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS next_run_date TEXT;

-- ==================== SYSTEM SETTINGS: MISSING COLUMNS ====================

ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS value_type TEXT DEFAULT 'string';

-- ==================== NOTIFICATION SETTINGS: MISSING COLUMNS ====================

ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS weekly_digest BOOLEAN NOT NULL DEFAULT true;

-- ==================== COMPANY SETTINGS: MISSING COLUMNS ====================

ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trialing';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS trial_ends_at TEXT;

-- ==================== USER PROFILES: MISSING COLUMNS ====================

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS user_id TEXT;

-- ==================== TEAM MEMBERS: MISSING COLUMNS ====================

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS department_id TEXT;

-- ==================== STATUS NORMALIZATION ====================
-- Normalize all status values to lowercase for consistency

UPDATE bills SET status = LOWER(status) WHERE status != LOWER(status);
UPDATE transactions SET status = LOWER(status) WHERE status != LOWER(status);
UPDATE transactions SET type = LOWER(type) WHERE type != LOWER(type);
UPDATE virtual_cards SET status = LOWER(status) WHERE status != LOWER(status);
UPDATE team_members SET status = LOWER(status) WHERE status != LOWER(status);
UPDATE departments SET status = LOWER(status) WHERE status != LOWER(status);
