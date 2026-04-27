-- AUD-DB-007 follow-up — per-company override map for daily payout limits.
--
-- The Sprint-3 fix (PR #28) added a global per-currency floor in
-- payouts.routes.ts:DAILY_PAYOUT_LIMITS. This column lets operators
-- tune the cap on a per-company basis without redeploying. Sparse map
-- keyed by 3-letter ISO currency code; missing currencies fall back to
-- the hardcoded floor.
--
-- Idempotent — safe to re-run on every restart.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS daily_payout_limits jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Documentation comment (visible in psql \d+ companies).
COMMENT ON COLUMN companies.daily_payout_limits IS
  'AUD-DB-007 follow-up: per-currency override of DAILY_PAYOUT_LIMITS. '
  'Sparse map { USD: 200000, NGN: 200000000, ... }. Currencies absent '
  'from this map fall back to the hardcoded floor.';
