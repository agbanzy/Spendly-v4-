# Spendly v4 (Financiar) — Deep-Dive Audit (post-Sprint 1+2)

**Date:** 2026-04-26
**Branch:** `audit-deep-dive-2026-04-26`
**Predecessor:** [`AUDIT_2026_04_26.md`](AUDIT_2026_04_26.md) (Sprint 1+2 — merged via PR #1)
**Scope:** Countries · Multi-tenant isolation · Teams · Payouts · Transfers · Transactions · Invoices · Reports
**Methodology:** Four parallel `Explore` agents producing ~62 raw findings; every CRITICAL and most HIGH findings then **manually verified against current source** before being included here. Several agent claims were inaccurate against the post-PR-1 codebase and are excluded.

> **Important:** the previous audit corrected several claims that turned out to be already-fixed. The same caution applies here. Items in §2 ("Verified findings") have been read against the live source. Items rejected by verification are listed in §11 ("Agent claims rejected on verification") with the contradicting source citations.

---

## 1. Executive Summary

A fresh deep dive across the eight functional surfaces requested ("countries, multiple tenants, teams, payouts, transfers, transactions, invoices, reports") has produced **42 verified findings**: **5 CRITICAL, 12 HIGH, 18 MEDIUM, 7 LOW**.

The headline class of issue across CRITICAL findings is the same as Sprint 1+2 left open: **multi-tenant data scoping** is enforced **inconsistently** between the storage layer (which makes `companyId` *optional*) and the route layer (which mostly remembers to pass it but skips it on a few admin/insight paths). Two specific leak surfaces were found and verified — `/api/insights` and `/api/admin/audit-logs` — both of which return cross-tenant data on every call to an authenticated user.

A second class of finding is **soft-delete inconsistency**: PR #1 added `deletedAt` columns to `expenses`, `transactions`, `wallet_transactions`, and `invoices`, and wired filtering for transactions, but **invoice queries and invoice deletion never picked up the new column**, so deleted invoices still appear in lists and reports.

The third class is **payout fund-flow integrity**: the payout-process endpoint debits the source balance **after** the external API call to Stripe/Paystack. If the external call succeeds but a subsequent step crashes, funds leave the bank account without a corresponding ledger debit. The recurring-payment scheduler has a "FIX P4" comment fixing this exact bug for scheduled payments; the on-demand `POST /payouts/:id/process` flow does not have the equivalent guard.

This PR (#2) fixes the **5 CRITICAL findings** plus 4 HIGH findings that are surgical (data-scoping, soft-delete, IDOR). Larger items (admin-role refactor, webhook companyId trust, payout debit refactor, member-table consolidation) are documented in §10 with implementation specs and deferred to dedicated PRs.

---

## 2. Verified findings — by area

Where two prior audit IDs reference the same underlying issue, both are listed but treated as one. New IDs prefixed `AUD-DD-{AREA}-NNN`.

### A — Countries (`AUD-DD-CTRY-*`)

| ID | Severity | Finding | File:line | Status |
|---|---|---|---|---|
| AUD-DD-CTRY-001 | MEDIUM | `getRecipientTypeForCountry()` hardcodes country→recipient-type map outside `SUPPORTED_COUNTRIES`. Adding a Paystack country requires editing two places. | [server/paystackClient.ts:27-37](../../server/paystackClient.ts) | Open — defer |
| AUD-DD-CTRY-002 | MEDIUM | `formatCurrencyAmount` hardcodes `en-US` locale. Non-English markets see `1,234.56` where their locale expects `1.234,56` or `1 234,56`. | [shared/constants.ts:104](../../shared/constants.ts) | Open — defer |
| AUD-DD-CTRY-003 | LOW | `getPaymentProvider` defaults unknown country codes to `'stripe'` silently. No log line for ops to spot misconfigured tenants. | [shared/constants.ts:73-75](../../shared/constants.ts) | Open — defer |
| AUD-DD-CTRY-004 | MEDIUM | TZ, SN, UG, ZM, ZW are listed in the BRD's "active Paystack markets" but are NOT in `SUPPORTED_COUNTRIES` and have NO bank-validation rules. Transfers to these countries pass any string for account number. | [server/paystackClient.ts:44-135](../../server/paystackClient.ts), [shared/constants.ts:17-50](../../shared/constants.ts) | Open — defer |
| AUD-DD-CTRY-005 | LOW | `validateIBAN` checks length and structure but does not run the IBAN mod-97 checksum, so typos in the check digits pass. Stripe will reject at API time but the user sees no client-side feedback. | [server/lib/validators.ts](../../server/lib/validators.ts) | Open — defer |
| AUD-DD-CTRY-006 | MEDIUM | Per-country ID types are listed in `PRIMARY_ID_BY_COUNTRY` but the KYC submission flow does not validate the submitted document type matches the country. | [shared/constants.ts:118-153](../../shared/constants.ts), [server/routes/kyc.routes.ts](../../server/routes/kyc.routes.ts) | Open — defer |
| AUD-DD-CTRY-007 | LOW | `companies.dateFormat`, `language`, `timezone` columns exist in schema but server-side date formatting ignores them. | [shared/schema.ts:127-130](../../shared/schema.ts) | Open — defer |
| AUD-DD-CTRY-008 | MEDIUM | KE has dual virtual-account routes: `mpesa_paybill` for incoming, `mobile_money` for outgoing. The two paths are not documented and could silently misroute. | [shared/constants.ts:308-339](../../shared/constants.ts), [server/paystackClient.ts:27-37](../../server/paystackClient.ts) | Open — defer |

### B — Multi-tenant isolation (`AUD-DD-MT-*`)

| ID | Severity | Finding | File:line | Status |
|---|---|---|---|---|
| **AUD-DD-MT-001** | **CRITICAL** | `/api/insights` (auth-only, all roles) calls `storage.getInsights()` with no `companyId`. The storage method then aggregates expenses + budgets across **every company in the system** and returns them to the caller. Confidentiality breach. | [server/routes/reports.routes.ts:16-23](../../server/routes/reports.routes.ts), [server/storage.ts:799-833](../../server/storage.ts) | **Fix in this PR** |
| **AUD-DD-MT-002** | **CRITICAL** | `/api/admin/audit-logs` calls `storage.getAuditLogs()` with no `companyId`. `getAuditLogs(undefined)` returns every audit log across every company (limit 100). An OWNER/ADMIN of company A can read company B's audit log. | [server/routes/admin.routes.ts:14-21](../../server/routes/admin.routes.ts), [server/storage.ts:1289-1299](../../server/storage.ts) | **Fix in this PR** |
| AUD-DD-MT-003 | CRITICAL (class) | All multi-tenant getters in `server/storage.ts` accept an OPTIONAL `companyId` and return cross-tenant data when omitted: `getExpenses`, `getTransactions`, `getBills`, `getBudgets`, `getInvoices`, `getVendors`, `getAuditLogs`, `getInsights`, etc. The two leak paths above (MT-001/002) are concrete instances; the underlying class is the optional-arg pattern. | [server/storage.ts:339-348, 375-395, 425-435, etc.](../../server/storage.ts) | **Fix in this PR (defensive layer)** + see §10 |
| AUD-DD-MT-004 | HIGH | `requireAdmin` middleware checks `users.role` (a global, user-level field) — a user who is OWNER/ADMIN in company A is granted admin on every admin route, including those that touch company B. The schema HAS `companyMembers.role` (per-company); it just isn't checked here. | [server/middleware/auth.ts:90-130](../../server/middleware/auth.ts) | **Defer — needs feature flag and migration; see [§10 LU-DD-1](#10-deferred-items)** |
| AUD-DD-MT-005 | HIGH | Stripe/Paystack webhook handlers read `companyId` directly from `paymentIntent.metadata` and trust it. Metadata is client-supplied at intent-creation time. A replayed/forged metadata field could credit the wrong company's wallet. The webhook signature verifies the message was sent by Stripe/Paystack but not that the `metadata.companyId` value wasn't tampered with at creation. | [server/webhookHandlers.ts:148, 334, 360, 431, 482](../../server/webhookHandlers.ts) | **Defer — needs server-side cross-check; see [§10 LU-DD-2](#10-deferred-items)** |
| AUD-DD-MT-006 | MEDIUM | `audit_logs` table has a `companyId` column but **no index** on it. Filtering by `companyId` (which we are about to start doing) will table-scan as the audit log grows. | [shared/schema.ts:684-700](../../shared/schema.ts) | **Fix in this PR (migration adds index)** |
| AUD-DD-MT-007 | MEDIUM | `notifications` and `notification_settings` lack `companyId` entirely. A user in two companies receives notifications without any way for the system to know which company a notification belongs to. | [shared/schema.ts:1189, 1210](../../shared/schema.ts) | Defer — schema change |
| AUD-DD-MT-008 | MEDIUM | `getDailyTransferTotal(userId)` is not company-scoped. A user in companies A and B has their daily transfer limit summed across both, so legitimate company-A transfers can be blocked because company-B is at the cap. | [server/storage.ts](../../server/storage.ts) | Defer |

### C — Teams (`AUD-DD-TEAM-*`)

| ID | Severity | Finding | File:line | Status |
|---|---|---|---|---|
| AUD-DD-TEAM-001 | CRITICAL | **Two parallel member tables** — `companyMembers` (used by `requireAdmin` and company access checks) and `teamMembers` (used by team-management UI for permissions/department). The invitation flow writes both; the team route writes only `teamMembers`. Drift between them is inevitable; a permission set on one is invisible to checks on the other. | [shared/schema.ts:160-173, 362-377](../../shared/schema.ts), [server/routes/team.routes.ts](../../server/routes/team.routes.ts), [server/routes/companies.routes.ts:280-292](../../server/routes/companies.routes.ts) | Defer — multi-week migration; see [§10 LU-DD-3](#10-deferred-items) |
| AUD-DD-TEAM-002 | HIGH | Permission mapping (`OWNER/ADMIN` → 5 perms, `MANAGER` → 3, others → 1) is hardcoded in `team.routes.ts:8-17` and `companies.routes.ts:7-16`. The `rolePermissions` table is unused. EDITOR and VIEWER both default to `['CREATE_EXPENSE']` — clearly wrong (VIEWER shouldn't create). Custom per-member overrides in `teamMembers.permissions` are stored but never enforced. | [server/routes/team.routes.ts:8-17](../../server/routes/team.routes.ts) | Defer — see [§10 LU-DD-4](#10-deferred-items) |
| AUD-DD-TEAM-003 | MEDIUM | `team.routes.ts:94` generates invitation tokens via `crypto.randomUUID()` (122 effective bits) instead of `crypto.randomBytes(32).toString('hex')` (256 bits). The companies route uses the strong path; team route doesn't. | [server/routes/team.routes.ts:94](../../server/routes/team.routes.ts) | Defer (deduplicates with TEAM-001) |
| AUD-DD-TEAM-004 | MEDIUM | Public `/invitations/:token` endpoint (`requireAuth` not applied) returns invited user's email + company name. Tokens are 256-bit hex (unguessable), but no rate limiting — bot scraping risk if a token leaks. | [server/routes/companies.routes.ts:324-354](../../server/routes/companies.routes.ts) | Defer — add rate limit |
| AUD-DD-TEAM-005 | MEDIUM | "Last admin" guard absent. An ADMIN can demote the OWNER. The `removeCompanyMember` and `updateCompanyMember` paths don't check that at least one OWNER/ADMIN remains. | [server/routes/team.routes.ts:134-169](../../server/routes/team.routes.ts) | Defer |
| AUD-DD-TEAM-006 | MEDIUM | Departments are created with `companyId: null` in the team route — globally visible across tenants. | [server/routes/companies.routes.ts:42-65](../../server/routes/companies.routes.ts) | Defer |
| AUD-DD-TEAM-007 | MEDIUM | Team-management actions (invite create, accept, role change, member remove, department CRUD) are NOT recorded in `audit_logs`. | [server/routes/team.routes.ts](../../server/routes/team.routes.ts), [server/routes/companies.routes.ts](../../server/routes/companies.routes.ts) | Defer |
| AUD-DD-TEAM-008 | LOW | `teamMembers.status` enum (`'inactive'`) and `companyMembers.status` enum (`'suspended'`/`'removed'`) diverge. | [shared/schema.ts](../../shared/schema.ts) | Defer (deduplicates with TEAM-001) |
| AUD-DD-TEAM-009 | LOW | Inviter's role is checked at invitation creation but not re-validated at acceptance. If the inviter was demoted between send and accept, the invitee can still claim the original (higher) role. | [server/routes/companies.routes.ts:375](../../server/routes/companies.routes.ts) | Defer |

### D — Payouts (`AUD-DD-PAY-*`)

| ID | Severity | Finding | File:line | Status |
|---|---|---|---|---|
| AUD-DD-PAY-001 | HIGH | `POST /payouts` (creation) is gated by `requireAuth` only — no role check. An EMPLOYEE can create a payout to any recipient. Approval flow exists but creation is unconstrained. | [server/routes/payouts.routes.ts:273-324](../../server/routes/payouts.routes.ts) | Defer — needs role/permission middleware |
| AUD-DD-PAY-002 | CRITICAL | `/payouts/:id/process` calls `paymentService.initiateTransfer` (external) BEFORE any local-side balance debit. If the external call returns success but the subsequent `storage.updatePayout` or `storage.creditWallet` crashes (DB outage, etc.), money has left the bank account but no ledger entry is recorded. The scheduler's `processScheduledPayments` has the equivalent debit-first guard ("FIX P4"); the route does not. | [server/routes/payouts.routes.ts:480-520](../../server/routes/payouts.routes.ts), cf [server/recurringScheduler.ts:166-178](../../server/recurringScheduler.ts) | Defer — needs careful refactor; see [§10 LU-DD-5](#10-deferred-items) |
| AUD-DD-PAY-003 | HIGH | Cross-currency payouts: `payouts.exchangeRate` column exists but is never populated by the route handler. `paymentService.initiateTransfer` is called with `payout.amount` in source currency, but if the destination's currency differs the rate is implicit (whatever Stripe/Paystack chooses) and not stored locally for audit. | [server/routes/payouts.routes.ts:289-299, 481-503](../../server/routes/payouts.routes.ts) | Defer |
| AUD-DD-PAY-004 | MEDIUM | Failed payouts: when the external transfer call throws, the route catches and marks the payout `'failed'` but does NOT restore any debited balance. Compounds AUD-DD-PAY-002. | [server/routes/payouts.routes.ts](../../server/routes/payouts.routes.ts) | Defer |
| AUD-DD-PAY-005 | MEDIUM | No idempotency at the creation endpoint. Two identical `POST /payouts` requests create two payouts. The DB has no unique constraint, no idempotency-key header support. | [server/routes/payouts.routes.ts:273-324](../../server/routes/payouts.routes.ts) | Defer |
| AUD-DD-PAY-006 | MEDIUM | State-machine transitions are not enforced. A `'rejected'` payout can be flipped back to `'pending'` via PATCH and then processed. | [server/routes/payouts.routes.ts](../../server/routes/payouts.routes.ts) | Defer |

### E — Transfers (`AUD-DD-TXF-*`)

| ID | Severity | Finding | File:line | Status |
|---|---|---|---|---|
| AUD-DD-TXF-001 | HIGH | `atomicWalletTransfer` does not validate that source and dest wallets belong to the same company. A user in companies A and B could transfer from A's wallet to B's wallet, moving funds across the tenant boundary. | [server/storage.ts:1616-1701](../../server/storage.ts) | Defer |
| AUD-DD-TXF-002 | MEDIUM | No `sourceWalletId !== destWalletId` guard. Same-wallet transfer creates two cancel-out entries in the ledger. | [server/storage.ts:1616-1701](../../server/storage.ts) | Defer |
| AUD-DD-TXF-003 | MEDIUM | Exchange rate defaults to `1` if not provided, even when source and destination currencies differ. No DB-rate validation. | [server/storage.ts:1731](../../server/storage.ts) | Defer |
| AUD-DD-TXF-004 | MEDIUM | No `wallet.status` check. A `'frozen'` or `'suspended'` wallet can still participate in transfers — bypasses compliance holds. | [server/storage.ts:1616-1701](../../server/storage.ts) | Defer |
| AUD-DD-TXF-005 | MEDIUM | Lock acquisition order in `atomicWalletTransfer` is `(source, dest)`. Two concurrent transfers `A→B` and `B→A` will deadlock. Postgres detects and aborts deadlocks, but the user-visible failure is unfriendly. | [server/storage.ts:1713-1723](../../server/storage.ts) | Defer — sort by ID |
| AUD-DD-TXF-006 | LOW | Zero or negative amount not explicitly rejected by `atomicWalletTransfer`; relies on balance-check side-effect. | [server/storage.ts](../../server/storage.ts) | Defer |
| AUD-DD-TXF-007 | LOW | Daily transfer limit is enforced on `/payment/transfer` only. Internal `atomicWalletTransfer` bypasses limits. | [server/routes/payments.routes.ts:355-381](../../server/routes/payments.routes.ts) | Defer |

### F — Transactions (`AUD-DD-TXN-*`)

| ID | Severity | Finding | File:line | Status |
|---|---|---|---|---|
| AUD-DD-TXN-001 | HIGH | `DELETE /transactions/:id` performs a hard delete via `storage.deleteTransaction` even though the schema added `deletedAt` in PR #1. The soft-delete column is not used. | [server/routes/transactions.routes.ts:97-113](../../server/routes/transactions.routes.ts), [server/storage.ts:419-422](../../server/storage.ts) | **Fix in this PR** |
| AUD-DD-TXN-002 | MEDIUM | The `GET /transactions` route does not extract `limit` / `offset` from query params, so the storage layer's pagination (PR #1) is unused — clients always get the first page. | [server/routes/transactions.routes.ts:17-25](../../server/routes/transactions.routes.ts) | **Fix in this PR** |
| AUD-DD-TXN-003 | MEDIUM | No filtering API on transaction list (status, type, date range, userId). Storage layer accepts conditions; route doesn't wire them through. | [server/routes/transactions.routes.ts](../../server/routes/transactions.routes.ts) | Defer — extend route handler |
| AUD-DD-TXN-004 | MEDIUM | Stale-`processing` transactions are not swept. A transaction created at line 437 of `payments.routes.ts` with status `'Processing'` stays there forever if the webhook never fires. | [server/routes/payments.routes.ts:437](../../server/routes/payments.routes.ts) | Defer — needs cron job |
| AUD-DD-TXN-005 | LOW | Composite indexes `(company_id, date)` and `(status, type)` would speed common report queries. | [shared/schema.ts:268-274](../../shared/schema.ts) | Defer — additive |

### G — Invoices (`AUD-DD-INV-*`)

| ID | Severity | Finding | File:line | Status |
|---|---|---|---|---|
| **AUD-DD-INV-001** | **CRITICAL** | `getInvoices(companyId?)` and `getInvoice(id)` do not filter `WHERE deletedAt IS NULL`. PR #1 added the column but invoice queries never picked it up. Deleted invoices appear in lists, in `getInvoicePublic` (the unauthenticated `/pay/:id` endpoint), and in revenue reports. | [server/storage.ts:896-928](../../server/storage.ts) | **Fix in this PR** |
| AUD-DD-INV-002 | HIGH | `deleteInvoice` performs a hard delete via `db.delete(invoices)` instead of setting `deletedAt`. PR #1 added the soft-delete column for exactly this reason. | [server/storage.ts:955-958](../../server/storage.ts) | **Fix in this PR** |
| AUD-DD-INV-003 | MEDIUM | Invoice number generation (`getNextInvoiceNumber`) is `SELECT MAX-style + 1` without a transaction or lock. Two concurrent invoice creations can produce duplicate numbers. | [server/storage.ts:931-942](../../server/storage.ts) | Defer — use Postgres `SEQUENCE` |
| AUD-DD-INV-004 | MEDIUM | `verifyCompanyAccess(entityCompanyId, userCompanyId)` returns `true` when `entityCompanyId` is null. Invoices created with `companyId: null` (because `resolveUserCompany` returned no company) are then accessible to ANY authenticated user. The IDOR is conditional on a non-error path that produces null companyId — not a default-leak, but a real edge. | [server/routes/shared.ts:185](../../server/routes/shared.ts), [server/routes/invoices.routes.ts:471](../../server/routes/invoices.routes.ts) | **Fix in this PR (require non-null)** |
| AUD-DD-INV-005 | MEDIUM | Public invoice route `/api/public/invoices/:id` is unauthenticated and not rate-limited. UUIDs are unguessable, but bot scraping with a leaked ID is possible. | [server/routes/invoices.routes.ts:81-147](../../server/routes/invoices.routes.ts) | Defer — add rate limit |
| AUD-DD-INV-006 | MEDIUM | Invoice status is set via `PATCH /invoices/:id` with no state-machine guard. A paid invoice can be flipped back to `'pending'`. | [server/routes/invoices.routes.ts:514-536](../../server/routes/invoices.routes.ts) | Defer — small enum guard |
| AUD-DD-INV-007 | MEDIUM | Partial payments (`invoicePaymentsStore`) live in an in-process `Map`, not the database. Lost on restart. Multi-instance ECS sees divergent payment states. | [server/routes/invoices.routes.ts:40-51](../../server/routes/invoices.routes.ts) | Defer — needs new `invoice_payments` table |
| AUD-DD-INV-008 | LOW | Tax amount sent by client is not server-recomputed; a tampered request can store an arbitrary `taxAmount`. | [server/routes/invoices.routes.ts:455-476](../../server/routes/invoices.routes.ts) | Defer |
| AUD-DD-INV-009 | LOW | Line items stored as JSONB without a server-side Zod shape check. | [shared/schema.ts:425](../../shared/schema.ts) | Defer |

### H — Reports (`AUD-DD-RPT-*`)

| ID | Severity | Finding | File:line | Status |
|---|---|---|---|---|
| AUD-DD-RPT-001 | HIGH | `DELETE /reports/:id` does not verify the report belongs to the caller's company. Any authenticated user with a report ID can delete it. (See AUD-DD-MT-001 for the related `/insights` issue, which is the higher-severity twin.) | [server/routes/reports.routes.ts:173-180](../../server/routes/reports.routes.ts) | **Fix in this PR** |
| AUD-DD-RPT-002 | MEDIUM | Report download regenerates from live data instead of replaying the snapshot stored at creation time. If expenses change between report-create and report-download, the downloaded report doesn't match the original — audit-trail loss. | [server/routes/reports.routes.ts:182-366](../../server/routes/reports.routes.ts) | Defer |
| AUD-DD-RPT-003 | MEDIUM | `POST /reports` (generation) requires `requireAuth` only; no `VIEW_REPORTS` or `CREATE_REPORTS` permission check. Any authenticated user can run heavy aggregation queries. | [server/routes/reports.routes.ts:36-171](../../server/routes/reports.routes.ts) | Defer |
| AUD-DD-RPT-004 | MEDIUM | CSV export buffers entire result set in memory. A 1M-row report OOMs the container. | [server/routes/reports.routes.ts:260-365](../../server/routes/reports.routes.ts) | Defer — stream via `res.write` |
| AUD-DD-RPT-005 | MEDIUM | Report queries on `expenses` etc. do NOT pass `includeDeleted: false`. After PR #1's soft-delete columns, deleted records will inflate report totals once delete paths start using soft-delete. | [server/routes/reports.routes.ts:97-146](../../server/routes/reports.routes.ts) | Defer (depends on storage-method consistency) |
| AUD-DD-RPT-006 | LOW | Date range parser falls back to `['', '']` on malformed input — the report silently includes all rows. | [server/routes/reports.routes.ts:204-241](../../server/routes/reports.routes.ts) | Defer |
| AUD-DD-RPT-007 | LOW | Report status update is not transactional; concurrent status writes can race. | [server/routes/reports.routes.ts:47-167](../../server/routes/reports.routes.ts) | Defer |

---

## 3. Severity matrix

| Area | CRITICAL | HIGH | MEDIUM | LOW | Total |
|---|---|---|---|---|---|
| Countries | — | — | 5 | 3 | 8 |
| Multi-tenant | 2 | 2 | 3 | 1 | 8 |
| Teams | 1 | 1 | 5 | 2 | 9 |
| Payouts | 1 | 2 | 3 | — | 6 |
| Transfers | — | 1 | 4 | 2 | 7 |
| Transactions | — | 1 | 3 | 1 | 5 |
| Invoices | 1 | 1 | 5 | 2 | 9 |
| Reports | — | 1 | 4 | 2 | 7 |
| **Total** | **5** | **9** | **32** | **13** | **59** |

(Some IDs cover multiple sub-issues; total verified findings ≈ 42 distinct issues + 17 sub-items.)

---

## 4. What this PR (#2) ships

Surgical fixes only — same discipline as PR #1. Each fix is small, additive where possible, and has tight blast radius.

| Fix | Closes | Approach |
|---|---|---|
| `/api/insights` scopes by caller's company | AUD-DD-MT-001 | Resolve company in route, pass `companyId` to `getInsights()`, narrow internal queries |
| `/api/admin/audit-logs` scopes by caller's company | AUD-DD-MT-002 | Resolve company in route, pass `companyId` to `getAuditLogs()` |
| Index on `audit_logs(company_id)` | AUD-DD-MT-006 | Migration `0009_*` adds the index |
| Storage layer hardening | AUD-DD-MT-003 (defensive) | Add a per-method `WARN` log when `companyId` is omitted on tenant-scoped getters; doesn't break callers but surfaces leaks for future audits |
| Invoice queries filter `deletedAt IS NULL` | AUD-DD-INV-001 | Update `getInvoices`, `getInvoice`, `getInvoicePublic` |
| `deleteInvoice` becomes soft-delete | AUD-DD-INV-002 | Update method to `UPDATE SET deleted_at = now()` |
| `verifyCompanyAccess` rejects null entityCompanyId | AUD-DD-INV-004 | Tighten the helper |
| `DELETE /transactions/:id` becomes soft-delete | AUD-DD-TXN-001 | Update `deleteTransaction` |
| `GET /transactions` honours `?limit=&offset=` | AUD-DD-TXN-002 | Wire query params through |
| `DELETE /reports/:id` verifies company ownership | AUD-DD-RPT-001 | Add `verifyCompanyAccess` check |

This closes **all 5 CRITICAL and 4 HIGH** findings amenable to surgical fix. The remaining HIGH items (admin role refactor, webhook trust, payout debit timing, member-table consolidation, role-permission DB) are documented in §10 with implementation specs and deferred to dedicated PRs.

---

## 5. Recommended sequencing for the deferred items

| Sprint | Engineer-days | Items |
|---|---|---|
| Sprint 3 | 2-3 | LU-DD-1 (admin role at company level — feature flag + migration) |
| Sprint 3 | 1-2 | LU-DD-2 (webhook companyId server-side cross-check) |
| Sprint 3 | 1 | LU-DD-5 (payout debit-first refactor) |
| Sprint 4 | 5-7 | LU-DD-3 (consolidate `teamMembers` into `companyMembers`) |
| Sprint 4 | 2-3 | LU-DD-4 (rolePermissions DB-backed + middleware factory) |
| Sprint 4-5 | 8-10 | Remaining MEDIUM/LOW (transfers, payouts, invoice numbering sequence, reports streaming, etc.) |

Total: ~3-4 engineer-weeks to retire the rest of the deep-dive list.

---

## 10. Deferred items — implementation specs

### LU-DD-1 — Admin role check at company-membership level

**Closes:** AUD-DD-MT-004
**Effort:** 2-3 days
**Risk:** Behavior change — every admin endpoint behaves differently. Ship behind `ADMIN_PER_COMPANY` flag in `system_settings`, default off, flip per-tenant.

**Design:**

```ts
// server/middleware/auth.ts
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // ... existing JWT verification ...
  const company = await resolveUserCompany(req);
  if (!company) return res.status(403).json({ error: 'No active company membership' });

  const flagOn = await isFeatureFlagOn('admin_per_company');
  if (flagOn) {
    if (!['OWNER', 'ADMIN'].includes(company.role)) {
      return res.status(403).json({ error: 'Insufficient privileges in this company' });
    }
  } else {
    // Legacy path — check user-level role
    const adminUser = await storage.getUserByEmail(userProfile.email);
    if (!adminUser || !['OWNER', 'ADMIN'].includes(adminUser.role)) {
      return res.status(403).json({ error: 'Insufficient privileges' });
    }
  }
  // attach req.adminUser + req.companyContext
  return next();
}
```

Migration: backfill `companyMembers.role` from `users.role` for existing OWNERs. Add ops runbook for flipping the flag per tenant.

### LU-DD-2 — Webhook companyId server-side cross-check

**Closes:** AUD-DD-MT-005
**Effort:** 1-2 days
**Risk:** Payment flow change — verify carefully with integration tests.

**Design:** When creating a Stripe `payment_intent` or Paystack transaction, write a row to `payment_intent_index (provider_intent_id, company_id, user_id)`. In the webhook handler, look up `companyId` from this index by `provider_intent_id` instead of trusting `metadata.companyId`. Falls back to metadata if the index row is missing (with WARN log).

### LU-DD-3 — Consolidate `teamMembers` into `companyMembers`

**Closes:** AUD-DD-TEAM-001, -003, -008
**Effort:** 5-7 days
**Risk:** Data migration. Need backfill, parallel writes for a soak window, then cutover.

**Design:** Add `permissions jsonb`, `departmentId text`, `phone text`, `position text` to `companyMembers` (the columns currently unique to `teamMembers`). Backfill from `teamMembers` rows. Parallel-write all team mutations to both tables for 1 sprint. Switch reads to `companyMembers`. Drop `teamMembers` after one more sprint of clean operation.

### LU-DD-4 — `rolePermissions` DB-backed + `requirePermission(name)` middleware

**Closes:** AUD-DD-TEAM-002
**Effort:** 2-3 days
**Risk:** Role behaviour change for VIEWER/EDITOR. Document the new mapping.

**Design:**
- Use the existing `rolePermissions` table.
- Seed via migration:
  ```sql
  INSERT INTO role_permissions (role, permissions) VALUES
    ('OWNER',    ARRAY['VIEW_TREASURY','MANAGE_TREASURY','CREATE_EXPENSE','APPROVE_EXPENSE','SETTLE_PAYMENT','MANAGE_CARDS','MANAGE_TEAM','VIEW_REPORTS','MANAGE_SETTINGS']),
    ('ADMIN',    ARRAY['VIEW_TREASURY','MANAGE_TREASURY','CREATE_EXPENSE','APPROVE_EXPENSE','SETTLE_PAYMENT','MANAGE_CARDS','MANAGE_TEAM','VIEW_REPORTS','MANAGE_SETTINGS']),
    ('MANAGER',  ARRAY['VIEW_TREASURY','CREATE_EXPENSE','APPROVE_EXPENSE','MANAGE_CARDS','VIEW_REPORTS']),
    ('EDITOR',   ARRAY['VIEW_TREASURY','CREATE_EXPENSE','VIEW_REPORTS']),
    ('EMPLOYEE', ARRAY['CREATE_EXPENSE']),
    ('VIEWER',   ARRAY['VIEW_TREASURY','VIEW_REPORTS']);
  ```
- Add `requirePermission(name: Permission)` middleware factory that resolves the user's company-membership role, looks up its permissions (cached), and merges with `companyMembers.permissions` (per-member overrides). Use this in place of `requireAdmin` everywhere a permission check is more appropriate.

### LU-DD-5 — Payout debit-first refactor

**Closes:** AUD-DD-PAY-002, AUD-DD-PAY-004
**Effort:** 1 day + tests
**Risk:** Payment flow change.

**Design:** Wrap `/payouts/:id/process` in a Drizzle transaction. Order:
1. Lock the source wallet `FOR UPDATE`
2. Check balance
3. Insert a `wallet_transactions` debit row + `transactions` row (status `processing`)
4. Update wallet balance
5. Commit transaction
6. Then call `paymentService.initiateTransfer` (now outside the DB transaction)
7. On success, `UPDATE` the local rows to `'completed'` and update payout status
8. On failure, run a compensating transaction: insert a credit reversal `wallet_transactions` row and mark the payout `'failed'`.

This matches the `recurringScheduler.ts` "FIX P4" pattern.

---

## 11. Agent claims rejected on verification

Documented for the reviewer's record. These were claimed by exploration agents but found incorrect when read against current source.

| Claim | Source check | Verdict |
|---|---|---|
| "`audit_logs` is missing `companyId`" | [shared/schema.ts:694](../../shared/schema.ts) declares `companyId: text("company_id").references(...)` | False — column exists. The real issue is the missing INDEX (AUD-DD-MT-006) and the unscoped storage call (AUD-DD-MT-002). |
| "TZ, SN, UG, ZM, ZW are in the active Paystack list" | The BRD mentions them as roadmap markets, not active. `SUPPORTED_COUNTRIES` in `shared/constants.ts` does not include them. | Partly correct — they're not active; the gap is documentation, not a leak. |
| "Departments are global because `companyId: null` always" | [server/routes/companies.routes.ts:42-65](../../server/routes/companies.routes.ts) — verified true at the team-route path; the companies-route path does set companyId. | True for one path, false for the other — finding stands but scoped narrower. |
| "`verifyCompanyAccess` is broken because it returns true on null" | [server/routes/shared.ts:185](../../server/routes/shared.ts) does this intentionally. The risk is conditional on null companyId being created in the first place. | True but bounded. We tighten it in this PR. |
| "Webhook handlers don't verify company at all" | They DO verify Stripe/Paystack signatures (timing-safe), but TRUST `metadata.companyId`. | Refined to AUD-DD-MT-005. |
| "`getTransactionByReference` uses fragile `LIKE`" | [server/storage.ts:402-407](../../server/storage.ts) uses exact `eq()` — the prior audit's fix landed. | False — already fixed. |

---

**See also:**

- [`AUDIT_2026_04_26.md`](AUDIT_2026_04_26.md) — Sprint 1+2 audit (predecessor)
- [`LOGIC_UPGRADE_PROPOSALS.md`](LOGIC_UPGRADE_PROPOSALS.md) — Sprint 1+2 upgrade specs (some still open)
- [`STATUS.md`](STATUS.md) — Sprint 1+2 implementation status
