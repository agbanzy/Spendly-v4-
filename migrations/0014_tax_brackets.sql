-- AUD-PR-012 — versioned tax brackets config table
--
-- Lifts the hardcoded 2024-era brackets out of
-- server/routes/payroll.routes.ts:36-168 (the /payroll/tax-estimate
-- switch statement) into a queryable table with effective-window
-- semantics. Pay-date aware lookups can now pick the correct
-- bracket set without redeploying.
--
-- Seed data preserves byte-for-byte the existing in-route values for
-- NG / GH / KE / ZA / US / GB so the /tax-estimate refactor is a pure
-- data-source swap with no behaviour change at this point in time.
-- Future tax updates land as new rows with effective_from set forward.

CREATE TABLE IF NOT EXISTS tax_brackets (
  id              varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  country         text         NOT NULL,
  effective_from  text         NOT NULL,        -- YYYY-MM-DD inclusive
  effective_to    text,                          -- YYYY-MM-DD exclusive (null = current)
  cadence         text         NOT NULL DEFAULT 'annual',  -- 'annual' | 'monthly'
  tiers           jsonb        NOT NULL,         -- [{ limit, rate }, ...]
  flat_reduction  numeric(14,2) DEFAULT '0',
  source          text,
  created_at      text         NOT NULL DEFAULT now(),
  -- Idempotency: the runner re-runs all SQL files on every startup, so
  -- the seed INSERTs below need ON CONFLICT to avoid duplicate rows.
  UNIQUE (country, effective_from)
);

CREATE INDEX IF NOT EXISTS tax_brackets_country_effective_idx
  ON tax_brackets (country, effective_from);

-- Seed: 2024-baseline brackets matching the current in-route values.
-- effective_from = '2024-01-01', effective_to = NULL (open-ended).
-- limit:null in the final tier means "remainder of income above prior
-- tier limits" (matches Infinity in the JS switch statements).

-- Nigeria (NG) — annual brackets, source: PIT Act 2024 amendments.
INSERT INTO tax_brackets (country, effective_from, cadence, tiers, source) VALUES
  ('NG', '2024-01-01', 'annual',
   '[{"limit":300000,"rate":0.07},{"limit":300000,"rate":0.11},{"limit":500000,"rate":0.15},{"limit":500000,"rate":0.19},{"limit":1600000,"rate":0.21},{"limit":null,"rate":0.24}]'::jsonb,
   'NG PIT Act 2024')
ON CONFLICT (country, effective_from) DO NOTHING;

-- Ghana (GH) — annual brackets, source: GRA Act 2024.
INSERT INTO tax_brackets (country, effective_from, cadence, tiers, source) VALUES
  ('GH', '2024-01-01', 'annual',
   '[{"limit":4380,"rate":0},{"limit":1320,"rate":0.05},{"limit":1560,"rate":0.10},{"limit":36000,"rate":0.175},{"limit":196740,"rate":0.25},{"limit":null,"rate":0.30}]'::jsonb,
   'GH GRA Act 2024')
ON CONFLICT (country, effective_from) DO NOTHING;

-- Kenya (KE) — MONTHLY brackets with 2400 KES personal relief, source: KRA Finance Act 2024.
INSERT INTO tax_brackets (country, effective_from, cadence, tiers, flat_reduction, source) VALUES
  ('KE', '2024-01-01', 'monthly',
   '[{"limit":24000,"rate":0.10},{"limit":8333,"rate":0.25},{"limit":467667,"rate":0.30},{"limit":300000,"rate":0.325},{"limit":null,"rate":0.35}]'::jsonb,
   '2400',
   'KE KRA Finance Act 2024')
ON CONFLICT (country, effective_from) DO NOTHING;

-- South Africa (ZA) — annual with 17235 ZAR rebate, source: SARS 2024.
INSERT INTO tax_brackets (country, effective_from, cadence, tiers, flat_reduction, source) VALUES
  ('ZA', '2024-01-01', 'annual',
   '[{"limit":237100,"rate":0.18},{"limit":133400,"rate":0.26},{"limit":156600,"rate":0.31},{"limit":220200,"rate":0.36},{"limit":356600,"rate":0.39},{"limit":499700,"rate":0.41},{"limit":null,"rate":0.45}]'::jsonb,
   '17235',
   'ZA SARS 2024')
ON CONFLICT (country, effective_from) DO NOTHING;

-- United States (US) — annual, single-filer 2024 brackets.
INSERT INTO tax_brackets (country, effective_from, cadence, tiers, source) VALUES
  ('US', '2024-01-01', 'annual',
   '[{"limit":11600,"rate":0.10},{"limit":35550,"rate":0.12},{"limit":53375,"rate":0.22},{"limit":90750,"rate":0.24},{"limit":40525,"rate":0.32},{"limit":161950,"rate":0.35},{"limit":null,"rate":0.37}]'::jsonb,
   'IRS 2024 single-filer')
ON CONFLICT (country, effective_from) DO NOTHING;

-- United Kingdom (GB) — annual, source: HMRC 2024-25.
INSERT INTO tax_brackets (country, effective_from, cadence, tiers, source) VALUES
  ('GB', '2024-01-01', 'annual',
   '[{"limit":12570,"rate":0},{"limit":37700,"rate":0.20},{"limit":99730,"rate":0.40},{"limit":null,"rate":0.45}]'::jsonb,
   'HMRC 2024-25')
ON CONFLICT (country, effective_from) DO NOTHING;
