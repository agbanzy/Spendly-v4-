-- LU-DD-3 Phase 4 / AUD-DD-TEAM-001 — DROP team_members table
--
-- ##################################################################
-- DEFERRED — DO NOT MOVE INTO `migrations/` UNTIL AT LEAST ONE FULL
-- SPRINT OF CLEAN PARALLEL-WRITE OPERATION HAS BEEN OBSERVED IN
-- PRODUCTION. The migration runner deliberately does not pick up this
-- file from `migrations-deferred/`. See README in that folder.
-- ##################################################################
--
-- Apply procedure (when ready):
--   1. Snapshot the prod RDS database.
--   2. Run a verification query to confirm parity:
--        SELECT count(*) FROM team_members;
--        SELECT count(*) FROM company_members;
--        SELECT count(*) FROM team_members tm
--          WHERE NOT EXISTS (
--            SELECT 1 FROM company_members cm
--            WHERE cm.company_id = tm.company_id
--              AND LOWER(cm.email) = LOWER(tm.email)
--          );
--      The third count must be ZERO. If it isn't, run a one-time
--      backfill before proceeding (see migration 0013 for the pattern).
--   3. Move this file from `migrations-deferred/` to `migrations/`.
--   4. Deploy. The migration runner will pick it up at startup and
--      execute the DROP.
--
-- Rollback: restore from the pre-step-1 snapshot. The DROP is
-- destructive; there is no in-place revert.

-- Belt-and-braces parity check: refuse to drop if team_members holds
-- any rows that aren't mirrored to company_members. This catches the
-- "operator skipped step 2" scenario.
DO $$
DECLARE
  unmatched integer;
BEGIN
  SELECT count(*) INTO unmatched
  FROM team_members tm
  WHERE tm.company_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = tm.company_id
        AND LOWER(cm.email) = LOWER(tm.email)
    );
  IF unmatched > 0 THEN
    RAISE EXCEPTION
      'LU-DD-3 Phase 4 ABORTED: % team_members rows have no matching company_members row. Run the Phase-1 backfill first.',
      unmatched;
  END IF;
  RAISE NOTICE 'LU-DD-3 Phase 4: parity verified, dropping team_members.';
END
$$;

-- The actual drop. CASCADE removes any FK constraints referring to
-- team_members (e.g. payroll snapshots that may have a team_member_id
-- column — verify in your environment before applying).
DROP TABLE IF EXISTS team_members CASCADE;
