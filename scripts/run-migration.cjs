/**
 * Database Migration Runner
 * Executes migration SQL and backfill scripts using pg directly.
 * Usage: node scripts/run-migration.cjs [migrate|backfill|all]
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

async function runSQL(client, sqlFile, label) {
  const filePath = path.join(__dirname, '..', sqlFile);
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: SQL file not found: ${filePath}`);
    return false;
  }

  const sql = fs.readFileSync(filePath, 'utf-8');

  // Drizzle migration files use '--> statement-breakpoint' as delimiter
  // Other SQL files may use plain semicolons
  let statements;
  if (sql.includes('--> statement-breakpoint')) {
    statements = sql
      .split(/-->\s*statement-breakpoint/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
  } else {
    // For DO $$ ... END $$; blocks, we need smarter splitting
    // Split on semicolons that are NOT inside $$ blocks
    const rawStatements = [];
    let current = '';
    let inDollarBlock = false;
    for (const line of sql.split('\n')) {
      current += line + '\n';
      if (line.includes('$$') && !inDollarBlock) {
        // Count $$ occurrences - odd means we entered a block
        const count = (line.match(/\$\$/g) || []).length;
        if (count % 2 === 1) inDollarBlock = true;
      } else if (line.includes('$$') && inDollarBlock) {
        const count = (line.match(/\$\$/g) || []).length;
        if (count % 2 === 1) inDollarBlock = false;
      }
      if (!inDollarBlock && line.trimEnd().endsWith(';')) {
        rawStatements.push(current.trim());
        current = '';
      }
    }
    if (current.trim()) rawStatements.push(current.trim());
    statements = rawStatements
      .map(s => s.replace(/;$/, '').trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
  }

  console.log(`\n=== Running ${label} (${statements.length} statements) ===\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    let stmt = statements[i];

    // Skip pure comment blocks
    const cleanStmt = stmt.replace(/--.*$/gm, '').trim();
    if (!cleanStmt) {
      skipped++;
      continue;
    }

    try {
      await client.query(cleanStmt);
      success++;
      // Show progress every 10 statements
      if (success % 10 === 0) {
        console.log(`  Progress: ${success} succeeded, ${failed} failed, ${skipped} skipped`);
      }
    } catch (err) {
      // Some errors are expected (IF NOT EXISTS, already exists, etc.)
      const msg = err.message || '';
      if (
        msg.includes('already exists') ||
        msg.includes('does not exist') ||
        msg.includes('duplicate key') ||
        msg.includes('relation') && msg.includes('already exists')
      ) {
        skipped++;
      } else {
        failed++;
        console.error(`  FAILED (stmt ${i + 1}): ${msg}`);
        console.error(`  SQL: ${cleanStmt.substring(0, 200)}...`);
      }
    }
  }

  console.log(`\n  Result: ${success} succeeded, ${failed} failed, ${skipped} skipped\n`);
  return failed === 0;
}

async function runDrizzlePush(client) {
  console.log('\n=== Applying Schema Changes via Direct SQL ===\n');

  // Phase 1: Add missing columns
  const phase1 = [
    // card_transactions.company_id
    `ALTER TABLE card_transactions ADD COLUMN IF NOT EXISTS company_id text`,
    // transactions new columns
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id text`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference text`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS wallet_transaction_id text`,
    // companies enrichment
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS email text`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone text`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS address text`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS city text`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS state text`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS postal_code text`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Los_Angeles'`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS fiscal_year_start text DEFAULT 'January'`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS date_format text DEFAULT 'MM/DD/YYYY'`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS language text DEFAULT 'en'`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS tax_id text`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS registration_number text`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS tagline text`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#4f46e5'`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#10b981'`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_prefix text DEFAULT 'INV'`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_footer text`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_terms text DEFAULT 'Payment due within 30 days'`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS show_logo_on_invoice boolean DEFAULT true`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS show_logo_on_receipts boolean DEFAULT true`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS auto_approve_below numeric(12, 2) DEFAULT 100`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS require_receipts boolean DEFAULT true`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS expense_categories jsonb DEFAULT '["Software","Travel","Office","Marketing","Food","Equipment","Utilities","Legal","Other"]'::jsonb`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS country_code text DEFAULT 'US'`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS region text DEFAULT 'North America'`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS payment_provider text DEFAULT 'stripe'`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS paystack_enabled boolean DEFAULT true`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_enabled boolean DEFAULT true`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS notifications_enabled boolean DEFAULT true`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false`,
    // system_settings valueType
    `ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS value_type text DEFAULT 'string'`,
    // notification_settings weekly_digest
    `ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS weekly_digest boolean NOT NULL DEFAULT true`,
    // bills payment tracking
    `ALTER TABLE bills ADD COLUMN IF NOT EXISTS paid_amount numeric(12, 2)`,
    `ALTER TABLE bills ADD COLUMN IF NOT EXISTS paid_date text`,
    `ALTER TABLE bills ADD COLUMN IF NOT EXISTS paid_by text`,
    `ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_method text`,
    `ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_reference text`,
    `ALTER TABLE bills ADD COLUMN IF NOT EXISTS wallet_transaction_id text`,
    // expenses departmentId
    `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS department_id text`,
    // payroll_entries departmentId
    `ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS department_id text`,
    // vendors additional columns
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS company_id text`,
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS payment_terms text`,
    // virtual_cards company_id
    `ALTER TABLE virtual_cards ADD COLUMN IF NOT EXISTS company_id text`,
    // reports company_id
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS company_id text`,
    // audit_logs company_id
    `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS company_id text`,
    // invoices additional columns
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal numeric(12, 2)`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_rate numeric(5, 2) DEFAULT 0`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount numeric(12, 2) DEFAULT 0`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD'`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes text`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company_id text`,
    // payroll_entries additional columns
    `ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS country text`,
    `ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS currency text`,
    `ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS deduction_breakdown jsonb`,
    `ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS payout_destination_id text`,
    // bills approval tracking
    `ALTER TABLE bills ADD COLUMN IF NOT EXISTS approved_by text`,
    `ALTER TABLE bills ADD COLUMN IF NOT EXISTS approved_at text`,
    `ALTER TABLE bills ADD COLUMN IF NOT EXISTS reviewer_comments text`,
    // user_profiles cognito_sub + user_id (rename firebase_uid if needed)
    `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'firebase_uid') THEN ALTER TABLE user_profiles RENAME COLUMN firebase_uid TO cognito_sub; END IF; END $$`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS user_id text`,
    // === Audit Fix Columns (2026-03-03) ===
    // transactions.company_id for multi-tenant isolation
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS company_id text`,
    // card_transactions.currency
    `ALTER TABLE card_transactions ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD'`,
    // expenses approval audit trail
    `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_by text`,
    `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_at text`,
    `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS rejected_by text`,
    `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS rejected_at text`,
    `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approval_comments text`,
    // virtual_accounts country-specific fields
    `ALTER TABLE virtual_accounts ADD COLUMN IF NOT EXISTS routing_number text`,
    `ALTER TABLE virtual_accounts ADD COLUMN IF NOT EXISTS swift_code text`,
    `ALTER TABLE virtual_accounts ADD COLUMN IF NOT EXISTS country text DEFAULT 'US'`,
    // wallet_transactions reversal tracking
    `ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS reversed_at text`,
    `ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS reversed_by_tx_id text`,
    // vendors.currency
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD'`,
    // payroll_entries.currency default
    // (already added above, but ensure default)
    `ALTER TABLE payroll_entries ALTER COLUMN currency SET DEFAULT 'USD'`,
    // payouts audit fields
    `ALTER TABLE payouts ADD COLUMN IF NOT EXISTS company_id text`,
    `ALTER TABLE payouts ADD COLUMN IF NOT EXISTS approved_at text`,
    `ALTER TABLE payouts ADD COLUMN IF NOT EXISTS first_approved_at text`,
  ];

  // Phase 2: Convert timestamp columns to text
  const phase2 = [
    `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills' AND column_name = 'created_at' AND data_type = 'timestamp without time zone') THEN ALTER TABLE bills ALTER COLUMN created_at TYPE text USING to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'); ALTER TABLE bills ALTER COLUMN updated_at TYPE text USING to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'); END IF; END $$`,
    `ALTER TABLE bills ALTER COLUMN created_at SET NOT NULL`,
    `ALTER TABLE bills ALTER COLUMN created_at SET DEFAULT now()`,
    `ALTER TABLE bills ALTER COLUMN updated_at SET NOT NULL`,
    `ALTER TABLE bills ALTER COLUMN updated_at SET DEFAULT now()`,
    `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processed_webhooks' AND column_name = 'processed_at' AND data_type = 'timestamp without time zone') THEN ALTER TABLE processed_webhooks ALTER COLUMN processed_at TYPE text USING to_char(processed_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'); END IF; END $$`,
  ];

  // Phase 3: company_balances restructure
  const phase3 = [
    `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_balances' AND column_name = 'id' AND data_type = 'integer') THEN CREATE TABLE IF NOT EXISTS company_balances_new (id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(), company_id text NOT NULL UNIQUE, local numeric(12, 2) NOT NULL DEFAULT 0, usd numeric(12, 2) NOT NULL DEFAULT 0, escrow numeric(12, 2) NOT NULL DEFAULT 0, local_currency text NOT NULL DEFAULT 'USD'); INSERT INTO company_balances_new (company_id, local, usd, escrow, local_currency) SELECT COALESCE((SELECT id FROM companies LIMIT 1), 'default'), local, usd, escrow, local_currency FROM company_balances WHERE id = 1 ON CONFLICT (company_id) DO NOTHING; DROP TABLE company_balances; ALTER TABLE company_balances_new RENAME TO company_balances; END IF; END $$`,
  ];

  // Phase 4: Add indexes
  const phase4 = [
    `CREATE INDEX IF NOT EXISTS card_transactions_card_id_idx ON card_transactions (card_id)`,
    `CREATE INDEX IF NOT EXISTS card_transactions_date_idx ON card_transactions (date)`,
    `CREATE INDEX IF NOT EXISTS card_transactions_company_id_idx ON card_transactions (company_id)`,
    `CREATE INDEX IF NOT EXISTS vendors_company_id_idx ON vendors (company_id)`,
    `CREATE INDEX IF NOT EXISTS budgets_company_id_idx ON budgets (company_id)`,
    `CREATE INDEX IF NOT EXISTS departments_company_id_idx ON departments (company_id)`,
    `CREATE INDEX IF NOT EXISTS reports_company_id_idx ON reports (company_id)`,
    `CREATE INDEX IF NOT EXISTS payout_destinations_user_id_idx ON payout_destinations (user_id)`,
    `CREATE INDEX IF NOT EXISTS payout_destinations_vendor_id_idx ON payout_destinations (vendor_id)`,
    `CREATE INDEX IF NOT EXISTS company_invitations_company_id_idx ON company_invitations (company_id)`,
    `CREATE INDEX IF NOT EXISTS bills_user_id_idx ON bills (user_id)`,
    `CREATE INDEX IF NOT EXISTS bills_company_id_idx ON bills (company_id)`,
    `CREATE INDEX IF NOT EXISTS bills_due_date_idx ON bills (due_date)`,
    `CREATE INDEX IF NOT EXISTS bills_status_idx ON bills (status)`,
    `CREATE INDEX IF NOT EXISTS company_balances_company_id_idx ON company_balances (company_id)`,
    `CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions (date)`,
    `CREATE INDEX IF NOT EXISTS transactions_status_idx ON transactions (status)`,
    `CREATE INDEX IF NOT EXISTS transactions_type_idx ON transactions (type)`,
    `CREATE INDEX IF NOT EXISTS team_members_company_id_idx ON team_members (company_id)`,
    `CREATE INDEX IF NOT EXISTS payroll_entries_company_id_idx ON payroll_entries (company_id)`,
    `CREATE INDEX IF NOT EXISTS payroll_entries_employee_id_idx ON payroll_entries (employee_id)`,
    `CREATE INDEX IF NOT EXISTS invoices_company_id_idx ON invoices (company_id)`,
    `CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices (status)`,
    `CREATE INDEX IF NOT EXISTS virtual_cards_stripe_card_id_idx ON virtual_cards (stripe_card_id)`,
    `CREATE INDEX IF NOT EXISTS virtual_accounts_user_id_idx ON virtual_accounts (user_id)`,
    `CREATE INDEX IF NOT EXISTS virtual_accounts_company_id_idx ON virtual_accounts (company_id)`,
    `CREATE INDEX IF NOT EXISTS virtual_accounts_status_idx ON virtual_accounts (status)`,
    `CREATE INDEX IF NOT EXISTS wallets_user_id_idx ON wallets (user_id)`,
    `CREATE INDEX IF NOT EXISTS wallets_company_id_idx ON wallets (company_id)`,
    `CREATE INDEX IF NOT EXISTS wallet_transactions_wallet_id_idx ON wallet_transactions (wallet_id)`,
    `CREATE INDEX IF NOT EXISTS wallet_transactions_created_at_idx ON wallet_transactions (created_at)`,
    `CREATE INDEX IF NOT EXISTS payouts_status_idx ON payouts (status)`,
    `CREATE INDEX IF NOT EXISTS payouts_recipient_id_idx ON payouts (recipient_id)`,
    `CREATE INDEX IF NOT EXISTS payouts_created_at_idx ON payouts (created_at)`,
    `CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs (user_id)`,
    `CREATE INDEX IF NOT EXISTS audit_logs_entity_type_entity_id_idx ON audit_logs (entity_type, entity_id)`,
    `CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at)`,
    `CREATE INDEX IF NOT EXISTS expenses_user_id_idx ON expenses (user_id)`,
    `CREATE INDEX IF NOT EXISTS expenses_company_id_idx ON expenses (company_id)`,
    `CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses (date)`,
    `CREATE INDEX IF NOT EXISTS expenses_status_idx ON expenses (status)`,
    `CREATE INDEX IF NOT EXISTS expenses_company_id_status_idx ON expenses (company_id, status)`,
    `CREATE INDEX IF NOT EXISTS user_profiles_cognito_sub_idx ON user_profiles (cognito_sub)`,
    `CREATE INDEX IF NOT EXISTS user_profiles_email_idx ON user_profiles (email)`,
    `CREATE INDEX IF NOT EXISTS user_profiles_company_id_idx ON user_profiles (company_id)`,
    `CREATE INDEX IF NOT EXISTS user_profiles_kyc_status_idx ON user_profiles (kyc_status)`,
    `CREATE INDEX IF NOT EXISTS kyc_submissions_user_profile_id_idx ON kyc_submissions (user_profile_id)`,
    `CREATE INDEX IF NOT EXISTS kyc_submissions_status_idx ON kyc_submissions (status)`,
    `CREATE INDEX IF NOT EXISTS company_members_company_id_idx ON company_members (company_id)`,
    `CREATE INDEX IF NOT EXISTS company_members_user_id_idx ON company_members (user_id)`,
    `CREATE INDEX IF NOT EXISTS company_members_email_idx ON company_members (email)`,
    // === Audit Fix Indexes (2026-03-03) ===
    `CREATE INDEX IF NOT EXISTS transactions_company_id_idx ON transactions (company_id)`,
    `CREATE INDEX IF NOT EXISTS transactions_reference_idx ON transactions (reference)`,
    `CREATE INDEX IF NOT EXISTS payouts_company_id_idx ON payouts (company_id)`,
    // === Phase 3: Additional indexes (2026-03-04) ===
    `CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications (user_id)`,
    `CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at)`,
    `CREATE INDEX IF NOT EXISTS notifications_user_id_read_idx ON notifications (user_id, read)`,
    `CREATE INDEX IF NOT EXISTS notification_settings_user_id_idx ON notification_settings (user_id)`,
    `CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON push_tokens (user_id)`,
    `CREATE INDEX IF NOT EXISTS funding_sources_user_id_idx ON funding_sources (user_id)`,
    `CREATE INDEX IF NOT EXISTS scheduled_payments_company_id_idx ON scheduled_payments (company_id)`,
    `CREATE INDEX IF NOT EXISTS scheduled_payments_status_idx ON scheduled_payments (status)`,
    `CREATE INDEX IF NOT EXISTS scheduled_payments_next_run_date_idx ON scheduled_payments (next_run_date)`,
    `CREATE INDEX IF NOT EXISTS virtual_cards_company_id_idx ON virtual_cards (company_id)`,
    `CREATE INDEX IF NOT EXISTS analytics_snapshots_company_id_idx ON analytics_snapshots (company_id)`,
    `CREATE INDEX IF NOT EXISTS analytics_snapshots_period_type_idx ON analytics_snapshots (period_type)`,
    `CREATE INDEX IF NOT EXISTS analytics_snapshots_period_start_idx ON analytics_snapshots (period_start)`,
    `CREATE INDEX IF NOT EXISTS business_insights_company_id_idx ON business_insights (company_id)`,
    `CREATE INDEX IF NOT EXISTS business_insights_category_idx ON business_insights (category)`,
    `CREATE INDEX IF NOT EXISTS business_insights_is_active_idx ON business_insights (is_active)`,
  ];

  // Phase 5: FK cleanup + constraints
  const phase5Cleanup = [
    `UPDATE expenses SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)`,
    `UPDATE expenses SET vendor_id = NULL WHERE vendor_id IS NOT NULL AND vendor_id NOT IN (SELECT id FROM vendors)`,
    `UPDATE expenses SET department_id = NULL WHERE department_id IS NOT NULL AND department_id NOT IN (SELECT id FROM departments)`,
    `UPDATE bills SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)`,
    `UPDATE budgets SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)`,
    `UPDATE virtual_cards SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)`,
    `UPDATE departments SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)`,
    `UPDATE team_members SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)`,
    `UPDATE team_members SET department_id = NULL WHERE department_id IS NOT NULL AND department_id NOT IN (SELECT id FROM departments)`,
    `UPDATE payroll_entries SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)`,
    `UPDATE payroll_entries SET department_id = NULL WHERE department_id IS NOT NULL AND department_id NOT IN (SELECT id FROM departments)`,
    `UPDATE invoices SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)`,
    `UPDATE vendors SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)`,
    `UPDATE card_transactions SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)`,
    `DELETE FROM card_transactions WHERE card_id NOT IN (SELECT id FROM virtual_cards)`,
    `UPDATE wallets SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)`,
    `DELETE FROM wallet_transactions WHERE wallet_id NOT IN (SELECT id FROM wallets)`,
    `UPDATE payouts SET destination_id = NULL WHERE destination_id IS NOT NULL AND destination_id NOT IN (SELECT id FROM payout_destinations)`,
    `UPDATE payout_destinations SET vendor_id = NULL WHERE vendor_id IS NOT NULL AND vendor_id NOT IN (SELECT id FROM vendors)`,
    `DELETE FROM kyc_submissions WHERE user_profile_id NOT IN (SELECT id FROM user_profiles)`,
    `UPDATE analytics_snapshots SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)`,
    `UPDATE business_insights SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)`,
    `UPDATE reports SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)`,
    `UPDATE virtual_accounts SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)`,
    `UPDATE audit_logs SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)`,
    `UPDATE scheduled_payments SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)`,
    `DELETE FROM company_balances WHERE company_id NOT IN (SELECT id FROM companies)`,
    // === Audit Fix Cleanup (2026-03-03) ===
    `UPDATE transactions SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)`,
    `UPDATE payouts SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)`,
    `UPDATE wallets SET virtual_account_id = NULL WHERE virtual_account_id IS NOT NULL AND virtual_account_id NOT IN (SELECT id FROM virtual_accounts)`,
    // === Phase 3: user_profiles FK cleanup (2026-03-04) ===
    `UPDATE user_profiles SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)`,
    // === Phase 4: Delete fake/empty virtual accounts (2026-03-05) ===
    `DELETE FROM virtual_accounts WHERE account_number LIKE 'PENDING-%'`,
    `DELETE FROM virtual_accounts WHERE account_number IS NULL OR account_number = '' OR account_number LIKE 'pending_%'`,
    // Normalize bill status to lowercase
    `UPDATE bills SET status = LOWER(status) WHERE status != LOWER(status)`,
  ];

  const phase5FKs = [
    // Core entity FKs
    `DO $$ BEGIN ALTER TABLE expenses ADD CONSTRAINT expenses_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE expenses ADD CONSTRAINT expenses_vendor_id_fk FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE expenses ADD CONSTRAINT expenses_department_id_fk FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE bills ADD CONSTRAINT bills_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE budgets ADD CONSTRAINT budgets_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE virtual_cards ADD CONSTRAINT virtual_cards_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE departments ADD CONSTRAINT departments_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE team_members ADD CONSTRAINT team_members_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE team_members ADD CONSTRAINT team_members_department_id_fk FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE payroll_entries ADD CONSTRAINT payroll_entries_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE payroll_entries ADD CONSTRAINT payroll_entries_department_id_fk FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE invoices ADD CONSTRAINT invoices_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE vendors ADD CONSTRAINT vendors_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE card_transactions ADD CONSTRAINT card_transactions_card_id_fk FOREIGN KEY (card_id) REFERENCES virtual_cards(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE card_transactions ADD CONSTRAINT card_transactions_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE company_members ADD CONSTRAINT company_members_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE company_invitations ADD CONSTRAINT company_invitations_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    // Financial entity FKs
    `DO $$ BEGIN ALTER TABLE wallets ADD CONSTRAINT wallets_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_wallet_id_fk FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE payouts ADD CONSTRAINT payouts_destination_id_fk FOREIGN KEY (destination_id) REFERENCES payout_destinations(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE payout_destinations ADD CONSTRAINT payout_destinations_vendor_id_fk FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE kyc_submissions ADD CONSTRAINT kyc_submissions_user_profile_id_fk FOREIGN KEY (user_profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE company_balances ADD CONSTRAINT company_balances_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    // Additional FKs
    `DO $$ BEGIN ALTER TABLE analytics_snapshots ADD CONSTRAINT analytics_snapshots_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE business_insights ADD CONSTRAINT business_insights_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE reports ADD CONSTRAINT reports_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE virtual_accounts ADD CONSTRAINT virtual_accounts_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE scheduled_payments ADD CONSTRAINT scheduled_payments_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    // === Audit Fix FKs (2026-03-03) ===
    `DO $$ BEGIN ALTER TABLE transactions ADD CONSTRAINT transactions_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE payouts ADD CONSTRAINT payouts_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE wallets ADD CONSTRAINT wallets_virtual_account_id_fk FOREIGN KEY (virtual_account_id) REFERENCES virtual_accounts(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    // === Phase 3: user_profiles FK (2026-03-04) ===
    `DO $$ BEGIN ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ];

  // Execute all phases
  const allStmts = [
    ...phase1,
    ...phase2,
    ...phase3,
    ...phase4,
    ...phase5Cleanup,
    ...phase5FKs,
  ];

  let success = 0, failed = 0, skipped = 0;

  for (const stmt of allStmts) {
    try {
      await client.query(stmt);
      success++;
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('already exists') || msg.includes('does not exist') || msg.includes('duplicate')) {
        skipped++;
      } else {
        failed++;
        console.error(`  FAILED: ${msg}`);
        console.error(`  SQL: ${stmt.substring(0, 200)}...`);
      }
    }
  }

  console.log(`\n  Schema migration: ${success} succeeded, ${failed} failed, ${skipped} skipped\n`);
  return failed === 0;
}

async function runBackfills(client) {
  console.log('\n=== Running Data Backfills ===\n');

  const backfills = [
    // Backfill 1: card_transactions.company_id
    {
      label: 'card_transactions.company_id from virtual_cards',
      sql: `UPDATE card_transactions ct SET company_id = vc.company_id FROM virtual_cards vc WHERE ct.card_id = vc.id AND ct.company_id IS NULL AND vc.company_id IS NOT NULL`
    },
    // Backfill 2: Enum casing normalization
    { label: 'bills status → lowercase', sql: `UPDATE bills SET status = LOWER(status) WHERE status != LOWER(status)` },
    { label: 'transactions status → lowercase', sql: `UPDATE transactions SET status = LOWER(status) WHERE status != LOWER(status)` },
    { label: 'transactions type → lowercase', sql: `UPDATE transactions SET type = LOWER(type) WHERE type != LOWER(type)` },
    { label: 'virtual_cards status → lowercase', sql: `UPDATE virtual_cards SET status = LOWER(status) WHERE status != LOWER(status)` },
    { label: 'team_members status → lowercase', sql: `UPDATE team_members SET status = LOWER(status) WHERE status != LOWER(status)` },
    { label: 'departments status → lowercase', sql: `UPDATE departments SET status = LOWER(status) WHERE status != LOWER(status)` },
    // Backfill 3: Notification settings sync
    {
      label: 'notification_settings from user_profiles',
      sql: `INSERT INTO notification_settings (user_id, email_enabled, sms_enabled, push_enabled, in_app_enabled, expense_notifications, payment_notifications, budget_notifications, weekly_digest, bill_notifications, security_notifications, marketing_notifications, created_at, updated_at) SELECT up.cognito_sub, up.email_notifications, up.sms_notifications, up.push_notifications, true, up.expense_alerts, up.payment_reminders, up.budget_warnings, up.weekly_digest, true, true, false, now()::text, now()::text FROM user_profiles up WHERE NOT EXISTS (SELECT 1 FROM notification_settings ns WHERE ns.user_id = up.cognito_sub)`
    },
    // Backfill 4: companySettings → companies
    {
      label: 'companySettings data → companies table',
      sql: `UPDATE companies c SET email = cs.company_email, phone = cs.company_phone, address = cs.company_address, timezone = cs.timezone, fiscal_year_start = cs.fiscal_year_start, date_format = cs.date_format, language = cs.language, tax_id = cs.tax_id, registration_number = cs.registration_number, tagline = cs.company_tagline, primary_color = cs.primary_color, secondary_color = cs.secondary_color, invoice_prefix = cs.invoice_prefix, invoice_footer = cs.invoice_footer, invoice_terms = cs.invoice_terms, show_logo_on_invoice = cs.show_logo_on_invoice, show_logo_on_receipts = cs.show_logo_on_receipts, auto_approve_below = cs.auto_approve_below, require_receipts = cs.require_receipts, expense_categories = cs.expense_categories, country_code = cs.country_code, region = cs.region, payment_provider = cs.payment_provider, paystack_enabled = cs.paystack_enabled, stripe_enabled = cs.stripe_enabled, notifications_enabled = cs.notifications_enabled, two_factor_enabled = cs.two_factor_enabled FROM company_settings cs WHERE cs.id = 1 AND c.email IS NULL`
    },
  ];

  for (const { label, sql } of backfills) {
    try {
      const result = await client.query(sql);
      console.log(`  ✓ ${label}: ${result.rowCount} rows affected`);
    } catch (err) {
      console.error(`  ✗ ${label}: ${err.message}`);
    }
  }
}

async function runVerification(client) {
  console.log('\n=== Verification Queries ===\n');

  const checks = [
    { label: 'Orphaned expenses', sql: `SELECT count(*) as c FROM expenses WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)` },
    { label: 'Orphaned bills', sql: `SELECT count(*) as c FROM bills WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)` },
    { label: 'Orphaned card_txns', sql: `SELECT count(*) as c FROM card_transactions WHERE card_id NOT IN (SELECT id FROM virtual_cards)` },
    { label: 'Orphaned wallet_txns', sql: `SELECT count(*) as c FROM wallet_transactions WHERE wallet_id NOT IN (SELECT id FROM wallets)` },
    { label: 'Total companies', sql: `SELECT count(*) as c FROM companies` },
    { label: 'Total expenses', sql: `SELECT count(*) as c FROM expenses` },
    { label: 'company_balances rows', sql: `SELECT count(*) as c FROM company_balances` },
  ];

  for (const { label, sql } of checks) {
    try {
      const result = await client.query(sql);
      console.log(`  ${label}: ${result.rows[0].c}`);
    } catch (err) {
      console.error(`  ${label}: ERROR - ${err.message}`);
    }
  }
}

async function main() {
  const mode = process.argv[2] || 'all';
  console.log(`\nFinanciar Database Migration Runner`);
  console.log(`Mode: ${mode}`);
  console.log(`Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')}\n`);

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('Connected to database.\n');

  try {
    if (mode === 'migrate' || mode === 'all') {
      // Phase 0: Run base migration SQL files to create tables
      const migrationsDir = path.join(__dirname, '..', 'migrations');
      const sqlFiles = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      for (const file of sqlFiles) {
        await runSQL(client, path.join('migrations', file), file);
      }

      // Phase 1+: Run ALTER TABLE, indexes, FKs, etc.
      await runDrizzlePush(client);
    }

    if (mode === 'backfill' || mode === 'all') {
      await runBackfills(client);
    }

    if (mode === 'verify' || mode === 'all') {
      await runVerification(client);
    }

    console.log('\n=== Migration complete ===\n');
  } catch (err) {
    console.error('\nFATAL ERROR:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
