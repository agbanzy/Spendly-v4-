# Deferred migrations

SQL files in this directory are **NOT** picked up by the migration runner
(`scripts/run-migration.cjs` only globs `migrations/*.sql`). They live
here on purpose: the change is intentionally gated on an operator action
because it is destructive, one-way, or dependent on a soak window in
production.

## How to apply

The fastest path is the helper script `scripts/deferred-migration-helper.cjs`:

```bash
node scripts/deferred-migration-helper.cjs list
DATABASE_URL=postgres://... node scripts/deferred-migration-helper.cjs check 0015
node scripts/deferred-migration-helper.cjs promote 0015   # prints the git-mv command
```

The script READS the DB but never writes. It walks through:
1. Pre-condition queries from the file's header (run against `DATABASE_URL`)
2. Pass/fail with explicit remediation guidance on fail
3. A pre-flight checklist on `promote` (snapshot, deploy window, rollback rehearsal)

Always run `check` against a recent snapshot first, not just prod, so a slow
query doesn't lock production tables.

Manual procedure (if the helper doesn't know about the migration yet):

1. Read the file's header comment carefully — it lists pre-conditions and
   verification queries.
2. Run the verification queries against production (or a fresh snapshot)
   and confirm all parity checks pass.
3. Move the file from `migrations-deferred/` to `migrations/`.
4. Open a small PR with that move and a brief justification.
5. After merge, the runner picks the file up on the next ECS startup.
6. Watch CloudWatch / RDS metrics for at least 30 minutes after rollout.

After step 3, **add a `PRECHECKS` entry to the helper script** so the next
operator gets the same automation.

## Current contents

- **`0014_drop_team_members.sql`** — drops the legacy `team_members`
  table after LU-DD-3 consolidation. Requires a full sprint of clean
  parallel-write operation (no `[LU-DD-3] mirror ...` warn lines in
  CloudWatch) before applying. See file header for the pre-condition
  query.

- **`0015_payouts_companyid_not_null.sql`** — applies `NOT NULL` to
  `payouts.company_id` (AUD-DB-008). Gated on operator-driven
  cleanup of orphan rows created by the pre-Sprint-1 open `POST
  /payouts` endpoint (closed in PR #23). The migration includes a
  belt-and-braces parity check that `RAISE EXCEPTION`s if any
  NULL-company payout rows remain, so accidental application is safe.
  See file header for the per-orphan resolution guide
  (backfill from `audit_logs.initiatedBy` vs delete).
