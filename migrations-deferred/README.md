# Deferred migrations

SQL files in this directory are **NOT** picked up by the migration runner
(`scripts/run-migration.cjs` only globs `migrations/*.sql`). They live
here on purpose: the change is intentionally gated on an operator action
because it is destructive, one-way, or dependent on a soak window in
production.

## How to apply

1. Read the file's header comment carefully — it lists pre-conditions and
   verification queries.
2. Run the verification queries against production (or a fresh snapshot)
   and confirm all parity checks pass.
3. Move the file from `migrations-deferred/` to `migrations/`.
4. Open a small PR with that move and a brief justification.
5. After merge, the runner picks the file up on the next ECS startup.
6. Watch CloudWatch / RDS metrics for at least 30 minutes after rollout.

## Current contents

- **`0014_drop_team_members.sql`** — drops the legacy `team_members`
  table after LU-DD-3 consolidation. Requires a full sprint of clean
  parallel-write operation (no `[LU-DD-3] mirror ...` warn lines in
  CloudWatch) before applying. See file header for the pre-condition
  query.
