# Spendly v4 (Financiar) — Executive Summary

**Date:** 2026-04-26 | **Branch:** `main` @ `e831622` | **Auditor:** Claude (Opus 4.7) under Godwin Agbane

> **One-page roll-up.** Full detail in:
> [`AUDIT_2026_04_26.md`](AUDIT_2026_04_26.md) · [`BRD_2026_04_26.md`](BRD_2026_04_26.md) · [`LOGIC_UPGRADE_PROPOSALS.md`](LOGIC_UPGRADE_PROPOSALS.md) · [`../../PRD.md`](../../PRD.md)

---

## Health snapshot

| Surface | Status | Note |
|---|---|---|
| Backend | 🟢 Sound | 26 route modules, atomic ops correct, idempotency in place |
| Frontend | 🟡 Solid with hardening due | localStorage tokens + manual validation are the gaps |
| Mobile | 🟡 Working with security gaps | 22 screens, Cognito + biometric — no jailbreak detection / cert pinning yet |
| Infrastructure | 🟡 Single-point-of-failure today | Single NAT, single-AZ RDS, one CDK stack for all envs |
| Security | 🟢 Hardened post-`0a93cec` | Triple-gate auth, signature-verified webhooks, CSP, idempotent reversals |
| Tests | 🟡 353 unit tests; mocks-heavy | No CI test gate; no testcontainers integration tests |
| Docs | 🟢 Strong | DEPLOYMENT.md, OpenAPI spec, this audit set |
| CI/CD | 🔴 No test gate | Any commit on `main` ships to production |

---

## Reconciliation against 2026-03-03 audit

**7 of 11 CRITICAL findings verified closed; 1 partially closed; 3 require deeper verification or remain open.**

The codebase has moved decisively forward since March: `transactions.companyId` is wired with FK and indexes, `atomicReversal` has explicit idempotency at `storage.ts:1722-1725`, `atomicBillPayment` populates all 7 tracking fields atomically at `storage.ts:1530-1538`, Stripe webhooks are fully implemented (1,205 lines), CSP is enabled in production. Several findings carried over from earlier reports turned out to be **inaccurate** when read against current source — the audit's §2.1 lists each correction with file:line evidence.

---

## Top 5 risks (CRITICAL/HIGH)

| # | Finding | Where | Why it matters |
|---|---|---|---|
| 1 | **Recurring scheduler runs on every ECS instance — no leader election** | `server/recurringScheduler.ts:275-284` | Multi-instance scaling creates duplicate bills / payroll / payouts. Blocks horizontal scale today. ([AUD-BE-001](AUDIT_2026_04_26.md#7-risk-register)) |
| 2 | **Wallet ledger ↔ Transactions ledger disconnected** | `server/storage.ts:1484-1773` + `client/src/pages/transactions.tsx` | Bill payments, transfers, card fundings, reversals do not appear in user transaction history. ([AUD-BE-002](AUDIT_2026_04_26.md#7-risk-register)) |
| 3 | **One-click full database purge endpoint** | `server/routes/admin.routes.ts:223-250` | A single phished admin password = total customer data loss. Audit log records 'system' not the actual admin. ([AUD-BE-003](AUDIT_2026_04_26.md#7-risk-register)) |
| 4 | **No CI test gate** | `.github/workflows/deploy.yml` | Any broken commit on `main` ships. Tests are not blocking. ([AUD-IN-001](AUDIT_2026_04_26.md#7-risk-register)) |
| 5 | **Single NAT + Single-AZ RDS + one CDK stack** | `infrastructure/lib/financiar-stack.ts:25, 70, 18` | Three single points of failure. SLA cannot exceed AWS regional AZ uptime. ([AUD-IN-002](AUDIT_2026_04_26.md#7-risk-register), [-003](AUDIT_2026_04_26.md#7-risk-register), [-004](AUDIT_2026_04_26.md#7-risk-register)) |

Plus 10 HIGH findings — Cognito tokens in localStorage, manual form validation, mobile lacking jailbreak/cert-pinning/encrypted storage, scheduler using `console.log`, mock-heavy tests, dead 75 KB `admin-dashboard.jsx` at repo root, etc. Full list in [`AUDIT_2026_04_26.md` § 7](AUDIT_2026_04_26.md#7-risk-register).

---

## Top 5 logic upgrades

These are the highest-ROI items in [`LOGIC_UPGRADE_PROPOSALS.md`](LOGIC_UPGRADE_PROPOSALS.md). Each proposal includes problem statement, current code citation, design, migration SQL, TypeScript skeletons, test strategy, rollout plan.

| # | Upgrade | Effort | Impact |
|---|---|---|---|
| 1 | **[LU-007](LOGIC_UPGRADE_PROPOSALS.md#lu-007-ci-test-gate)** — Add `npm ci`/`check`/`test`/Playwright as gating jobs in `deploy.yml` | 0.5 day | Stops broken commits from shipping. Highest ROI in the document. |
| 2 | **[LU-002](LOGIC_UPGRADE_PROPOSALS.md#lu-002-scheduler-leader-election)** — Wrap scheduler ticks in `pg_try_advisory_xact_lock` | 1 day | Unblocks horizontal scale. Zero cost on a single-instance deployment. |
| 3 | **[LU-001](LOGIC_UPGRADE_PROPOSALS.md#lu-001-wallet--transaction-bridge)** — Inside each atomic op, also write a `transactions` row | 2 days | User transaction history finally becomes complete. |
| 4 | **[LU-008](LOGIC_UPGRADE_PROPOSALS.md#lu-008-database-purge-hardening)** — Two-admin out-of-band approval for the purge endpoint | 1 day | Eliminates total-data-loss risk from a single phished admin. |
| 5 | **[LU-012](LOGIC_UPGRADE_PROPOSALS.md#lu-012-multi-nat-multi-env-cdk)** — Multi-NAT, multi-AZ RDS, three-environment CDK | 2-3 days | Realistic 99.9% availability target. dev/staging/prod separation. |

**Total Sprint-1 work to retire all 5: ~7 engineer-days.** Closing every CRITICAL/HIGH/MEDIUM in the audit is **~50 engineer-days = 2.5 engineer-months**.

---

## Recommended sequencing

| Window | Engineer-days | Outcomes |
|---|---|---|
| **Sprint 1 (week 1-2)** | ~5 | CI test gate, scheduler safety, purge hardening, multi-NAT, multi-AZ — platform stops bleeding, can scale to 2+ ECS instances safely |
| **Sprint 2 (week 3-4)** | ~12 | Wallet→Transactions bridge, auth cookies, shared Zod, multi-env CDK — wallet history reconciled, auth modernized |
| **Sprint 3 (week 5-6)** | ~8 | Mobile hardening, OpenTelemetry/Honeycomb, biometric re-prompt, crash reporting — mobile is fintech-grade, production has APM |
| **Quarter** | ~25 | Storage god-object split, testcontainers, retire legacy routes, soft-delete, payment reconciliation |

**Overall:** if Godwin starts immediately and ships these in order, the CRITICAL/HIGH gap is closed within 6 weeks. The remaining MEDIUM/LOW work fills the rest of Q2-Q3 2026.

---

## Open BRD questions

Before [`BRD_2026_04_26.md`](BRD_2026_04_26.md) is ready to share with investors / leadership / regulators, the following need Godwin's input (full list at [BRD § Part E](BRD_2026_04_26.md#part-e--open-business-questions-user-input-needed)):

- **Traction:** MAU, ARR, GMV L30D, NRR, churn, CAC
- **Pricing:** confirm or revise the four-tier proposal (Free / Starter / Pro / Enterprise)
- **Market sizing:** TAM stance (global $25-35B vs Africa-first scoped) and SOM customer-count targets
- **Funding:** round size, valuation, lead investor, use-of-funds breakdown
- **Stakeholders:** legal entity holding Stripe + Paystack accounts, contractors, board composition
- **Compliance:** licences held, SOC 2 audit firm preference, KYC/AML vendor preference

42 specific items consolidated in BRD Part E.

---

## Bottom line

> Spendly v4 is **shippable today** for the current scale (early customers, single-region, single-instance ECS). It is **not** ready for the multi-region, multi-instance, regulated-customer footprint described in the PRD.
>
> The gap is **clearly bounded** — 4 CRITICAL + 15 HIGH findings with exact file:line citations and implementation-ready proposals. **Sprint 1's 5 engineer-days** retires the 4 CRITICALs and the most consequential HIGHs. **Sprints 2-3 (3 weeks of work)** closes the rest of the high-severity bar.
>
> Spending 2.5 engineer-months between now and the end of Q2 2026 takes Financiar from "fintech that works" to "fintech that scales and audits cleanly". The same period happens to be the right window to resolve the BRD's open business questions and stand up SOC 2 Type 1 — both of which gate Enterprise-tier sales.

---

**Document tree:**

- 📋 `EXECUTIVE_SUMMARY.md` ← *you are here*
- 🔍 [`AUDIT_2026_04_26.md`](AUDIT_2026_04_26.md) — 48 findings, full reconciliation, severity matrix, sequencing
- 💼 [`BRD_2026_04_26.md`](BRD_2026_04_26.md) — hybrid investor / leadership / regulatory document
- 🛠️ [`LOGIC_UPGRADE_PROPOSALS.md`](LOGIC_UPGRADE_PROPOSALS.md) — 14 implementation-ready upgrade specs with SQL + TS skeletons
- 📘 [`../../PRD.md`](../../PRD.md) — refreshed product spec (overwrote 2026-03-14 v1.0)
- 🗃️ [`../../AUDIT_REPORT_2026_03_03.md`](../../AUDIT_REPORT_2026_03_03.md) — historical baseline, preserved
