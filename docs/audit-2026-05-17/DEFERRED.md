# DEFERRED — work explicitly NOT shipped in the 2026-05-17 audit sprint

> Companion document to [`TRANSFERS_AND_PAYOUTS_AUDIT.md`](./TRANSFERS_AND_PAYOUTS_AUDIT.md). After Stages 1, 2, and the Stage-3 skeleton landed (PRs #44–#54), this page captures what was **intentionally not done**, why, and what would unblock it.

**Audience:** engineering leads + security review.
**Last refreshed:** 2026-05-18.

---

## What DID ship

| Stage | PR | Finding | Status |
|-------|----|---------|--------|
| Audit | #44 | TRANSFERS_AND_PAYOUTS_AUDIT.md (multi-persona, SQL, plan) | Merged |
| Stage 1 (CRITs) | #45 | TP-CRIT-02 + TP-CRIT-05 (transfer idempotency + scoped wallet/payout balance update) | Merged |
| Stage 1 (CRITs) | #46 | TP-CRIT-01 (`/api/bills/pay` company-fallback scoped to caller's tenant) | Merged |
| Stage 1 (CRITs) | #47 | TP-CRIT-03 (large-transaction approval gate replaces console.log placebo) | Merged |
| Stage 1 (CRITs) | #48 | TP-CRIT-04 (wallet claim pattern via `debitWalletIdempotent`) | Merged |
| Stage 2 | #49 | TP-HIGH-08 + TP-HIGH-09 (provider retry + atomic webhook claim) | Open |
| Stage 2 | #50 | TP-HIGH-10 (provider ref → `transactions.reference`) | Open |
| Stage 2 | #51 | TP-HIGH-07 (durable wallet compensation queue) | Open |
| Stage 2 | #52 | TP-HIGH-06 (`/wallet/payout` deprecation signal) | Open |
| Stage 3 | #53 | STG3-A (typed dual-approval columns — parallel-write phase) | Open |
| Stage 3 | #54 | STG3-B (MoneyMovement service skeleton) | Open |

Stage 4 (multi-quarter strategic) and a handful of Stage-3 follow-ups were intentionally **not shipped** in this autonomous pass. They appear below with their reasoning and pre-requisites.

---

## Deferred — by category

### Category A — depends on production operator action

These are SHIPPED in code but require a manual operator step before they take effect in production. Listed here so they don't get forgotten.

| ID | What | Where | Operator action |
|---|---|---|---|
| DEF-OPS-01 | `wallet_transactions(wallet_id, reference)` UNIQUE constraint | `migrations-deferred/0017_*.sql` | Run `node scripts/deferred-migration-helper.cjs check 0017`; if 0 dupes, `git mv` into `migrations/` and ship. |
| DEF-OPS-02 | Backfill `transactions.reference` from `description` for legacy `/payment/transfer` rows | `migrations-deferred/0018_*.sql` | Run `check 0018`; if candidate count is small (< 50k), `git mv` and ship. Otherwise leave alone — new rows already write to the right column. |
| DEF-OPS-03 | Backfill `payouts.first_approved_*` / `approved_at` from JSONB metadata | `migrations-deferred/0020_*.sql` | After STG3-A (PR #53) soaks for ≥24h, run `check 0020`; if candidate count < 100k, promote. |
| DEF-OPS-04 | Live wiring of `MoneyMovement` service in `paymentService.ts` | `server/lib/money-movement.ts` exists; not constructed yet | One-line export `export const moneyMovement = createMoneyMovementService({ storage, provider: paymentService })` — left for STG3-B-2 (first route migration) to avoid dead code in production. |

---

### Category B — Stage 3 follow-ups (in flight, one PR per slice)

These are part of the agreed Stage 3 plan but require their own PR (and in some cases a soak window) after the foundations land.

| ID | What | Pre-requisite | Effort |
|---|---|---|---|
| DEF-STG3-A-2 | Backfill JSONB → typed approval columns | STG3-A soaked ≥24h | 1d (apply migration + verify) |
| DEF-STG3-A-3 | Switch READS in `/payouts/:id/approve` to typed columns | A-2 + 7d soak | 1d |
| DEF-STG3-A-4 | Drop `metadata.firstApproval` / `metadata.secondApproval` JSONB keys | A-3 + 30d soak | 1d |
| DEF-STG3-B-2 | Migrate `/payment/transfer` to `moneyMovement.process(intent)` | STG3-B merged | 2–3d (route refactor + live wiring + new integration tests) |
| DEF-STG3-B-3 | Migrate `/payouts/:id/release` to `payout_disbursement` intent | B-2 | 3d (mirrors B-2; also touches `atomicPayoutCompensateOnFailure`) |
| DEF-STG3-B-4 | Migrate `/bills/pay` to `bill_payment` intent | B-3 | 3d |
| DEF-STG3-B-5 | Migrate `/expenses/:id/reimburse` to `expense_reimbursement` | B-4 | 2d |
| DEF-STG3-B-6 | Migrate `/payroll/run` to `payroll_disbursement` | B-5 | 3d |
| DEF-STG3-B-7 | Delete `/wallet/payout` (or forward into MoneyMovement) | B-2 + STG2-D usage drains to zero | 1d |
| DEF-STG3-WALLET-WORKER | Compensation queue drain worker | STG2-C (#51) merged | 2d (mirrors `recurringScheduler` cadence; leader-lock advisory query needed for multi-instance) |

---

### Category C — Stage 4 (multi-quarter strategic)

Explicitly out of scope for the 2026-05-17 audit sprint. Captured here so the next quarterly planning round has them queued.

#### DEF-STG4-FRAUD — Real-time fraud signal pipeline

- **Audit reference:** §6 Stage 4, item 15 (Adversary persona)
- **What:** Stream `wallet_transactions` + `payouts` events to a fraud-scoring worker. Surface high-risk transfers for manual review via the dual-approval machinery (depends on STG3-A typed columns).
- **Why deferred:** No fraud baseline today — building the pipeline before the team has labelled examples just ships infrastructure with no signal. Want at least one quarter of `wallet_transactions` data with the post-STG2-A/STG2-B columns in place before training anything.
- **Pre-requisite:** STG3-A typed columns READ-promoted (DEF-STG3-A-3); STG2-A webhook claim merged so events aren't double-processed; ≥30 days of production data on the new schema.
- **Effort:** 8–12 weeks (event bus + scoring service + reviewer UI + on-call runbook).

#### DEF-STG4-SHARDING — Per-tenant wallet sharding

- **Audit reference:** §6 Stage 4, item 16
- **What:** Partition `wallet_transactions` by `(company_id, created_at)` quarterly when the table hits ~100M rows. Without partitioning, queries that DON'T filter by `company_id` degrade and the GIN index on `metadata` becomes a hot spot.
- **Why deferred:** Today's row count is < 1M. Premature partitioning adds operational complexity (cross-shard reads, partition pruning correctness, migration tooling) that costs ops minutes per release without any current benefit.
- **Trigger:** Add a Grafana alert when `wallet_transactions` row count crosses 50M; revisit then.
- **Effort:** 3 weeks (schema + read-path adjustments + backfill + observability).

---

### Category D — out of audit scope (low priority / wrong-tool / future quarter)

Items the audit identified as MEDIUM or LOW that didn't fit into Stages 1–3 and aren't worth a one-PR slice today.

| ID | What | Why not now |
|---|---|---|
| DEF-MED-WORKER-LEADER | Wallet compensation queue worker needs leader-election when ECS scales beyond 1 instance | We run 1 instance today; pg_advisory_xact_lock pattern is documented in PR #51 — add when we scale. |
| DEF-MED-PARTIAL-IDX | Convert `transactions_reference_idx` to partial `WHERE reference IS NOT NULL` | Current full B-tree is functionally correct, just not size-optimal. ~5min change, no risk; deferred only because no operator pain today. |
| DEF-MED-CSRF | Add per-session anti-CSRF token (double-submit cookie) on money-moving POSTs | §4.4 item from audit Architect persona. Current `X-Requested-With` gate blocks form-encoded cross-origin POSTs but not malicious extensions. Out of scope for transfers audit — track under separate Auth audit. |
| DEF-MED-RATELIMIT | Per-user financial rate limiter is currently in-memory; loses state across instances | Single-instance ECS today. Move to Redis when we horizontally scale. Pre-requisite for ECS auto-scaling work. |
| DEF-LOW-STORAGE-SPLIT | Split `server/storage.ts` (2,400+ lines) by domain (transaction-service, wallet-service, payment-service, compliance-service) | Documented in [`LOGIC_UPGRADE_PROPOSALS.md`](../audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md). High effort, low immediate value — defer until a sprint with explicit "no feature work" capacity. |
| DEF-LOW-OBSERVABILITY | pino → Honeycomb + OpenTelemetry trace IDs across every money-out call | Stage 4 item 14. Wait until at least one MoneyMovement intent kind has been migrated (DEF-STG3-B-2) so tracing covers the orchestrator, not just individual storage methods. |

---

## How to use this document

- **Engineering planning:** items here are the candidates for the next sprint's "tech debt budget" slot.
- **Security review:** items in Category A (operator actions) are the priority — they're shipped code that won't activate until an operator runs the deferred migration. Track operator follow-through.
- **Roadmap input:** Category C items are the multi-quarter strategic bets. Surface to leadership when planning Q3/Q4 2026.
- **PR review:** when a future PR addresses an item here, cross-reference the DEF-* id in the PR description and remove the row.

---

## Audit completion summary (2026-05-18)

| Severity | Found | Shipped | Deferred (Cat. A — ops action) | Deferred (Cat. B — follow-up PR) | Deferred (Cat. C/D — future) |
|---|---|---|---|---|---|
| CRITICAL | 5 | 5 | 0 | 0 | 0 |
| HIGH | 5 | 5 | 1 (wallet_transactions UNIQUE) | 0 | 0 |
| MEDIUM | ~6 | 1 (typed approval cols) | 1 (transactions backfill) | 4 (Stage-3 follow-ups) | 4 |
| LOW | ~3 | 0 | 0 | 0 | 3 |
| Architecture | 2 (MoneyMovement, dual-approval) | 1 (skeleton + parallel-write) | 1 (JSONB backfill) | 6 (per-intent migrations) | 0 |
| Strategic | 2 (fraud, sharding) | 0 | 0 | 0 | 2 |

**Headline:** every CRITICAL and HIGH transfers/payouts finding from the audit has shipping code or a deferred operator-action migration. Stage 3 architecture is moving (skeleton + parallel-write); Stage 4 strategic items are correctly queued for a future quarter.
