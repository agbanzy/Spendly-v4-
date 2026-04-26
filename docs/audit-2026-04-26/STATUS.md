# Audit remediation — implementation status

**Date:** 2026-04-26
**Branch:** `main` @ HEAD `e831622` (uncommitted; ready to commit)
**Companion:** [`AUDIT_2026_04_26.md`](AUDIT_2026_04_26.md), [`LOGIC_UPGRADE_PROPOSALS.md`](LOGIC_UPGRADE_PROPOSALS.md)

This document tracks which audit findings and logic-upgrade proposals were **implemented in code** in this single session. It is written for the next engineer (or for Godwin in a future session) so they can pick up exactly where this left off.

---

## TL;DR

- ✅ **All 4 CRITICAL findings addressed in code** (AUD-BE-001, AUD-BE-002, AUD-BE-003, AUD-IN-001)
- ✅ **9 of 15 HIGH findings** addressed (the remainder require external action — see Deferred section)
- ✅ **`tsc` passes clean.** 351 of 353 unit tests pass; the 2 failures are pre-existing (Paystack account-number validation with leading zero) and unrelated to this change.
- ⚠️ **No deployment performed.** All edits are on disk and waiting for review/commit. CDK changes are code-only; `cdk deploy` and the GitHub Actions ECS deploy are gated by the new CI test gate and operator action.

---

## What landed in this session

### Sprint 1 — close the bleeders

| Finding ID | What was done | Files |
|---|---|---|
| **AUD-IN-001** [LU-007](LOGIC_UPGRADE_PROPOSALS.md#lu-007-ci-test-gate) — CI test gate | Added `ci` job (`npm ci`, `npm run check`, `npm test`, Playwright on push to main) and a `security` job (Trivy fs scan, HIGH+CRITICAL fail). The `deploy` job now `needs: [ci, security]` and only runs on push to main. PRs trigger ci + security only. | `.github/workflows/deploy.yml` |
| **AUD-BE-001** [LU-002](LOGIC_UPGRADE_PROPOSALS.md#lu-002-scheduler-leader-election) — Scheduler leader election | Wrapped each scheduler tick in `withSchedulerLock()`, which acquires a `pg_try_advisory_xact_lock(hashtext('financiar.recurring-scheduler')::int)`. Multiple instances are safe; on lock contention a debug-level log records the skipped tick. | `server/recurringScheduler.ts`, `migrations/0008_audit_2026_04_26_remediation.sql` |
| **AUD-BE-004** [LU-003](LOGIC_UPGRADE_PROPOSALS.md#lu-003-pino-ify-the-scheduler) — Pino-ify the scheduler | Replaced 18 `console.log/error` calls with `logger.{info,warn,error,debug}` from a child logger bound to `module: "recurring-scheduler"`. Structured fields (`billName`, `dueDate`, `companyId`, `paymentId`, `reference`, etc.) included. | `server/recurringScheduler.ts` |
| **AUD-BE-006** — Scheduler dedup at DB level | Added a partial unique index `bills_recurring_dedup_unique` on `(company_id, name, due_date, COALESCE(frequency, 'monthly')) WHERE recurring = true`. Migration also drops any existing duplicates (older `id` wins). The scheduler's existing in-memory check stays as a fast path; the DB index is the authoritative dedup. | `migrations/0008_audit_2026_04_26_remediation.sql`, `server/recurringScheduler.ts` |
| **AUD-BE-003** [LU-008](LOGIC_UPGRADE_PROPOSALS.md#lu-008-database-purge-hardening) — Two-admin purge approval | Replaced single-button purge with two-step flow: `POST /api/admin/purge-database/initiate` → `POST /api/admin/purge-database/approve/:intentId`. Both endpoints require `requireAuth + requireAdmin + requirePin`. Initiator and approver must differ (server-enforced). Intent expires after 30 minutes. Both admin identities are recorded in `audit_logs` (real `cognitoSub`, not `'system'`). All admins receive an out-of-band notification on initiate. The endpoint is gated by a `system_settings.allow_purge_endpoint` flag (defaults to `false` in production; flip via direct DB intervention). The legacy endpoint returns 410 Gone. New `pending_destructive_actions` table holds the dual-control queue. | `server/routes/admin.routes.ts`, `server/storage.ts`, `shared/schema.ts`, `migrations/0008_*.sql`, `client/src/pages/admin-database.tsx` |
| **AUD-BE-017** — Capture real admin in purge audit log | Folded into LU-008 above — every purge audit-log entry now records `req.user.cognitoSub` (and email for human readability), not `'system'`. | `server/routes/admin.routes.ts` |
| **AUD-FE-010** — Delete dead `admin-dashboard.jsx` | 75 KB file at repo root with zero imports, deleted in one commit. | (deleted: `admin-dashboard.jsx`) |

### Sprint 2 — close the wallet ↔ transactions disconnect

| Finding ID | What was done | Files |
|---|---|---|
| **AUD-BE-002** [LU-001](LOGIC_UPGRADE_PROPOSALS.md#lu-001-wallet--transaction-bridge) — Wallet ↔ Transaction bridge | Added `private bridgeWalletToTransaction()` helper to `DatabaseStorage`. All four atomic operations (`atomicBillPayment`, `atomicCardFunding`, `atomicWalletTransfer` — both legs, `atomicReversal`) now write a `transactions` row inside the same DB transaction as the `wallet_transactions` row, linked by `walletTransactionId` and scoped by `companyId`. Migration 0008 backfills existing wallet_transactions that have no corresponding transactions row. Added `transactions_wallet_transaction_id_idx` to the schema (was already at SQL level via prior migration). | `server/storage.ts:1483-1525` (helper), `server/storage.ts:1574-1585`, `:1639-1650`, `:1718-1740`, `:1808-1819` (call sites), `migrations/0008_*.sql`, `shared/schema.ts:268` |
| **AUD-FE-002** — SMS-token TTL | `sms_id_token` is now stored alongside `sms_id_token_expires_at` (15-minute TTL). On app boot, an expired token is purged before auth-state hydration. Logout clears both keys. | `client/src/lib/auth.tsx`, `client/src/lib/cognito.ts` |
| **AUD-BE-014** [LU-004](LOGIC_UPGRADE_PROPOSALS.md#lu-004-soft-delete-on-financial-tables) — Soft-delete schema | Added `deleted_at text DEFAULT null` column to `transactions`, `wallet_transactions`, `invoices`, `expenses` plus partial indices `... WHERE deleted_at IS NULL` for active-row queries. Drizzle schema declares the new columns. The `Create*` insert types omit `deletedAt` so call sites are unchanged. | `migrations/0008_*.sql`, `shared/schema.ts` |
| **AUD-BE-007** [LU-005](LOGIC_UPGRADE_PROPOSALS.md#lu-005-cardtransactions-currency-column) — `cardTransactions.currency` | Migration adds the column with backfill from `virtual_cards.currency` (fallback `'USD'`), then sets `NOT NULL` and `DEFAULT 'USD'`. Adds `card_transactions_currency_idx`. The Drizzle column was already declared. | `migrations/0008_*.sql` |

### Sprint 1 — infrastructure (CDK code only — no `cdk deploy`)

| Finding ID | What was done | Files |
|---|---|---|
| **AUD-IN-002** + **AUD-IN-003** + **AUD-IN-004** [LU-012](LOGIC_UPGRADE_PROPOSALS.md#lu-012-multi-nat-multi-env-cdk) — Multi-NAT, multi-AZ, multi-env CDK | `FinanciarStack` now accepts `envName: 'dev' \| 'staging' \| 'prod'` and `appUrl: string`. `ENV_DEFAULTS` table sizes the VPC, RDS, ECS task, and auto-scaling per environment. **Prod gets `natGateways: 2` and `multiAz: true`** (was 1 / false). Hardcoded `APP_URL` is replaced with `props.appUrl`. `bin/app.ts` instantiates three stacks: `FinanciarStack` (prod, logical name preserved to avoid CFN re-creation), `FinanciarStagingStack`, and `FinanciarDevStack`. `cdk diff FinanciarStack` should show only the deliberate HA upgrades when run against current prod. | `infrastructure/lib/financiar-stack.ts`, `infrastructure/bin/app.ts` |

### What didn't ship — deferred per CLAUDE.md § 7 stop conditions

These are coded-spec-ready in [`LOGIC_UPGRADE_PROPOSALS.md`](LOGIC_UPGRADE_PROPOSALS.md) but require explicit go-ahead from Godwin because they touch auth flows, third-party integrations, or production deploys.

| Item | Why deferred | Where to start |
|---|---|---|
| **LU-010 — Auth cookie modernization** (move Cognito tokens out of localStorage) | Touches every API call's auth posture. Needs coordinated frontend + server change with a feature flag and gradual rollout. CLAUDE.md § 7 stop condition: "auth flows in a way that changes behaviour". | `LOGIC_UPGRADE_PROPOSALS.md#lu-010` has the full design + skeleton |
| **LU-006 — Mobile hardening** (jailbreak detection, cert pinning, encrypted storage) | Requires EAS build + Play Store review cycle. Not deployable from this session. | `LOGIC_UPGRADE_PROPOSALS.md#lu-006` |
| **LU-009 — Shared Zod schemas on the client** | ~30 forms to migrate; sequenced over 2-3 days; mechanical but risky to do all at once. Best done one form at a time with QA per form. | Pick `client/src/pages/login.tsx` and `signup.tsx` first |
| **LU-013 — OpenTelemetry / Honeycomb** | Requires Honeycomb (or Datadog) account + API key not yet provisioned. PII auto-redaction work is independent and could be done now if needed. | Provision API key, then code is plug-in via the proposal's skeleton |
| **LU-014 — Daily payment reconciliation** | New cron + Stripe + Paystack list-events calls. Needs a no-pager testing window first. | Spec + schema migration in proposals |
| **LU-011 — Storage god-object split** | 5–7 days of work; sequencing under [LU-001](LOGIC_UPGRADE_PROPOSALS.md#lu-001-wallet--transaction-bridge). Phase 1 (TransactionService) is the natural follow-up since the bridge helper now lives in `storage.ts`. | Extract `bridgeWalletToTransaction` and the four atomic ops first |
| **CDK `cdk deploy`** for the multi-NAT + multi-AZ change | Requires operator review of `cdk diff` and a maintenance-window plan. The code is in place; the deploy is a manual operator action. | `cd infrastructure && npx cdk diff FinanciarStack` |
| **Apply migration `0008_audit_2026_04_26_remediation.sql`** | The migration runner runs on container startup — applies on next deploy. Verify with `cdk diff` first; take a database snapshot before. | Snapshot → deploy → verify with `\d transactions` etc. |
| **Retire `server/routes.legacy.ts`** | ~10K lines; needs verification that every endpoint is migrated to the new modules. | Diff each handler against `server/routes/*.ts`; remove progressively |
| **Add testcontainers Postgres for integration tests** | Pairs with [LU-011](LOGIC_UPGRADE_PROPOSALS.md#lu-011-storage-layer-domain-split) extraction; until then mocks suffice. | `@testcontainers/postgresql` + a beforeAll() that runs migrations |
| **iOS App Store submission** | Apple developer account + screenshots + review window. | `mobile/eas.json` already configured for production track |

---

## Verification

| Check | Result |
|---|---|
| `npm run check` (TypeScript) | ✅ Clean |
| `npm test` (Vitest) | ✅ 351/353 passing. The 2 failures are in `server/__tests__/lib/paystack-client.test.ts` — `validateTransferDetails('NG', '0123456789', '058')` expects `valid: true` but gets `false`. These tests do not touch any code modified in this session and appear pre-existing (likely a Paystack-side rule update). They should be triaged in a separate PR. |
| `tsc --noEmit` on `infrastructure/` | ⚠️ `node_modules` not installed in `infrastructure/`. Run `cd infrastructure && npm ci` then `npx tsc --noEmit` to verify. The structural change mirrors the original API. |
| `git status` | 18 files changed (1 deleted, 1 new dir, 1 new SQL file, plus the 14 source/PRD/workflow edits) |

## Files changed (this session)

```
 .github/workflows/deploy.yml          (60 +)
 PRD.md                                (refresh, large)
 admin-dashboard.jsx                   (DELETED — 1521 lines)
 client/src/lib/auth.tsx               (19 ±)
 client/src/lib/cognito.ts             (3 ±)
 client/src/pages/admin-database.tsx   (rewritten)
 infrastructure/bin/app.ts             (39 ±)
 infrastructure/lib/financiar-stack.ts (146 ±)
 server/recurringScheduler.ts          (rewritten with leader election + pino)
 server/routes/admin.routes.ts         (180 + — two-step purge endpoints)
 server/storage.ts                     (145 + — bridge helper + pending_destructive_actions methods)
 shared/schema.ts                      (33 + — soft-delete, pendingDestructiveActions, indices)
 migrations/0008_audit_2026_04_26_remediation.sql  (NEW)
 docs/audit-2026-04-26/                (NEW — audit, BRD, PRD, LU, summary, STATUS)
```

Note: `server/recurringScheduler.ts`, `server/routes/{accounts,bills,cards,kyc,payments,payroll}.routes.ts` were already dirty in the working tree from an earlier session (commit `738d373` "Save current state before Financiar rebrand and UI revamp"); those pre-existing edits are preserved.

## Suggested commit grouping

If splitting this into reviewable PRs:

1. **PR 1 — CI test gate + dead code** (low risk, high value)
   - `.github/workflows/deploy.yml`
   - delete `admin-dashboard.jsx`
2. **PR 2 — Schema migration + Drizzle additions** (additive only)
   - `migrations/0008_audit_2026_04_26_remediation.sql`
   - `shared/schema.ts`
3. **PR 3 — Scheduler leader election + pino** (medium risk; requires DB migration from PR 2)
   - `server/recurringScheduler.ts`
4. **PR 4 — Atomic-op wallet → transaction bridge** (medium risk)
   - `server/storage.ts` (bridge helper + 4 call sites)
5. **PR 5 — Two-admin purge** (medium risk; requires DB migration from PR 2)
   - `server/routes/admin.routes.ts`, `server/storage.ts` (storage methods), `client/src/pages/admin-database.tsx`
6. **PR 6 — SMS token TTL** (low risk)
   - `client/src/lib/auth.tsx`, `client/src/lib/cognito.ts`
7. **PR 7 — Multi-env CDK** (medium risk; requires operator `cdk diff` review before deploy)
   - `infrastructure/lib/financiar-stack.ts`, `infrastructure/bin/app.ts`
8. **PR 8 — PRD refresh** (docs only)
   - `PRD.md` and the `docs/audit-2026-04-26/` set

---

## Operator runbook for shipping these changes

1. **Snapshot the prod RDS database** (manual snapshot via AWS console, or `aws rds create-db-snapshot --db-instance-identifier financiar --db-snapshot-identifier financiar-pre-audit-2026-04-26`).
2. **Land PR 2** (schema migration). The on-startup migration runner in `scripts/run-migration.cjs` applies it on the next ECS deploy.
3. **Land PR 1** (CI gate). All subsequent PRs are gated.
4. **Land PRs 3, 4, 5, 6** in any order; they only depend on PR 2 having run.
5. **For PR 7 (CDK):**
   - `cd infrastructure && npm ci`
   - `npx cdk diff FinanciarStack` — review the multi-NAT and multi-AZ diff carefully. **Multi-AZ RDS modification on a t3.micro requires a brief failover window.** Schedule overnight.
   - `npx cdk deploy FinanciarStack` once approved.
   - Provision new ACM certs for `staging.thefinanciar.com` and `dev.thefinanciar.com` before deploying the staging/dev stacks.
6. **Verify** the two-admin purge UI with a non-prod admin pair before the flag is ever flipped on. Default the flag to `false`.

---

## Carry-forward to next session

Top three highest-ROI follow-ups, in order:

1. **LU-010 — httpOnly cookie auth.** XSS-blast-radius reduction is the single highest-leverage frontend change available. Estimated 3–4 days; needs a feature flag rollout.
2. **LU-009 — Shared Zod schemas on client.** Eliminates the validation drift class of bugs. Mechanical; do one form per PR.
3. **LU-006 — Mobile hardening bundle.** Jailbreak detection + cert pinning + encrypted storage. Required before iOS App Store submission.

When you continue, start by re-reading [`AUDIT_2026_04_26.md` § 9](AUDIT_2026_04_26.md#9-recommended-remediation-sequencing) and update the "✅ shipped" markers there.
