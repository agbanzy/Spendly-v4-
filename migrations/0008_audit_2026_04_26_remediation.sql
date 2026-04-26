-- Audit 2026-04-26 remediation migration
-- Addresses findings: AUD-BE-002, AUD-BE-003, AUD-BE-006, AUD-BE-007, AUD-BE-014, AUD-BE-017, AUD-BE-018
-- See docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md for full design.

-- ============================================================
-- LU-001: Wallet ↔ Transaction bridge
-- Backfill `transactions` rows for existing wallet_transactions that
-- have no corresponding `transactions` entry (one-time, idempotent).
-- ============================================================

INSERT INTO transactions (
    id, type, amount, fee, status, date, description, currency,
    user_id, reference, wallet_transaction_id, company_id
)
SELECT
    gen_random_uuid()::text,
    CASE wt.type
        WHEN 'bill_payment'       THEN 'Bill'
        WHEN 'card_funding'       THEN 'Funding'
        WHEN 'wallet_transfer'    THEN 'Transfer'
        WHEN 'wallet_transfer_in' THEN 'Transfer'
        WHEN 'reversal'           THEN 'Refund'
        ELSE 'Other'
    END                                                 AS type,
    wt.amount,
    '0'                                                 AS fee,
    wt.status,
    SUBSTRING(wt.created_at, 1, 10)                     AS date,
    wt.description,
    wt.currency,
    NULL                                                AS user_id,
    wt.reference,
    wt.id                                               AS wallet_transaction_id,
    w.company_id                                        AS company_id
FROM wallet_transactions wt
JOIN wallets w ON w.id = wt.wallet_id
LEFT JOIN transactions t ON t.wallet_transaction_id = wt.id
WHERE t.id IS NULL;

CREATE INDEX IF NOT EXISTS transactions_wallet_transaction_id_idx
  ON transactions (wallet_transaction_id);

-- ============================================================
-- LU-005: cardTransactions.currency column
-- AUD-BE-007 — international card spend recorded ambiguously.
-- ============================================================

ALTER TABLE card_transactions
  ADD COLUMN IF NOT EXISTS currency text;

UPDATE card_transactions ct
SET currency = COALESCE(vc.currency, 'USD')
FROM virtual_cards vc
WHERE ct.card_id = vc.id
  AND ct.currency IS NULL;

UPDATE card_transactions
SET currency = 'USD'
WHERE currency IS NULL;

ALTER TABLE card_transactions
  ALTER COLUMN currency SET NOT NULL;

ALTER TABLE card_transactions
  ALTER COLUMN currency SET DEFAULT 'USD';

CREATE INDEX IF NOT EXISTS card_transactions_currency_idx
  ON card_transactions (currency);

-- ============================================================
-- LU-004: Soft-delete on financial tables
-- AUD-BE-014 — physical deletes destroy audit trail.
-- ============================================================

ALTER TABLE transactions        ADD COLUMN IF NOT EXISTS deleted_at text;
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS deleted_at text;
ALTER TABLE invoices            ADD COLUMN IF NOT EXISTS deleted_at text;
ALTER TABLE expenses            ADD COLUMN IF NOT EXISTS deleted_at text;

CREATE INDEX IF NOT EXISTS transactions_active_idx
  ON transactions (company_id, date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS wallet_transactions_active_idx
  ON wallet_transactions (wallet_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS invoices_active_idx
  ON invoices (company_id, due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS expenses_active_idx
  ON expenses (company_id, date) WHERE deleted_at IS NULL;

-- ============================================================
-- AUD-BE-006: DB-level scheduler dedup
-- Prevent duplicate recurring bills from racing schedulers.
-- ============================================================

-- Drop any prior duplicates (keep oldest)
DELETE FROM bills b1
USING bills b2
WHERE b1.id > b2.id
  AND b1.company_id IS NOT DISTINCT FROM b2.company_id
  AND b1.name = b2.name
  AND b1.due_date = b2.due_date
  AND COALESCE(b1.frequency, 'monthly') = COALESCE(b2.frequency, 'monthly')
  AND b1.recurring = true
  AND b2.recurring = true;

CREATE UNIQUE INDEX IF NOT EXISTS bills_recurring_dedup_unique
  ON bills (company_id, name, due_date, COALESCE(frequency, 'monthly'))
  WHERE recurring = true;

-- ============================================================
-- LU-008: pending_destructive_actions table for two-admin purge approval
-- AUD-BE-003 — replaces single-admin purge with dual-control flow.
-- ============================================================

CREATE TABLE IF NOT EXISTS pending_destructive_actions (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  action        text NOT NULL,                          -- 'purge_database', etc.
  initiated_by  text NOT NULL,                          -- cognitoSub of admin 1
  initiated_at  text NOT NULL DEFAULT now()::text,
  expires_at    text NOT NULL,                          -- now() + interval '30 min'
  approved_by   text,                                   -- cognitoSub of admin 2
  approved_at   text,
  executed_at   text,
  payload       jsonb NOT NULL,
  CONSTRAINT pending_destructive_actions_distinct_admins
    CHECK (approved_by IS NULL OR approved_by != initiated_by)
);

CREATE INDEX IF NOT EXISTS pending_destructive_actions_action_status_idx
  ON pending_destructive_actions (action, executed_at, expires_at);

-- Feature flag for the purge endpoint — defaults OFF in prod.
INSERT INTO system_settings (key, value, description, is_public)
SELECT 'allow_purge_endpoint', 'false', 'Master switch for the database-purge endpoint. Must be true in addition to two-admin approval. Set via direct DB intervention.', false
WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE key = 'allow_purge_endpoint');

-- ============================================================
-- LU-002: Scheduler advisory lock SQL helper
-- AUD-BE-001 — multi-instance scheduler safety.
-- ============================================================

CREATE OR REPLACE FUNCTION try_acquire_scheduler_lock(name text)
RETURNS boolean AS $$
BEGIN
  RETURN pg_try_advisory_xact_lock(hashtext(name)::int);
END;
$$ LANGUAGE plpgsql VOLATILE;
