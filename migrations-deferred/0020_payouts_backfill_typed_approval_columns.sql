-- STG3-A (AUDIT_TRANSFERS_PAYOUTS_2026_05_17 §4.4 item 12) — Backfill
-- typed dual-approval columns on payouts from the legacy
-- metadata.firstApproval / metadata.secondApproval JSONB.
--
-- ##################################################################
-- DEFERRED — DO NOT MOVE INTO `migrations/` UNTIL:
--   (1) the parallel-write code change (STG3-A) has been deployed for
--       at least 24h so all new rows write to both typed columns AND
--       JSONB; AND
--   (2) the candidate-row count is bounded (the migration's DO $$
--       guard caps it at 100k — beyond that, run as controlled batches
--       so a single migration doesn't lock the table for long).
-- ##################################################################
--
-- Pre-condition (run in production — gives the candidate count):
--   SELECT count(*) AS legacy_rows
--   FROM payouts
--   WHERE metadata IS NOT NULL
--     AND (metadata ? 'firstApproval' OR metadata ? 'secondApproval')
--     AND (first_approved_by IS NULL OR (approved_at IS NULL AND metadata ? 'secondApproval'));
--
-- Apply procedure:
--   1. Confirm STG3-A code (parallel-write to typed columns) has been
--      shipped and soaked for at least 24h.
--   2. Snapshot the prod database.
--   3. node scripts/deferred-migration-helper.cjs check 0020
--      (after registering this id in the helper's PRECHECKS map)
--   4. Move this file from `migrations-deferred/` to `migrations/`.
--   5. Deploy. The migration runner will pick it up at startup.
--   6. Verify with the pre-condition query — should return 0.
--   7. After at least 7 more days of soak, ship the follow-up PR that
--      switches READS in payouts.routes.ts to the typed columns.
--   8. After another 30 days, ship the JSONB key cleanup (separate
--      migration; not part of this one — drops the firstApproval /
--      secondApproval keys from metadata for shipped rows).
--
-- Rollback:
--   The migration only UPDATEs typed columns to MATCH the JSONB data.
--   To roll back, set the typed columns back to NULL where the JSONB
--   still has the original values. The JSONB itself is never touched
--   by this migration — rollback is safe.

DO $$
DECLARE
  candidate_count integer;
BEGIN
  SELECT count(*) INTO candidate_count
  FROM payouts
  WHERE metadata IS NOT NULL
    AND (metadata ? 'firstApproval' OR metadata ? 'secondApproval')
    AND (
      first_approved_by IS NULL
      OR (approved_at IS NULL AND metadata ? 'secondApproval')
    );

  IF candidate_count > 100000 THEN
    RAISE EXCEPTION
      'Refusing to backfill % payout rows in a single migration. '
      'Run as a controlled batch (UPDATE WHERE id BETWEEN ranges) '
      'instead, or split this migration into per-tenant slices.',
      candidate_count;
  END IF;

  RAISE NOTICE 'Backfilling % payout rows: metadata JSONB -> typed approval columns', candidate_count;
END $$;

-- First-approval backfill: lift metadata.firstApproval.{by,at} into
-- typed columns. Only touches rows where typed columns are still NULL
-- (so re-running is idempotent and never overwrites newer data).
UPDATE payouts
SET
  first_approved_by = metadata->'firstApproval'->>'by',
  first_approved_at = metadata->'firstApproval'->>'at',
  -- Approval status: if a secondApproval exists, the dual-approval
  -- completed (so the row is 'approved'); otherwise it's mid-flight.
  approval_status = CASE
    WHEN metadata ? 'secondApproval' THEN 'approved'
    ELSE 'pending_second_approval'
  END
WHERE metadata IS NOT NULL
  AND metadata ? 'firstApproval'
  AND first_approved_by IS NULL;

-- Second-approval backfill: lift metadata.secondApproval.at into
-- approved_at (the by-field is already in approved_by per the existing
-- maker-checker code path that wrote storage.updatePayout(..., { approvedBy })).
UPDATE payouts
SET approved_at = metadata->'secondApproval'->>'at'
WHERE metadata IS NOT NULL
  AND metadata ? 'secondApproval'
  AND approved_at IS NULL;
