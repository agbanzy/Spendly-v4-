-- =====================================================
-- Spendly v4 Data Backfill Scripts
-- Run AFTER drizzle-kit push completes the schema migration
-- =====================================================

-- PRE-FK CLEANUP: Clean orphaned records before FK constraints are enforced
-- These prevent FK constraint violations

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

-- BACKFILL 1: card_transactions.company_id from virtual_cards
UPDATE card_transactions ct
SET company_id = vc.company_id
FROM virtual_cards vc
WHERE ct.card_id = vc.id AND ct.company_id IS NULL AND vc.company_id IS NOT NULL;

-- BACKFILL 2: Normalize enum casing to lowercase
UPDATE bills SET status = LOWER(status) WHERE status != LOWER(status);
UPDATE transactions SET status = LOWER(status) WHERE status != LOWER(status);
UPDATE transactions SET type = LOWER(type) WHERE type != LOWER(type);
UPDATE virtual_cards SET status = LOWER(status) WHERE status != LOWER(status);

-- BACKFILL 3: Sync notification settings from user_profiles → notification_settings
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
  true, true, false,
  now()::text,
  now()::text
FROM user_profiles up
WHERE NOT EXISTS (
  SELECT 1 FROM notification_settings ns WHERE ns.user_id = up.cognito_sub
);

-- BACKFILL 4: Migrate companySettings data into companies table
UPDATE companies c SET
  email = cs.company_email,
  phone = cs.company_phone,
  address = cs.company_address,
  timezone = cs.timezone,
  fiscal_year_start = cs.fiscal_year_start,
  date_format = cs.date_format,
  language = cs.language,
  tax_id = cs.tax_id,
  registration_number = cs.registration_number,
  tagline = cs.company_tagline,
  primary_color = cs.primary_color,
  secondary_color = cs.secondary_color,
  invoice_prefix = cs.invoice_prefix,
  invoice_footer = cs.invoice_footer,
  invoice_terms = cs.invoice_terms,
  show_logo_on_invoice = cs.show_logo_on_invoice,
  show_logo_on_receipts = cs.show_logo_on_receipts,
  auto_approve_below = cs.auto_approve_below,
  require_receipts = cs.require_receipts,
  expense_categories = cs.expense_categories,
  country_code = cs.country_code,
  region = cs.region,
  payment_provider = cs.payment_provider,
  paystack_enabled = cs.paystack_enabled,
  stripe_enabled = cs.stripe_enabled,
  notifications_enabled = cs.notifications_enabled,
  two_factor_enabled = cs.two_factor_enabled
FROM company_settings cs
WHERE cs.id = 1 AND c.email IS NULL;

-- VERIFICATION: Check for orphaned records (should all return 0)
SELECT 'expenses_orphaned' AS check_name, count(*) AS count FROM expenses WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)
UNION ALL
SELECT 'bills_orphaned', count(*) FROM bills WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)
UNION ALL
SELECT 'card_tx_orphaned', count(*) FROM card_transactions WHERE card_id NOT IN (SELECT id FROM virtual_cards)
UNION ALL
SELECT 'wallet_tx_orphaned', count(*) FROM wallet_transactions WHERE wallet_id NOT IN (SELECT id FROM wallets);
