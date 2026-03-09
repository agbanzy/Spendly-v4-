-- Migration: Add subscriptions table and billing columns to company_settings

-- Subscriptions table
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

-- Add billing columns to company_settings
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trialing';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS trial_ends_at TEXT;
