-- TP-CRIT-04 / TP-HIGH-05 — UNIQUE (wallet_id, reference) on wallet_transactions
--
-- ##################################################################
-- DEFERRED — DO NOT MOVE INTO `migrations/` UNTIL THE PARITY CHECK
-- BELOW RETURNS ZERO. The constraint will REFUSE TO APPLY if
-- existing data has duplicates, but a pre-check is faster than a
-- failed deploy. See README in this folder.
-- ##################################################################
--
-- Pre-condition (run in production):
--   SELECT wallet_id, reference, COUNT(*) AS dupe_count
--   FROM wallet_transactions
--   GROUP BY wallet_id, reference
--   HAVING COUNT(*) > 1
--   ORDER BY dupe_count DESC
--   LIMIT 20;
--
--   Must return ZERO rows. If duplicates exist, decide for each pair:
--     (a) Both rows reflect a real double-debit caused by the pre-TP-CRIT-04
--         race window. Investigate via wallet.balance and audit_logs;
--         one of the rows likely needs a compensating credit. Do NOT
--         silently delete the duplicate — the wallet balance is wrong.
--     (b) The duplicate is a legitimate retry that the application
--         intended. Mark one of the rows with a different reference
--         (eg. append `-retry-${n}`).
--
-- Apply procedure (when count is zero):
--   1. Snapshot the prod RDS / DO Managed Postgres database.
--   2. Re-confirm the duplicate count one final time.
--   3. node scripts/deferred-migration-helper.cjs check 0017
--      (after registering this id in the helper's PRECHECKS map)
--   4. Move this file from `migrations-deferred/` to `migrations/`.
--   5. Deploy. The migration runner will pick it up at startup.
--   6. Watch for `wallet_transactions_reference_unique` constraint
--      violations in the logs for ~24 hours.
--
-- Rollback: DROP INDEX wallet_transactions_reference_unique;
-- (Then accept that double-debit races are again possible until
-- the unique index is restored.)

-- Belt-and-braces guard: refuse to apply if duplicates remain.
DO $$
DECLARE
  dupe_count integer;
BEGIN
  SELECT count(*) INTO dupe_count FROM (
    SELECT wallet_id, reference
    FROM wallet_transactions
    GROUP BY wallet_id, reference
    HAVING COUNT(*) > 1
  ) AS dupes;

  IF dupe_count > 0 THEN
    RAISE EXCEPTION
      'TP-CRIT-04 ABORT: % duplicate (wallet_id, reference) groups still exist '
      'in wallet_transactions. Resolve duplicates before applying the unique '
      'index. See header comment for the per-pair resolution guide. Query: '
      'SELECT wallet_id, reference, COUNT(*) FROM wallet_transactions '
      'GROUP BY wallet_id, reference HAVING COUNT(*) > 1;',
      dupe_count;
  END IF;

  RAISE NOTICE 'TP-CRIT-04: 0 duplicates; creating UNIQUE index';
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_wallet_reference_unique_idx
  ON wallet_transactions (wallet_id, reference);

COMMENT ON INDEX wallet_transactions_wallet_reference_unique_idx IS
  'TP-CRIT-04: enforces that no two wallet_transactions rows share the same '
  'wallet_id + reference. The debitWalletIdempotent helper relies on ON CONFLICT '
  'DO NOTHING against this constraint to refuse duplicate debits at the DB layer.';
