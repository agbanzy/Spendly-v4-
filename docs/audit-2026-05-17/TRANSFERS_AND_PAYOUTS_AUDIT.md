# Transfers & Payouts — Multi-Persona Audit (2026-05-17)

**Scope:** every code path that moves money out of the platform, plus every supporting layer (DB schema, API integration, atomic helpers, webhook reconciliation, idempotency).
**Auditor:** Claude (Sonnet 4.5).
**Methodology:** multi-persona framework (Architect / Security / Performance / Reliability / Product / Test+CI / Adversary / Cost) with SQL excerpts and a Chief-Auditor synthesis. Every `file:line` cited was independently verified by reading source.
**Scope-out:** wallet *deposit* surfaces (Stripe Checkout, Paystack inline) — separate audit; mobile clients; the audit-log table itself.

---

## 0. TL;DR

The platform has **two distinct money-out surfaces** that share a database but **not** a discipline:

| Surface | Owner | State |
|---|---|---|
| **Payouts** (`/api/payouts/*`) — admin-initiated reimbursements, payroll, vendor pay | Heavily audited (PRs #21 → #36) | Has the claim-pattern, idempotency-keys-by-payout-id, daily-limits, two-admin gate. **Production-quality.** |
| **Transfers** (`/api/payment/transfer`) — user-initiated wallet-to-bank | Pre-audit | Has the debit-first pattern + per-currency daily limit, **but** no claim helper, no idempotency key reaching the provider, denormalised `transactions.description` carrying the provider reference, no unique constraint on `wallet_transactions.reference`. **Production but not hardened to the same bar.** |

Plus a **third money-out surface** that fell out of the audit map:

| Surface | Owner | State |
|---|---|---|
| **Bills payment from company balance** (`/api/bills/pay`, line 617–637) | Pre-audit | Falls through to **singleton** `storage.getBalances()` with no companyId. Cross-tenant balance debit. Same shape as the AUD-PR-001 payroll bug that was the headline CRITICAL in `AUDIT_PAYROLL_2026_04_26.md`. **New CRITICAL not previously catalogued.** |

The Chief-Auditor synthesis in §11 calls out the three CRITICALs, six HIGH, and the multi-stage remediation plan that closes the bleeding in one PR per area.

---

## 1. Wiring map — every money-out endpoint

| Verb | Path | Middleware | What it moves | Provider |
|---|---|---|---|---|
| POST | `/api/payouts` | `requireAuth + requireAdmin + requirePin` | Creates `pending` payout row | — (just DB row) |
| POST | `/api/payouts/:id/approve` | `requireAuth + requireAdmin + requirePin` | `pending → approved` or `pending_second_approval` (dual-approval > threshold) | — |
| POST | `/api/payouts/:id/process` | `requireAuth + requireAdmin + requirePin` + `financialLimiter` (implicit via rate-limiter on route group) | Debits `company_balances`, fires Stripe `transfers.create` / `payouts.create` OR Paystack `initiateTransfer` | Stripe **or** Paystack (per destination country) |
| POST | `/api/payouts/batch` | `requireAuth + requireAdmin + requirePin` | Loop of `/process` per `payoutIds[]` (max 50) | Stripe / Paystack |
| POST | `/api/payouts/:id/cancel` | `requireAuth + requireAdmin + requirePin` | `pending|approved → cancelled` (no debit reversal — `/process` never ran for cancellable statuses) | — |
| POST | `/api/payouts/:id/reject` | `requireAuth + requireAdmin + requirePin` | `pending|approved → rejected` | — |
| POST | `/api/payout-destinations/:id/onboard-stripe` | `requireAuth + requireAdmin + requirePin` | Creates Stripe Express account + onboarding link (Phase 1, default-OFF) | Stripe |
| POST | `/api/payment/transfer` | `requireAuth + requirePin + financialLimiter` | Debits user wallet, fires provider transfer | Stripe / Paystack |
| POST | `/api/wallet/payout` | `requireAuth + requirePin + financialLimiter` | Variant of `/payment/transfer` (payments.routes.ts:855) — wallet-to-bank | Stripe / Paystack |
| POST | `/api/bills/pay` | `requireAuth + requirePin + financialLimiter` | Pays bill from user wallet **or** falls through to singleton `company_balances` | — (internal balance debit) |
| POST | `/api/payroll/:id/pay` | `requireAuth + requireAdmin + requirePin` | Per-employee payroll payout | Stripe / Paystack |
| POST | `/api/payroll/process` | `requireAuth + requireAdmin + requirePin` + `financialLimiter` | Bulk payroll run | Stripe / Paystack |
| POST | `/api/payroll/batch-payout` | `requireAuth + requireAdmin + requirePin` | Batch payroll | (creates `payouts` rows; processed via `/api/payouts/:id/process`) |
| POST | `/api/expenses/:id/approve-and-pay` | `requireAuth + requireAdmin + requirePin` | Approves expense + initiates reimbursement payout | (creates `payouts` row) |
| POST | `/api/payments/utility` | `requireAuth + requirePin` | Utility bill payment via Paystack | Paystack |
| POST | `/api/stripe/checkout-session` | `requireAuth` | Stripe Checkout session for inbound payments | Stripe |
| Webhook | `/api/webhooks/stripe` | Signature-verified | Reconciles transfer/payout outcomes, credits-back-wallet on failure | Stripe → DB |
| Webhook | `/api/webhooks/paystack` | Signature-verified | Same as Stripe, Paystack side | Paystack → DB |

**Critical observation:** the payouts surface (`/api/payouts/*`) has eight rounds of audit + remediation behind it. The other surfaces are mostly pre-audit.

---

## 2. DB schema — the ledger primitives

### 2.1 Tables that touch real money

| Table | Purpose | Key columns |
|---|---|---|
| `wallets` | Per-user, per-currency wallet | `userId`, `companyId`, `currency`, `balance` (decimal 16,2), `availableBalance`, `pendingBalance`, `status` |
| `wallet_transactions` | Ledger for wallet credits/debits | `walletId`, `type`, `amount`, `direction` ('credit'\|'debit'), `balanceBefore`, `balanceAfter`, `reference` (text NOT NULL, **no unique constraint**), `reversedAt`, `reversedByTxId` |
| `transactions` | User-facing transaction history | `userId`, `type`, `amount`, `currency`, `status`, `reference`, `companyId`, `deletedAt` (soft delete) |
| `company_balances` | Per-company on-platform balance | `companyId`, `usd`, `local`, `localCurrency`, `availableUsd`, `availableLocal` |
| `payouts` | Money-out request + lifecycle | `companyId`, `type`, `amount`, `currency`, `status` (pending → approved → processing → paid \| failed \| cancelled), `recipientType`, `recipientId`, `destinationId`, `provider`, `providerTransferId`, `metadata.firstApproval / secondApproval` |
| `payout_destinations` | Bank / Stripe-Connect destination | `userId`, `vendorId`, `accountNumber`, `routingNumber`, `iban`, `bankCode`, `stripeConnectAccountId`, `stripeConnectOnboardingStatus` |
| `payment_intent_index` (LU-DD-2 / PR #21) | Server-issued provider intent → companyId mapping | `provider`, `providerIntentId`, `kind`, `companyId`, `userId` |
| `companies.payoutFlags` (jsonb, PR #36) | Per-tenant opt-in: `{ useStripeConnect: true }` | — |
| `companies.dailyPayoutLimits` (jsonb, PR #30) | Per-tenant per-currency cap override | — |

### 2.2 Indices and constraints — what's missing

```sql
-- wallet_transactions has TWO indices but NO unique constraint on reference.
-- See §4 (Reliability) — this is the root cause of the double-debit risk.
CREATE INDEX wallet_transactions_wallet_id_idx ON wallet_transactions(wallet_id);
CREATE INDEX wallet_transactions_created_at_idx ON wallet_transactions(created_at);
-- MISSING: CREATE UNIQUE INDEX ON wallet_transactions(reference);

-- transactions has soft-delete but no provider-reference index
CREATE INDEX transactions_user_id_idx ON transactions(user_id);
CREATE INDEX transactions_company_id_idx ON transactions(company_id);  -- added PR #9
-- MISSING: CREATE INDEX ON transactions(reference) WHERE reference IS NOT NULL;
-- (lookups by provider reference for webhook reconciliation scan the table)

-- payouts schema (PR #15 deferred migration would add):
ALTER TABLE payouts ALTER COLUMN company_id SET NOT NULL;  -- 0015_payouts_companyid_not_null.sql, gated
-- MISSING IN MAIN: unique constraint on provider_transfer_id when set
--   (prevents the same provider transfer being recorded against two payouts)
```

---

## 3. Atomic helpers — the SQL that matters

### 3.1 `claimPayoutForProcessing` — atomic state transition

The pattern that PR #5 (LU-DD-5) introduced and PR #24 (AUD-PR-006) extended to payroll. The whole reason it works is that PostgreSQL serialises the `UPDATE ... WHERE status='pending'` and only one concurrent caller sees the row in pending state:

```sql
-- server/storage.ts:2520 (claimPayoutForProcessing)
UPDATE payouts
SET status = 'processing',
    updated_at = $1
WHERE id = $2
  AND status IN ('pending', 'approved')
RETURNING *;
```

Two concurrent calls: one wins (rowCount=1), the other loses (rowCount=0, returned as `undefined`). The route handler returns 409 to the loser. Race-safe under real Postgres; verified by the integration test in `server/__tests__/integration/atomic-claim.int.test.ts` (PR #31).

### 3.2 `atomicPayoutDebit` — local debit + transaction row, one DB transaction

```sql
-- server/storage.ts:2722 (atomicPayoutDebit)
BEGIN;

-- 1. Lock the company_balances row
SELECT * FROM company_balances WHERE company_id = $1 FOR UPDATE;

-- 2. Verify available_usd / available_local has enough
--    (TypeScript-side check after SELECT)

-- 3. Debit the right column (usd vs local, by payout.currency)
UPDATE company_balances
SET usd = $2, available_usd = $3, updated_at = $4
WHERE company_id = $1;

-- 4. Insert into transactions
INSERT INTO transactions (type, amount, currency, status, description, reference, company_id, user_id, ...)
VALUES ('payout', $amount, $currency, 'Processing', ...);

COMMIT;
```

**Returns:** `{ transactionId, balanceField }` so the compensation path knows which row/column to restore.

### 3.3 `atomicPayoutCompensateOnFailure` — inverse of debit

```sql
-- server/storage.ts:2780 (atomicPayoutCompensateOnFailure)
BEGIN;
SELECT * FROM company_balances WHERE company_id = $1 FOR UPDATE;
UPDATE company_balances
SET usd = $2, available_usd = $3, updated_at = $4
WHERE company_id = $1;
UPDATE transactions
SET status = 'Failed', updated_at = $5
WHERE id = $6;
COMMIT;
```

### 3.4 `debitWallet` — also FOR UPDATE, but no idempotency dedup

```sql
-- server/storage.ts:1890 (debitWallet)
BEGIN;
SELECT * FROM wallets WHERE id = $1 FOR UPDATE;
-- TS-side: if (availableBalance < amount) throw 'Insufficient funds';

UPDATE wallets
SET balance = $2, available_balance = $3, updated_at = $4
WHERE id = $1;

INSERT INTO wallet_transactions (wallet_id, type, amount, direction, ...)
VALUES ($1, $type, $amount, 'debit', ...);

COMMIT;
```

**Gap:** the `reference` column is not unique. Two requests with the same `reference` both succeed → double-debit. The route layer prevents this by generating a unique reference (`TRF-${userId.substring(0,8)}-${Date.now()}`), but the Date.now() collision window is real if two requests land in the same millisecond. See §4 (Reliability).

### 3.5 `getDailyTransferTotal` — per-user, per-currency, today

```sql
-- server/storage.ts:861 (getDailyTransferTotal)
-- Returns sum of today's transfer_out from the user's wallets in a currency.
SELECT SUM(amount)::numeric AS total
FROM wallet_transactions wt
JOIN wallets w ON w.id = wt.wallet_id
WHERE w.user_id = $1
  AND ($2::text IS NULL OR w.company_id = $2)
  AND wt.type = 'transfer_out'
  AND DATE(wt.created_at) = CURRENT_DATE;
```

**Used by:** `/api/payment/transfer` (line 375) and only that route. The payouts surface uses `getDailyPayoutTotalForCompany` (PR #28) which is a separate aggregation against the `payouts` table.

### 3.6 `getDailyPayoutTotalForCompany` — per-company, per-currency, today

```sql
-- server/storage.ts (per PR #28)
SELECT SUM(amount)::numeric AS total
FROM payouts
WHERE company_id = $1
  AND currency = $2
  AND DATE(created_at) = CURRENT_DATE
  AND status NOT IN ('cancelled', 'rejected', 'failed');
```

**Used by:** `/api/payouts/:id/process` (line 583) and `/api/payouts/batch` (per-row).

---

## 4. Persona findings

Each persona examined the surfaces against a different lens. Severity follows the audit convention: **CRITICAL** > **HIGH** > **MEDIUM** > **LOW**.

### 4.1 🏗 Architect — system shape, layering, consistency

| Severity | Finding | Location | Notes |
|---|---|---|---|
| HIGH | **Three money-out surfaces, three different disciplines.** `/payouts/*` uses claim-pattern + idempotency + daily limits. `/payment/transfer` uses debit-first but no claim helper and only the `Date.now()` salt for the provider reference. `/bills/pay` falls through to a singleton balance debit (§4.2 has the CRITICAL). | `server/routes/payouts.routes.ts:554`, `payments.routes.ts:300`, `payments.routes.ts:617` | The right fix is a single `MoneyMovement` service abstraction (`claim → debit → external → compensate`) that all three surfaces call into. Not a one-PR rewrite — a quarter-scope. |
| HIGH | **Denormalised provider-ref-in-description.** `/payment/transfer` writes `description: providerRef` and `reference: null` on the `transactions` row. Webhook reconciliation has to LIKE-match the description to find the row. Wrong column, no index. | `payments.routes.ts:436–446` | Move the provider ref to `transactions.reference` (the correct column) and add a partial index. ~1 hr including migration. |
| MEDIUM | **`wallets` has both `balance` and `availableBalance`** but no clear contract for when they diverge. Code uses `availableBalance` for the gate and `balance` for the display. Diverges silently if a pending hold is forgotten. | `shared/schema.ts:849-851`, `storage.ts:1905` | Document the invariant: `availableBalance = balance - pendingBalance`. Add a check constraint. ~30 min. |
| MEDIUM | **`payouts.metadata.firstApproval / secondApproval`** is a JSONB convention not enforced anywhere except in `/payouts/:id/approve`. A different code path that updates `payouts.metadata` could clobber it. | `payouts.routes.ts:399–531` | Extract the dual-approval state into typed columns (`first_approval_by`, `first_approval_at`, etc.) so the type system catches misuse. M-effort. |
| LOW | **No central `MoneyMovement.recordIntent(provider, ref, kind, companyId, userId)`** — every surface that touches Stripe/Paystack inlines a call to `indexProviderIntent` (LU-DD-2 helper). Easy to forget. | `paymentService.ts:183, 231, 313` | Wrap the SDK calls in a helper that auto-indexes. S-effort. |

### 4.2 🔒 Security — auth, isolation, data leak, fraud

| Severity | Finding | Location | Notes |
|---|---|---|---|
| **CRITICAL** | **`/api/bills/pay` falls through to singleton `company_balances`.** When the user has no personal wallet in the bill's currency, line 624 calls `storage.getBalances()` with NO `companyId` — returning whichever company_balances row the storage layer's default points to. Cross-tenant balance debit. Same shape as the AUD-PR-001 payroll bug from `AUDIT_PAYROLL_2026_04_26.md`. | `payments.routes.ts:617–637` | New finding: **TP-CRIT-01**. Fix: pass `userCompany.companyId` to `getBalances` AND `updateBalances`. Match the payout debit-pattern: lock, verify currency, debit, audit-log. |
| **CRITICAL** | **No idempotency key ever reaches the provider on `/payment/transfer`.** The route generates `TRF-${userId.substring(0,8)}-${Date.now()}` for the wallet ledger AND for the provider call, but `paymentService.initiateTransfer` is called WITHOUT `metadata.payoutId` — so the AUD-DB-004/005/006 fixes in PR #25 don't apply. A retried request creates duplicate provider transfers. | `payments.routes.ts:415-420`; `paymentService.ts:151` (`payoutId = metadata?.payoutId`) | **TP-CRIT-02**. Fix: thread `transferReference` through as `metadata.payoutId` (or rename to `metadata.intentId`) on this call site. Trivial. |
| **CRITICAL** | **Large-transaction threshold is a `console.log` placebo.** Line 393–396: "In production, this would require 2FA or admin approval." Comment, not code. Currently anyone past the daily limit slug-by-slug just gets logged. | `payments.routes.ts:386–396` | **TP-CRIT-03**. Fix: refuse the request with 403 + `code: 'LARGE_TXN_NEEDS_APPROVAL'` and surface a pending-approval row that an admin must approve via `/payouts/:id/approve` (the dual-approval machinery is already there). |
| HIGH | **`wallet_transactions.reference` is not unique.** Two requests with colliding `Date.now()` salt → two debits, two ledger rows, both succeed. Probability is low (millisecond collisions in the same wallet) but the consequence is real money. | `shared/schema.ts:862–885`; `storage.ts:1921-1934` | Add `CREATE UNIQUE INDEX wallet_transactions_reference_unique_idx ON wallet_transactions(wallet_id, reference);` Migration is one line. |
| HIGH | **`/wallet/payout` is a second implementation of `/payment/transfer`** at line 855 — same domain, different code path, neither uses the audited payouts machinery. Maintenance + drift surface. | `payments.routes.ts:855` | Consolidate. Either route forwards to the other, or both wrap a shared service. |
| HIGH | **No CSRF on money-moving POSTs except via `X-Requested-With: XMLHttpRequest` header.** That blocks form-encoded cross-origin POSTs but does NOT block a malicious extension with the header. | `server/middleware/csrf.ts` | Add a per-session anti-CSRF token (double-submit cookie pattern) for `/payment/transfer`, `/wallet/payout`, `/bills/pay`. The payouts surface already gates on PIN which gives some protection but isn't a real anti-CSRF mechanism. |
| MEDIUM | **`/payments/utility` (line 1022)** isn't gated by `requirePin`. It's a payment via Paystack but treated as low-risk. Inconsistent with `/bills/pay`. | `payments.routes.ts:1022` | Add `requirePin` for consistency, or define a clear "no-pin-required" category and document it. |
| MEDIUM | **Webhook idempotency: `processed_webhooks` exists but isn't UNIQUE-indexed.** If two webhooks for the same `eventId` arrive in close succession, both can pass the "is this processed?" check and both write the side-effect. | `server/storage.ts:isWebhookProcessed`, `markWebhookProcessed` | `CREATE UNIQUE INDEX processed_webhooks_event_id_idx ON processed_webhooks(provider, event_id);` |
| LOW | **`/payment/transfer` references PII (`accountNumber`, `bankCode`)** in `wallet_transactions.metadata` and in audit logs. PCI scope creep concern if logs are exported to a third-party APM. | `payments.routes.ts:410, 486` | Redact in the LU-DD-2 logger pass; mask all but last 4 of `accountNumber`. |

### 4.3 ⚡ Performance — query cost, N+1, hot paths

| Severity | Finding | Location | Notes |
|---|---|---|---|
| HIGH | **`getDailyTransferTotal` is O(N) per request** — JOIN over wallets + wallet_transactions, GROUP BY user → table scan. Acceptable today; becomes the gating query when wallet_transactions hits 10M rows. | `storage.ts:861` | Add an index on `wallet_transactions(wallet_id, type, created_at)` for the gated path; consider materializing today's-totals into a separate table on commit. M-effort. |
| HIGH | **`/payouts/batch` loops sequentially.** Each iteration: getPayout → claim → atomicPayoutDebit → external call → atomicPayoutCompensateOnFailure (on err). For 50 entries at ~2s each = 100s per request. Hits the workflow-action timeout. | `payouts.routes.ts:826–1080` | Parallelize within the same DB transaction is dangerous (provider rate-limits, race on `company_balances` row). Keep sequential; surface progress via SSE or move to a job queue. |
| MEDIUM | **Webhook reconciliation on `/payment/transfer` uses LIKE search** over `transactions.description` because the provider ref is in the wrong column. With 1M+ transactions, that's a full table scan per webhook. | (inferred from `payments.routes.ts:436`) | Fixed by the §4.1 fix (move ref to the right column + index). |
| MEDIUM | **`debitWallet` and `creditWallet` both do `SELECT FOR UPDATE` on the same row** then UPDATE → INSERT. Three statements per call. Could be `UPDATE ... RETURNING` to halve the round-trips. | `storage.ts:1890, 1844` | Profile first. Probably not a bottleneck yet. |
| LOW | **`getCompanyPayoutFlags` is called twice per `/payouts/:id/process`** (once for the gate, once for the metadata flag). Add a request-scoped cache or hoist the call. | `payouts.routes.ts:660, 700` | Trivial fix; impact minimal. |

### 4.4 🔧 Reliability — failure modes, retries, partial-failure recovery

| Severity | Finding | Location | Notes |
|---|---|---|---|
| **CRITICAL** | **`/payment/transfer` has no claim pattern.** Two concurrent requests against the same wallet pass the balance check independently (the `FOR UPDATE` lock is held only inside `debitWallet`, AFTER the route-layer balance check at line 346). If both arrive at the same instant, both proceed to call the provider, debit fires twice from the now-locked SELECT. The FOR UPDATE serialises them so the SECOND request sees the updated `availableBalance` and fails with `Insufficient funds` — but the first request has already paid out. **Net effect: not a double-spend (one fails) but a race-window where the user sees an inconsistent state.** Better pattern: claim the wallet for a specific intent ID, then debit. | `payments.routes.ts:336–432`; `storage.ts:1890` | **TP-CRIT-04**. Fix: add `claimWalletForTransfer(walletId, intentId, amount)` that atomically inserts a "hold" row keyed on intentId — duplicate intentId returns null → 409. Mirrors the payouts claim helper. |
| HIGH | **Wallet refund-on-transfer-failure is best-effort, not transactional.** Line 423–430 calls `creditWallet` after the provider call fails. If `creditWallet` itself fails (DB unavailable mid-request), the wallet stays debited and the money never left → real loss for the user. | `payments.routes.ts:421–431` | Wrap debit + provider call + compensate in an outer try/catch that writes to a `pending_compensations` table on failure-of-compensate. A separate worker retries from the queue. Mirrors the payouts compensate pattern (PR #5) but for wallets. |
| HIGH | **No retry policy on the provider SDK call.** A transient 5xx from Stripe/Paystack throws, the route triggers compensation, the user sees "transfer failed" — but a 30-second-later auto-retry might have succeeded. The webhook will pick up the orphan only if the provider actually charged before the network blip. | `paymentService.ts:171, 227, 297` | Add exponential-backoff retry (2 attempts, ~5s apart) inside `initiateTransfer` for known-retryable errors (TLS reset, 502, 503). |
| HIGH | **`processedWebhooks` is checked, not enforced.** Two webhook deliveries for the same event arriving within milliseconds can both pass the `isWebhookProcessed` check and both write the side-effect (double-credit on transfer.failed, double-debit-compensation, etc.). | `webhookHandlers.ts`, `storage.ts:isWebhookProcessed` | Add the unique index from §4.2 and use `INSERT ... ON CONFLICT DO NOTHING RETURNING id`. If RETURNING is empty → already processed → skip. |
| MEDIUM | **Bulk payroll & batch payouts have no resume capability.** If the loop is killed mid-way (ECS task replaced, OOM), the remaining entries stay `pending` but the early entries may be `processing`. A re-run skips the `processing` rows (good) but there's no way to manually re-claim a stuck `processing` row that the webhook never resolved. | `payroll.routes.ts:297`, `payouts.routes.ts:826` | Add a scheduled job that auto-releases `processing` rows older than 1 hour (with an audit-log entry). Mirrors the `recurringScheduler` leader-election pattern from PR #4. |
| MEDIUM | **`atomicPayoutDebit` doesn't handle the case where `company_balances` row doesn't exist.** If a new tenant has never been funded, the `SELECT FOR UPDATE` returns zero rows; the subsequent UPDATE updates zero rows. The code then inserts the transactions row anyway. Result: a `processing` transaction with no debit. | `storage.ts:2722` | Add explicit row-existence check + 422 with `INSUFFICIENT_FUNDS_NO_BALANCE` code. |

### 4.5 🎯 Product — UX, error messages, user trust

| Severity | Finding | Location | Notes |
|---|---|---|---|
| HIGH | **Error messages leak internal terminology.** `"Payout cannot be processed in 'pending_second_approval' status"` is meaningless to a user. | `payouts.routes.ts:540` | Translate at the boundary: "This payout needs a second admin to approve before it can be sent." |
| HIGH | **No optimistic UI on /payment/transfer.** The user clicks Send, waits 5–10 seconds (provider call), then sees either success or a generic error. A progress indicator + "Your transfer is being initiated" → "Sent to Paystack, awaiting confirmation" → "Delivered" would surface the actual state machine. | `client/src/pages/transactions.tsx` | Backend already returns `status: 'processing'` after debit; client can show it without faking. |
| MEDIUM | **Daily-limit-exceeded error uses different shapes** across `/payment/transfer` (status 400, `{limit, used, requested, currency}`) vs `/payouts/:id/process` (status 429, similar but different keys). Frontends parse them differently. | `payments.routes.ts:376-384`, `payouts.routes.ts:589-595` | Normalise to a single response shape with `code: 'DAILY_LIMIT_EXCEEDED'`. |
| MEDIUM | **The `/bills/pay` wallet-fallback path** silently uses company funds without explicit user confirmation. A user with $0 personal wallet who pays a bill is debited from company funds with no UI affordance. | `payments.routes.ts:617` | UI should prompt "Pay $X from your company balance?" with explicit confirm. |
| LOW | **`/payment/transfer` notification copy** says "Payout processed" even when the transfer is still `processing`. Misleading. | `payments.routes.ts:453` (`notifyPayoutProcessed`) | Rename to `notifyTransferInitiated` and add a separate `notifyTransferCompleted` triggered by the webhook. |

### 4.6 🧪 Test / CI — coverage, regression risk

| Severity | Finding | Location | Notes |
|---|---|---|---|
| HIGH | **Zero unit tests on `/payment/transfer`.** The most-used money-out endpoint has no behavioural coverage. Compare to `/payouts/:id/process` which has 4 integration tests + 7 contract tests across `payout-debit-first.test.ts` and `atomic-claim.int.test.ts`. | `server/__tests__/` | Mirror the payout-debit-first contract test for `/payment/transfer`. ~2 hr. |
| HIGH | **No test on `getDailyTransferTotal`.** A regression that returns `0` (e.g. an SQL change that breaks the JOIN) would silently disable the daily limit. | — | Add 3 tests: today-with-rows, today-no-rows, different-day. |
| MEDIUM | **No integration test on `/bills/pay` company-fallback path.** The CRITICAL bug above (TP-CRIT-01) would have been caught by a test that sets up a user with no personal wallet and asserts the bill is paid from THIS company's balance, not another. | — | testcontainers Postgres path; ~3 hr including seed setup. |
| MEDIUM | **Webhook handlers have no test for the "two webhooks same event, ms apart" case.** Without the unique index (§4.4), that path silently double-applies. | `webhookHandlers.ts` | Race-condition integration test that fires two `markWebhookProcessed` calls in `Promise.all`. |
| LOW | **`paymentService.initiateTransfer` mock coverage** is broad (PR #25 idempotency tests use it). Real test against a Stripe test-mode account is in the deferred plan; the unit-level mock is fine for now. | — | — |

### 4.7 ⚔️ Adversary — what would an attacker do?

| Severity | Attack | Status |
|---|---|---|
| **CRITICAL** | **Spam `/bills/pay` with a victim's bill id from a user account that has no personal wallet** in the bill's currency → drain victim company's balance via the singleton bug (TP-CRIT-01). | OPEN — fix in TP-CRIT-01 |
| HIGH | **Replay `/payment/transfer` request mid-network-blip** to double-spend before idempotency catches it. With TP-CRIT-02 (no provider idem key) this is exploitable today against Stripe/Paystack; with TP-CRIT-04 (no claim pattern) the local debit also races. | OPEN — fix in TP-CRIT-02 + TP-CRIT-04 |
| HIGH | **Use the `/wallet/payout` second implementation** to bypass any fix applied only to `/payment/transfer`. Same attack surface, different code. | OPEN — fix via consolidation |
| HIGH | **Send `amount: 9_999_999_999` to `/payment/transfer`** and look for arithmetic overflow in the decimal multiplication. `Money.toMinor(amount)` uses `Math.round(amount * 100)` — overflows at `Number.MAX_SAFE_INTEGER / 100 = 90071992547409.92`. Not exploitable today (large-txn threshold catches it at console.log level) but the threshold is a placebo (TP-CRIT-03). | LOW likelihood, HIGH impact |
| MEDIUM | **Race two `/payouts/:id/cancel` calls against an `approved` payout** to trigger the wallet-credit branch twice. **Already fixed in PR #23** (the entire credit branch was deleted in AUD-DB-002). Verified clean. | CLOSED |
| MEDIUM | **Send a malformed webhook** to `/api/webhooks/stripe` to bypass signature verification. Defense relies on `stripe.webhooks.constructEvent`. Validated in current code; covered by the integration test `server/__tests__/lib/webhook-company-resolver.test.ts`. | CLOSED |

### 4.8 💰 Cost — provider fees, infra, ops

| Item | Magnitude | Notes |
|---|---|---|
| Stripe Connect fees (when activated) | 0.25% + $0.25 per transfer (US) | New cost not present today; documented in `STRIPE_CONNECT_MIGRATION_PLAN.md` |
| Paystack transfer fee | NGN 10 per transfer (NG) | Baked into the cost model |
| Webhook retry storm cost | Negligible | Stripe/Paystack rate-limited; our endpoint is cheap |
| DO Managed Postgres (when upgraded from dev) | $15/mo dev tier → $60/mo for basic 2 vCPU | Required before real customer data |
| Failed-transfer compensation work | Estimated 1–3 minutes ops time per orphan | Should be near-zero with TP-CRIT-04 fix |

---

## 5. Risk register (severity × likelihood × blast radius)

| ID | Title | Severity | Likelihood | Blast radius | Score |
|---|---|---|---|---|---|
| **TP-CRIT-01** | Bills payment singleton balance | CRITICAL | HIGH | Any tenant's balance | **9** |
| **TP-CRIT-02** | `/payment/transfer` no provider idempotency | CRITICAL | MEDIUM (network blips) | Double transfer per blip | **7** |
| **TP-CRIT-03** | Large-txn threshold is placebo | CRITICAL | LOW (visible to attackers) | Unlimited transfer size | **6** |
| **TP-CRIT-04** | `/payment/transfer` no claim pattern | CRITICAL | LOW (ms race window) | Inconsistent wallet state | **6** |
| TP-HIGH-05 | `wallet_transactions.reference` not unique | HIGH | LOW | Double debit per collision | 5 |
| TP-HIGH-06 | `/wallet/payout` second implementation | HIGH | (drift) | Any fix half-applied | 4 |
| TP-HIGH-07 | Refund-on-failure not transactional | HIGH | LOW | User-visible loss per blip | 4 |
| TP-HIGH-08 | No retry policy on provider SDK call | HIGH | MEDIUM | Spurious failures | 4 |
| TP-HIGH-09 | `processedWebhooks` not unique-indexed | HIGH | LOW | Double-applied effect | 4 |
| TP-HIGH-10 | Denormalised provider-ref-in-description | HIGH | LOW | Webhook reconciliation N+1 | 3 |
| TP-HIGH-11 | Daily-limit query performance | HIGH | MEDIUM (over time) | Latency degradation | 3 |
| TP-MED-… | (see §4 for remainder) | | | | |

---

## 6. Multi-stage remediation plan

### Stage 1 — **Sprint 1 (3–5 days)**: close the three CRITICALs

Single PR per CRITICAL so each is independently revertable. Order them by dependency:

1. **TP-CRIT-01 fix** (`/bills/pay` company-fallback)
   - Pass `userCompany.companyId` to `getBalances` + `updateBalances`
   - Add `verifyCompanyAccess(bill.companyId, userCompany.companyId)` before debit
   - Migration: backfill any cross-tenant rows (run the orphan-cleanup helper first, similar to `0015_payouts_companyid_not_null.sql`)
   - 3 contract tests (own-tenant ✓, cross-tenant 403, no-company 403)
   - **Effort: 1 day. Risk: low.**

2. **TP-CRIT-02 fix** (`/payment/transfer` idempotency)
   - Thread `transferReference` through as `metadata.payoutId` (rename in a follow-up; keep the field name for backwards compat for now)
   - Add unit test confirming `paystackClient.initiateTransfer` is called with `reference: 'TRF-...'`
   - **Effort: 0.5 day. Risk: very low.**

3. **TP-CRIT-03 fix** (large-txn threshold)
   - Replace `console.log` with a real refuse-with-approval path
   - Create a `pending_large_transactions` row that an admin must approve via `/payouts/:id/approve` (re-use the dual-approval machinery)
   - 3 tests (under-threshold passes, over-threshold returns 403 + `code:'LARGE_TXN_NEEDS_APPROVAL'`, with-approval succeeds)
   - **Effort: 1.5 days. Risk: medium — touches the dual-approval state machine.**

4. **TP-CRIT-04 fix** (`/payment/transfer` claim pattern)
   - Add `claimWalletForTransfer(walletId, intentId, amount)` storage helper using `INSERT ... ON CONFLICT DO NOTHING` against a new `wallet_transfer_intents` table
   - Refactor `/payment/transfer` to call `claim → debit → external → compensate`
   - Mirror the integration test from `atomic-claim.int.test.ts`
   - **Effort: 2 days. Risk: medium — touches the hot path.**

**End-of-sprint state:** all four TP-CRITs closed; `/payment/transfer` matches the discipline of `/payouts/:id/process`; bills payment scoped to tenant.

### Stage 2 — **Sprint 2 (1 week)**: HIGH findings + consolidation

5. **Unique constraint on `wallet_transactions(wallet_id, reference)`** — TP-HIGH-05
   - One-line migration + backfill if dupes exist (deferred-migration helper pattern)

6. **Unique constraint on `processed_webhooks(provider, event_id)`** — TP-HIGH-09
   - One-line migration + flip `markWebhookProcessed` to use `INSERT ... ON CONFLICT DO NOTHING RETURNING id`

7. **Move provider ref to `transactions.reference`** — TP-HIGH-10
   - Migration: copy `description → reference` for rows where `description` looks like a provider ref; null out description
   - Partial index `CREATE INDEX transactions_reference_idx ON transactions(reference) WHERE reference IS NOT NULL;`

8. **Retry policy on `paymentService.initiateTransfer`** — TP-HIGH-08
   - Exponential backoff (2 attempts, 5s apart) on TLS reset / 502 / 503

9. **Wallet refund transactional wrapper** — TP-HIGH-07
   - New `pending_compensations` table + retry worker (mirrors `recurringScheduler` leader-election)

10. **Consolidate `/wallet/payout` into `/payment/transfer`** — TP-HIGH-06
    - One forwards to the other; the duplicated code path goes away

**End-of-sprint state:** every money-out surface is uniform; the ledger has the right constraints; webhook reconciliation is properly indexed; the refund path is durable.

### Stage 3 — **Quarter scope**: architecture + observability

11. **Extract `MoneyMovement` service**
    - One module that exposes `process(intent: MoneyIntent) → MoneyOutcome`
    - `MoneyIntent` is a discriminated union of `WalletTransfer | PayoutDisbursement | BillPayment | ExpenseReimbursement | PayrollDisbursement`
    - Internally orchestrates `claim → debit → external → compensate` with a single set of audit-log + idempotency conventions
    - All routes become thin wrappers that build the intent
    - **Effort: 3 weeks.** Lays the groundwork for Stage 4

12. **Typed dual-approval columns** (Architect MEDIUM)
    - Schema migration: `payouts.first_approval_by, first_approval_at, second_approval_by, second_approval_at`
    - JSONB-to-column backfill, then drop the JSONB fields

13. **Stripe Connect Phase 2** (per `STRIPE_CONNECT_MIGRATION_PLAN.md`)
    - Cohort migration; requires the planning meeting documented in PR #32

14. **Observability**
    - Pino → Honeycomb + OpenTelemetry trace IDs across every money-out call
    - Per-tenant grafana panels: today's transfer count, payout success rate, provider error rate
    - PR #14 (observability proposal in `LOGIC_UPGRADE_PROPOSALS.md`) is the spec

### Stage 4 — **Multi-quarter strategic**

15. **Real-time fraud signal pipeline** (Adversary)
    - Stream `wallet_transactions` + `payouts` events to a fraud-scoring worker
    - Surface high-risk transfers for manual review (uses the dual-approval machinery)

16. **Per-tenant wallet sharding**
    - When wallet_transactions hits 100M rows, partition by `(company_id, created_at)` quarterly
    - Per-tenant logical replicas for the daily-total query

---

## 7. Sequencing rationale

| Phase | Why first | Why not now |
|---|---|---|
| Stage 1 CRITs | All four are real exploitable / fund-loss bugs. Each is small enough for a single 1-day PR. | — |
| Stage 2 HIGH | They harden Stage 1 fixes (e.g. unique index prevents replays even if claim helper has a bug). Order within Stage 2: data-layer fixes (5,6,9) before consolidation (10) so the consolidated code path inherits the constraints. | — |
| Stage 3 architecture | `MoneyMovement` service rewrites a hot path. Doing it before Stage 1+2 means you'd ship the bugs into the new abstraction. | — |
| Stage 4 fraud / sharding | Both are scale problems. Premature if today's volume is sub-100k transfers/day. | — |

---

## 8. Chief Auditor synthesis

The platform's payout discipline (PRs #21–#36, six sprints of work) is genuinely production-quality: claim-pattern + idempotency + compensation + dual-approval + daily-limit + per-tenant override. **The audit work paid off.**

The **transfer** discipline (`/payment/transfer`, `/wallet/payout`, `/bills/pay`) is **pre-audit** — it has the right intent (debit-first) but none of the hardening. Three of the four Stage-1 CRITs apply to the transfer side, not the payout side.

**The single most impactful PR you can ship is the TP-CRIT-04 + TP-CRIT-02 combo** — adds a claim pattern + idempotency key to `/payment/transfer`. After that, the transfer surface has the same race-safety the payout surface has had since PR #5. **TP-CRIT-01 is independent and equally urgent** — the `/bills/pay` singleton-balance fall-through is the same class of bug as the payroll AUD-PR-001 that was the headline of `AUDIT_PAYROLL_2026_04_26.md`.

The unify-into-`MoneyMovement` service is the right long-term move but is **explicitly Stage 3** — don't ship it before the bug fixes.

---

## 9. What this audit did NOT cover

- **Deposit flows** (Stripe Checkout, Paystack inline, virtual-account funding) — separate audit, materially different threat model (inbound money)
- **Mobile clients** — none of the React Native code paths examined; assumes mobile uses the same REST API
- **The `audit_logs` table** itself — not audited for tamper-resistance
- **Stripe Connect Phase 1 activation** — covered separately in PR #36 + `STRIPE_CONNECT_MIGRATION_PLAN.md`
- **Card transactions** (`cardTransactions` table) — out of scope for this audit; reviewed in `AUDIT_DEEP_DIVE_2026_04_26.md`
- **Reversal of completed transfers** — partial coverage in PR #5 (`atomicPayoutCompensateOnFailure`); the wallet-side equivalent is the TP-HIGH-07 finding

---

## 10. Cross-references

- `AUDIT_PAYROLL_2026_04_26.md` — payroll module audit; same multi-tenant class as TP-CRIT-01
- `AUDIT_DISBURSEMENT_2026_04_26.md` — disbursement audit; closed via PRs #21–#36
- `STRIPE_CONNECT_MIGRATION_PLAN.md` — the Connect Phase 1+2+3 work
- `LOGIC_UPGRADE_PROPOSALS.md` — original LU-DD-2 (payment_intent_index), LU-DD-5 (debit-first payouts) specs
- `SCREEN_WIRING_MATRIX.md` — every screen → route → storage → table
- `AUDIT_COUNTRY_PERSONA_ROLE_2026_05_17.md` — separate auth audit; PR #42 closes S-F-01/02/03
- PRs that landed the payout discipline: **#5 (claim pattern)**, **#21 (audit doc)**, **#23 (criticals fix)**, **#25 (idempotency)**, **#27 (NOT NULL)**, **#28 (daily limit)**, **#30 (per-tenant override)**, **#31 (testcontainers)**, **#36 (Stripe Connect Phase 1)**

---

## 11. Personas — what each one would prioritise (one-liners)

| Persona | Their #1 fix |
|---|---|
| 🏗 Architect | Consolidate the three money-out surfaces into a `MoneyMovement` service (Stage 3, item 11) |
| 🔒 Security | TP-CRIT-01: stop the `/bills/pay` singleton-balance fall-through (Stage 1, item 1) |
| ⚡ Performance | Index `transactions(reference)` so webhook reconciliation stops scanning (Stage 2, item 7) |
| 🔧 Reliability | TP-CRIT-04: add a claim pattern to `/payment/transfer` (Stage 1, item 4) |
| 🎯 Product | Surface "Pay from company balance" as an explicit user confirm on `/bills/pay` (medium UX) |
| 🧪 Test/CI | Add the contract tests for `/payment/transfer` so future refactors don't silently break it (HIGH coverage gap) |
| ⚔️ Adversary | TP-CRIT-01 + TP-CRIT-02 — the singleton bug + the replay vector. The single highest-payoff attack chain. |
| 💰 Cost | None urgent today; ops cost rises sharply only when TP-CRIT-04 + TP-HIGH-07 land together (auto-compensation worker reduces ops minutes per orphan) |

The Chief Auditor agrees with Security + Reliability: **TP-CRIT-01 + TP-CRIT-04 + TP-CRIT-02 in one sprint** is the right call.

---

## 12. Next action

Open PR-1 in the new sprint: **`fix(security): TP-CRIT-01 — bills payment scoped to tenant company_balances`**. 1-day estimate. Closes the highest-score finding. After it lands, TP-CRIT-02 and TP-CRIT-04 can ship in parallel (different surfaces, no merge conflict).
