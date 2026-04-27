-- AUD-PR-010 / AUD-DB-010 Phase 1 — Stripe Connect scaffolding.
--
-- Adds the columns the parallel-write Connect path needs without
-- activating it. The path stays inert until a tenant's
-- companies.payout_flags.useStripeConnect is set to true (see
-- companies.payout_flags column added below).
--
-- See STRIPE_CONNECT_MIGRATION_PLAN.md for the three-phase migration.
-- This migration is Phase 1's schema component only.
--
-- Idempotent — every column / index uses IF NOT EXISTS.

-- payout_destinations: Stripe Connect Express account fields.
-- stripeConnectAccountId is the acct_* identifier returned by
-- stripe.accounts.create. Empty until the recipient completes
-- Express onboarding via stripe.accountLinks.create.
ALTER TABLE payout_destinations
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text;

-- Onboarding status driven by Stripe's account.updated webhook.
-- Values: 'not_started' (default for legacy rows), 'pending'
-- (account exists but onboarding incomplete), 'verified'
-- (charges_enabled + payouts_enabled both true), 'restricted'
-- (Stripe flagged the account; resolve via dashboard link),
-- 'disabled' (Stripe permanently disabled the account).
ALTER TABLE payout_destinations
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_status text DEFAULT 'not_started';

-- Index on the acct_* id so webhook handlers can reverse-lookup the
-- destination row by account.id without a sequential scan.
CREATE INDEX IF NOT EXISTS payout_destinations_stripe_connect_idx
  ON payout_destinations (stripe_connect_account_id);

COMMENT ON COLUMN payout_destinations.stripe_connect_account_id IS
  'AUD-PR-010 / AUD-DB-010 Phase 1: Stripe Express account id (acct_*). '
  'Empty until the recipient completes Express onboarding. When set AND '
  'companies.payout_flags.useStripeConnect=true, paymentService.initiateTransfer '
  'uses stripe.transfers.create instead of the legacy bank-token + payouts.create.';

COMMENT ON COLUMN payout_destinations.stripe_connect_onboarding_status IS
  'Lifecycle: not_started | pending | verified | restricted | disabled. '
  'Driven by Stripe account.updated webhook events.';

-- companies: per-tenant feature flags for the payment-flow migration.
-- Sparse map; absent keys = legacy behaviour. The Connect path checks
-- payout_flags.useStripeConnect on every initiateTransfer call.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS payout_flags jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN companies.payout_flags IS
  'AUD-PR-010 / AUD-DB-010 Phase 1: per-tenant opt-in flags for '
  'payment-flow migrations. Currently { useStripeConnect: true } '
  'gates the Connect Express path. See STRIPE_CONNECT_MIGRATION_PLAN.md.';
