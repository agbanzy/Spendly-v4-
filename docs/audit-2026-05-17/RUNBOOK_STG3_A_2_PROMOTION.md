# Runbook — STG3-A-2 backfill promotion

**Audience:** on-call operator (DBA + backend lead).
**Targets:** `migrations-deferred/0020_payouts_backfill_typed_approval_columns.sql`.
**Owner:** Backend platform.
**Last refreshed:** 2026-05-18.

This runbook is the step-by-step for promoting the deferred backfill that lifts `payouts.metadata.firstApproval` / `secondApproval` JSONB into the typed columns `firstApprovedBy` / `firstApprovedAt` / `approvedAt` / `approvalStatus`.

The promotion itself is intentionally NOT autonomous — the agent that wrote this runbook (and authored STG3-A in PR #53) was prevented from doing the `git mv` because the documented pre-conditions are not yet satisfied. This file gives the operator the exact procedure for when they ARE satisfied.

---

## When to run

**ALL of the following must be true:**

1. **PR #53 (STG3-A) is merged to `main` and deployed to production.** Verify with `git log main --grep STG3-A` and the production deploy timestamp in your CD dashboard.
2. **At least 24 hours have elapsed since the STG3-A deploy.** The soak window proves the parallel-write code path (typed columns AND JSONB written together) hasn't regressed any approve-flow behaviour.
3. **No incidents have fired on `payouts` since the STG3-A deploy.** Search PagerDuty for `payout` / `dual-approval` / `approve` keywords in the soak window.
4. **The candidate row count is within the migration's 50k-row cap** — see § Pre-promotion check below.

If any of (1)–(4) fail, **do not promote.** Re-check after the relevant condition clears.

---

## Pre-promotion check (read-only, safe to run any time)

```bash
DATABASE_URL=postgres://… node scripts/deferred-migration-helper.cjs check 0020
```

Expected PASS output (the helper surfaces the candidate row count in the PASS line):

```
Checking 0020_payouts_backfill_typed_approval_columns.sql — STG3-A...
  Lifts metadata.firstApproval / metadata.secondApproval JSONB into
  the typed payouts columns ...

  PASS — Candidate rows = N (within the 100k cap). Confirm STG3-A code
  has been deployed and soaked for >=24h, then promote.

  Next: node scripts/deferred-migration-helper.cjs promote 0020
```

If the row count is **0**, the backfill is a no-op — either nothing was approved before STG3-A's parallel-write deployed, or this op was already run. Either way, promotion is safe but unnecessary; you can mark this runbook complete.

If the row count is **above 100k**, the helper FAILs and tells you to split into per-tenant batches (the migration's DO `$$` guard refuses to backfill more than 100k in one shot). See § Large-batch fallback.

---

## Promotion procedure (operator-side only)

These steps are intentionally NOT automated — each is a deliberate human decision.

### Step 1 — Take a snapshot

```bash
# DigitalOcean Managed Postgres snapshot via doctl (or via the DO console):
doctl databases backups list <db-uuid>
# Confirm the most-recent backup is < 30 minutes old, OR trigger a new one:
doctl databases backups create <db-uuid>
```

Note the backup id. You'll reference it in the rollback section.

### Step 2 — Re-confirm the candidate row count

```bash
DATABASE_URL=postgres://… node scripts/deferred-migration-helper.cjs check 0020
```

Must still PASS with a row count ≤ 50k. If it changed since the first check, investigate (someone may be running approval flows mid-promotion).

### Step 3 — Promote (move the file)

```bash
git checkout main
git pull
git checkout -b ops-promote-0020-typed-approval-backfill-$(date +%Y-%m-%d)
git mv migrations-deferred/0020_payouts_backfill_typed_approval_columns.sql migrations/0020_payouts_backfill_typed_approval_columns.sql
git commit -m "chore(migrations): promote 0020 — backfill payouts typed approval columns"
git push -u origin HEAD
gh pr create --title "chore(migrations): promote 0020 — backfill payouts typed approval columns" --body "Promotion of migrations-deferred/0020_*. Pre-check passed: <N> candidate rows. STG3-A soaked for <X> hours since deploy. Snapshot id: <backup-id>."
```

Merge the PR via the normal review/approval flow. Do NOT bypass branch protection.

### Step 4 — Deploy

The merge triggers the standard CD pipeline. `scripts/run-migration.cjs` picks up the newly-promoted file at startup and runs it (the migration's own DO `$$` guard re-checks the 50k cap and aborts if exceeded — defence in depth).

Watch the deploy logs for:

```
NOTICE: Backfilling <N> payout rows: metadata JSONB -> typed approval columns
```

### Step 5 — Verify

```sql
-- Confirm the backfill landed (should return 0):
SELECT count(*) AS unbackfilled_rows
FROM payouts
WHERE metadata IS NOT NULL
  AND (metadata ? 'firstApproval' OR metadata ? 'secondApproval')
  AND (
    first_approved_by IS NULL
    OR (approved_at IS NULL AND metadata ? 'secondApproval')
  );

-- Spot-check parity for 5 random backfilled rows:
SELECT id,
       first_approved_by, metadata->'firstApproval'->>'by' AS jsonb_first_by,
       first_approved_at, metadata->'firstApproval'->>'at' AS jsonb_first_at,
       approved_at,       metadata->'secondApproval'->>'at' AS jsonb_second_at,
       approval_status
FROM payouts
WHERE metadata ? 'firstApproval'
ORDER BY random()
LIMIT 5;
```

Both queries should show the typed columns matching the JSONB extractor values.

### Step 6 — Update the audit doc

After successful verification, add an entry under "What DID ship" in [`DEFERRED.md`](./DEFERRED.md) (Category A → promoted) noting the date and operator who ran the promotion.

---

## Rollback

The migration is **idempotent and additive at the row level** — it only UPDATEs typed columns where they're NULL; it never touches the JSONB. So a "rollback" really means "reset the typed columns to NULL where they were set by this migration":

```sql
-- Reset the typed columns ONLY for rows where the JSONB still has the
-- original data (i.e., rows the backfill might have touched). The reads
-- in the application still come from JSONB during the parallel-write
-- soak, so this is safe to run.
UPDATE payouts
SET first_approved_by = NULL,
    first_approved_at = NULL,
    approval_status   = 'none'
WHERE metadata ? 'firstApproval';

UPDATE payouts
SET approved_at = NULL
WHERE metadata ? 'secondApproval';
```

If you need a full DB rollback (data corruption, etc.), restore from the snapshot taken in Step 1.

---

## Large-batch fallback (> 100k candidate rows)

The migration's DO `$$` guard refuses to backfill more than 100k rows in a single transaction. If you hit that ceiling:

```bash
# Investigate why the count is so large — likely a tenant with a long
# history of dual-approved payouts that pre-dates STG3-A's parallel-write.
DATABASE_URL=… psql -c "
  SELECT company_id, count(*) AS rows
  FROM payouts
  WHERE metadata IS NOT NULL
    AND (metadata ? 'firstApproval' OR metadata ? 'secondApproval')
    AND first_approved_by IS NULL
  GROUP BY company_id
  ORDER BY rows DESC
  LIMIT 10;
"
```

Then run the backfill UPDATEs scoped to one company at a time (paste each statement directly into a `psql` session — do NOT promote the migration file as-is when above the 50k cap):

```sql
UPDATE payouts
SET first_approved_by = metadata->'firstApproval'->>'by',
    first_approved_at = metadata->'firstApproval'->>'at',
    approval_status   = CASE
      WHEN metadata ? 'secondApproval' THEN 'approved'
      ELSE 'pending_second_approval'
    END
WHERE company_id = '<tenant-uuid>'
  AND metadata IS NOT NULL
  AND metadata ? 'firstApproval'
  AND first_approved_by IS NULL;

UPDATE payouts
SET approved_at = metadata->'secondApproval'->>'at'
WHERE company_id = '<tenant-uuid>'
  AND metadata IS NOT NULL
  AND metadata ? 'secondApproval'
  AND approved_at IS NULL;
```

Once the per-tenant backfill brings the total candidate count below 50k, you can promote the migration file (which then runs a one-shot UPDATE on the residual rows) and let the standard procedure (Step 3 onwards) finish the job.

---

## Where to ask for help

- Slack `#eng-platform` for procedural questions.
- PagerDuty escalation if the deploy fails mid-migration (Step 4 produces an `ERROR:` log).
- Backend lead for `psql` access provisioning if you don't already have it.
