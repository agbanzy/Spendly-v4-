-- AUD-DB-008 — apply NOT NULL to payouts.company_id
--
-- ##################################################################
-- DEFERRED — DO NOT MOVE INTO `migrations/` UNTIL ORPHAN COUNT IS ZERO.
-- The pre-Sprint-1 open POST /payouts endpoint (closed in PR #23)
-- could create payout rows with NULL company_id. The Sprint-1 fix
-- prevents new orphans, but historical rows must be hand-resolved
-- before this constraint can apply. See README in this folder.
-- ##################################################################
--
-- Pre-condition (run in production):
--   SELECT count(*) FROM payouts WHERE company_id IS NULL;
--
--   If this returns > 0, decide for each orphan whether to:
--     (a) Backfill — UPDATE payouts SET company_id = '<correct-company-id>'
--         WHERE id = '<payout-id>'.  Use audit_logs (entityType='payout',
--         entityId=<payout-id>) and the initiatedBy column to trace
--         which company the payout intended to operate on.
--     (b) Delete — DELETE FROM payouts WHERE id = '<payout-id>' if the
--         row was never processed AND was a queue-poisoning artefact
--         from before AUD-DB-001 was fixed.
--
--   Re-run the count query and confirm it returns zero before proceeding.
--
-- Apply procedure (when count is zero):
--   1. Snapshot the prod RDS database.
--   2. Re-confirm the orphan count one final time.
--   3. Move this file from `migrations-deferred/` to `migrations/`.
--   4. Deploy. The migration runner will pick it up at startup.
--   5. Watch the deploy logs — the migration NOTICE should report
--      "0 orphan rows; applying NOT NULL constraint" before the
--      ALTER TABLE runs.
--
-- Rollback: ALTER TABLE payouts ALTER COLUMN company_id DROP NOT NULL;
-- (The constraint addition is reversible without data loss; only the
-- hand-resolved orphans cannot be unbackfilled / unbacked-out.)

-- Belt-and-braces guard: refuse to apply if orphans are still present.
-- Mirrors the parity-check pattern from 0014_drop_team_members.sql.
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT count(*) INTO orphan_count FROM payouts WHERE company_id IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'AUD-DB-008 ABORT: % payout rows still have NULL company_id. '
      'Resolve orphans before applying NOT NULL. See header comment '
      'for backfill / delete guidance. The Sprint-1 AUD-DB-001 fix '
      'prevents new orphans, but historical rows from before that '
      'fix must be hand-resolved. Query: SELECT id, recipient_id, '
      'recipient_name, amount, status, created_at FROM payouts '
      'WHERE company_id IS NULL ORDER BY created_at;',
      orphan_count;
  END IF;

  RAISE NOTICE 'AUD-DB-008: 0 orphan rows; applying NOT NULL constraint';
END
$$;

-- Apply the constraint. Will be a fast metadata-only operation since
-- we've already proven there are no NULL rows to scan.
ALTER TABLE payouts ALTER COLUMN company_id SET NOT NULL;
