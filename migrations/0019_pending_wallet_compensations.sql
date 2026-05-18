-- TP-HIGH-07 (AUDIT_TRANSFERS_PAYOUTS_2026_05_17 §4.4) — Pending wallet
-- compensations queue. Captures wallet credit-back requests that failed
-- mid-route (DB blip during the catch block in /payment/transfer's
-- creditWallet call) so a worker can retry them out-of-band instead of
-- leaving the wallet debited forever.
--
-- Non-destructive forward migration:
--   - Adds new table only; no existing rows touched.
--   - Auto-applied at startup by scripts/run-migration.cjs.
--
-- Rollback (if ever needed):
--   DROP TABLE pending_wallet_compensations;
--   (only safe if no rows present; otherwise drain the queue first by
--    running the worker until status='completed' for all rows.)

CREATE TABLE IF NOT EXISTS pending_wallet_compensations (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id text NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  amount numeric(16, 2) NOT NULL,
  currency text NOT NULL,
  original_reference text NOT NULL,
  reason text NOT NULL,
  failure_kind text NOT NULL DEFAULT 'transfer_refund',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  last_attempt_at text,
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb,
  created_at text NOT NULL DEFAULT now(),
  updated_at text NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pending_wallet_compensations_status_idx
  ON pending_wallet_compensations (status);

CREATE INDEX IF NOT EXISTS pending_wallet_compensations_wallet_id_idx
  ON pending_wallet_compensations (wallet_id);

-- Uniqueness on (wallet_id, original_reference) prevents duplicate enqueue
-- when the route's catch block runs more than once for the same original
-- transfer (eg. user retries after seeing the 5xx, wallet is still debited,
-- creditWallet fails again, second enqueue would otherwise double the queue).
-- The storage method enqueuePendingWalletCompensation uses ON CONFLICT DO
-- NOTHING — second enqueue is a silent no-op, original row is preserved
-- with its attempt counter intact.
CREATE UNIQUE INDEX IF NOT EXISTS pending_wallet_compensations_wallet_ref_unique_idx
  ON pending_wallet_compensations (wallet_id, original_reference);
