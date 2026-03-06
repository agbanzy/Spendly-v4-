-- Phase 3: Add missing indexes and FK constraints
-- Safe to run idempotently (CREATE INDEX IF NOT EXISTS)

-- notifications indexes
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications" ("user_id");
CREATE INDEX IF NOT EXISTS "notifications_created_at_idx" ON "notifications" ("created_at");
CREATE INDEX IF NOT EXISTS "notifications_user_id_read_idx" ON "notifications" ("user_id", "read");

-- notification_settings index
CREATE INDEX IF NOT EXISTS "notification_settings_user_id_idx" ON "notification_settings" ("user_id");

-- push_tokens index
CREATE INDEX IF NOT EXISTS "push_tokens_user_id_idx" ON "push_tokens" ("user_id");

-- funding_sources index
CREATE INDEX IF NOT EXISTS "funding_sources_user_id_idx" ON "funding_sources" ("user_id");

-- scheduled_payments indexes
CREATE INDEX IF NOT EXISTS "scheduled_payments_company_id_idx" ON "scheduled_payments" ("company_id");
CREATE INDEX IF NOT EXISTS "scheduled_payments_status_idx" ON "scheduled_payments" ("status");
CREATE INDEX IF NOT EXISTS "scheduled_payments_next_run_date_idx" ON "scheduled_payments" ("next_run_date");

-- virtual_cards company_id index (has FK but no index)
CREATE INDEX IF NOT EXISTS "virtual_cards_company_id_idx" ON "virtual_cards" ("company_id");

-- analytics_snapshots indexes
CREATE INDEX IF NOT EXISTS "analytics_snapshots_company_id_idx" ON "analytics_snapshots" ("company_id");
CREATE INDEX IF NOT EXISTS "analytics_snapshots_period_type_idx" ON "analytics_snapshots" ("period_type");
CREATE INDEX IF NOT EXISTS "analytics_snapshots_period_start_idx" ON "analytics_snapshots" ("period_start");

-- business_insights indexes
CREATE INDEX IF NOT EXISTS "business_insights_company_id_idx" ON "business_insights" ("company_id");
CREATE INDEX IF NOT EXISTS "business_insights_category_idx" ON "business_insights" ("category");
CREATE INDEX IF NOT EXISTS "business_insights_is_active_idx" ON "business_insights" ("is_active");

-- user_profiles.company_id FK to companies.id
-- First check for orphan data, then add constraint
DO $$
BEGIN
  -- Clean any orphan company_id references in user_profiles
  UPDATE user_profiles SET company_id = NULL
    WHERE company_id IS NOT NULL
    AND company_id NOT IN (SELECT id FROM companies);

  -- Add FK if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_profiles_company_id_companies_id_fk'
    AND table_name = 'user_profiles'
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT user_profiles_company_id_companies_id_fk
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;
