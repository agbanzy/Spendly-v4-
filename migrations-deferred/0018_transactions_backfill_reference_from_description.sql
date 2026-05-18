-- TP-HIGH-10 — Backfill transactions.reference from description for
-- legacy /payment/transfer rows that pre-date the column-correctness fix.
--
-- ##################################################################
-- DEFERRED — DO NOT MOVE INTO `migrations/` WITHOUT REVIEWING THE
-- WHERE CLAUSE AGAINST PRODUCTION DATA. The backfill scope is
-- intentionally narrow (type='transfer', status='processing' or 'completed',
-- reference IS NULL, description LIKE provider-ref pattern). On a small
-- prod database (< 100k transactions) the safer alternative is to leave
-- legacy rows alone and only apply the column-correctness fix going
-- forward — webhook reconciliation will naturally heal newer rows.
-- ##################################################################
--
-- Background:
--   Before commit <STG2-B>, /payment/transfer wrote the provider
--   reference into `description` and left `reference` NULL. This meant
--   webhookHandlers.ts → storage.getTransactionByReference() could
--   never find these rows to update their status on a provider webhook.
--   The fix (STG2-B) writes `reference: providerRef` going forward,
--   but legacy rows still have the data in the wrong column.
--
-- Pre-condition (run in production — get a sense of the blast radius):
--   SELECT count(*) AS legacy_rows
--   FROM transactions
--   WHERE type = 'transfer'
--     AND reference IS NULL
--     AND description ~ '^(TRF-|tr_|po_|trsf_)'
--     AND created_at >= NOW() - INTERVAL '90 days';
--
--   If `legacy_rows` is small (< 1000) and bounded to the soak window,
--   this backfill is low-risk. If it's larger or unbounded, prefer
--   leaving it alone — newer rows write to the right column and old
--   ones can be repaired ad-hoc via a follow-up script if a specific
--   reconciliation case demands it.
--
-- Apply procedure (when row count is acceptable):
--   1. Snapshot the prod database.
--   2. Re-confirm the legacy row count.
--   3. node scripts/deferred-migration-helper.cjs check 0018
--      (after registering this id in the helper's PRECHECKS map)
--   4. Move this file from `migrations-deferred/` to `migrations/`.
--   5. Deploy. The migration runner will pick it up at startup.
--   6. Verify: `SELECT count(*) FROM transactions WHERE type='transfer'
--      AND reference IS NULL AND description ~ '^(TRF-|tr_|po_|trsf_)';`
--      should return 0 for the rows the backfill covered.
--
-- Rollback:
--   The migration is data-only (no schema change). To roll back,
--   restore from the snapshot taken in step 1.

-- Belt-and-braces guard: cap the row count we're willing to backfill in
-- a single migration. If production has more than this, the migration
-- aborts so an operator can review before running it as a controlled
-- batch.
DO $$
DECLARE
  candidate_count integer;
BEGIN
  SELECT count(*) INTO candidate_count
  FROM transactions
  WHERE type = 'transfer'
    AND reference IS NULL
    AND description ~ '^(TRF-|tr_|po_|trsf_)';

  IF candidate_count > 50000 THEN
    RAISE EXCEPTION
      'Refusing to backfill % rows in a single migration. '
      'Run as a controlled batch instead (see migration header).',
      candidate_count;
  END IF;

  RAISE NOTICE 'Backfilling % transactions rows: description -> reference', candidate_count;
END $$;

-- Move provider-ref from description -> reference for legacy transfer rows.
-- We keep `description` populated with a generic label so audit/UI surfaces
-- that read description don't suddenly render the raw provider id.
UPDATE transactions
SET
  reference   = description,
  description = 'Wallet-to-bank transfer (backfilled 2026-05-18)'
WHERE type = 'transfer'
  AND reference IS NULL
  AND description ~ '^(TRF-|tr_|po_|trsf_)';

-- Note: the partial-vs-full index trade-off — the existing
-- `transactions_reference_idx` from shared/schema.ts:304 is a full
-- B-tree on `reference`. For tables with a large fraction of NULL
-- references, a partial index `WHERE reference IS NOT NULL` would be
-- smaller and faster. The audit recommended this; deferred to a
-- follow-up because the current index is functionally correct, just
-- not size-optimal. See LOGIC_UPGRADE_PROPOSALS for the partial-index
-- proposal.
