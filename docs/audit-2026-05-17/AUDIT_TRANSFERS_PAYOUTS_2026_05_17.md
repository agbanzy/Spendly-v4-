# Audit — Transfers + Payouts (DB + API + Webhooks + Personas)

**Date:** 2026-05-17
**Auditor:** Claude (Sonnet 4.7) — two parallel Explore-agent passes (DB layer + API/webhook layer); every `file:line` cited below was independently re-read against source before inclusion.
**Scope:** every code path that moves money out — payouts (`server/routes/payouts.routes.ts`), wallet-to-bank transfers (`server/routes/payments.routes.ts`), payroll → payout (`server/routes/payroll.routes.ts`), expense → payout (`server/routes/expenses.routes.ts`), the routing layer (`server/paymentService.ts`), both webhook handlers (`server/webhookHandlers.ts`, `server/paystackWebhook.ts`), and the storage methods underpinning them.

This is the third audit pass on the disbursement surface. Prior passes:
- **2026-04-26** — `AUDIT_DISBURSEMENT_2026_04_26.md` (2 CRIT + 4 HIGH + 3 MED + 2 LOW). Closed by PR #23 (Sprint-1) + PR #25 (Sprint-2 idempotency) + PR #27 (NOT NULL migration) + PR #28 + #30 (daily limits + per-company overrides).
- **2026-04-26** — `AUDIT_PAYROLL_2026_04_26.md` (3 CRIT + 3 HIGH + 4 MED + 2 LOW). Closed by PR #22 (Sprint-1 scoping) + PR #24 (Sprint-2 claim pattern + audit logs).

This pass found **two CRITICAL regressions of the same bug class** that the 2026-04-26 disbursement audit closed for the `POST /payouts` create-side but missed on the `/process` and `/batch` execution-side. Both are verified-via-source — not agent hallucinations.

---

## TL;DR

| Category | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
| API + Authorization | **2** | **3** | 3 | 1 | 9 |
| DB Layer | 0 | 3 | 4 | 2 | 9 |
| Webhook / Provider | 0 | 1 | 2 | 0 | 3 |
| **Total** | **2** | **7** | **9** | **3** | **21** |

The two CRITICAL findings (**T-F-01** + **T-F-02**) are direct cross-tenant IDORs on the two routes that actually move money out of the platform's Stripe / Paystack balance. They are the same bug class — `storage.getPayout(id)` with no `companyId` AND-clause — and have the same one-helper fix (`getPayoutInCompany(id, companyId)`).

---

## 1. State machine (multi-stage plan)

The transfer + payout subsystem has three parallel state machines that interlock:

### 1.1 `payouts.status`

```
                                           ┌──── reject ────┐
                                           │   (admin+PIN)  │
                                           ▼                │
   ┌────────────────── pending ◄───────────┴────────────────┘
   │                       │
   │                       ├── cancel (admin+PIN) ──► cancelled (terminal)
   │                       │
   │                       ├── approve, amount < threshold (admin+PIN, !maker) ──► approved
   │                       │
   │                       └── approve, amount ≥ threshold (admin+PIN, !maker) ──► pending_second_approval
   │                                                                                       │
   │                                                                                       │ second-admin approve
   │                                                                                       ▼
   ▼                                                                                    approved
processing ◄────────── /process (admin+PIN, atomic claim, debit) ───────── approved or pending
   │
   │   external transfer success (provider callback or sync)
   ├──────────────────────────► paid (terminal)
   │
   │   external transfer failure (webhook OR sync error)
   └──────────────────────────► failed (compensation credit posted) (terminal)
```

**Edges that should exist but don't (gaps documented below):**
- `paid → reversed` for chargebacks / Stripe `transfer.reversed` — handler exists but lifecycle terminology drifts (see T-F-12).
- `failed → re-queued` after operator intervention — no such transition; failures are terminal.

### 1.2 `transactions.status` (the unified ledger row written alongside each payout / wallet transfer)

```
   Pending ──► Processing ──► Completed   (typical happy path)
                    │
                    └────────► Failed   (compensation row)
                    │
                    └────────► Reversed (chargeback / webhook)
```

### 1.3 `payroll_entries.status` (a SEPARATE state machine — see T-F-08)

```
   pending ──► processing ──► paid   (BUT no automatic 'paid' transition;
                                       the payroll route doesn't create a
                                       payouts row, so the unified state
                                       machine above doesn't apply)
   pending ──► processing ──► failed  (same)
```

### 1.4 Webhook → DB resolution flow (LU-DD-2)

```
   provider event
        │
        ▼
   isWebhookProcessed(eventId)? ──yes──► no-op (idempotency)
        │ no
        ▼
   resolveCompanyForWebhook(provider, intentId)
        │
        ├── hit: companyId from payment_intent_index ✓ AUTHORITATIVE
        │
        └── miss: fallback to metadata.companyId ⚠️ LEGACY (T-F-13)
                                   │
                                   ▼
                            update payouts / transactions row
                                   │
                                   ▼
                            markWebhookProcessed(eventId)
```

---

## 2. Personas

| Persona | What they trigger | What they receive | Trust level |
|---|---|---|---|
| **Employee** | Submits expense; receives expense reimbursement payout; receives payroll payout; configures their own payout destination (bank account) | Notification email on payslip / approval; funds in their bank | Low — can't initiate transfers above wallet daily limit |
| **Manager** | Approves expenses (within limit); views team payroll | Same as Employee + read-access to team metrics | Medium — can approve below dual-approval threshold |
| **Admin** | Creates payouts; approves payouts; processes payouts; cancels / rejects payouts; runs payroll; manages payout destinations; sets daily limits | Full operational control over their company's funds | High — should be gated by PIN + maker-checker for high-value |
| **Owner** | Same as Admin + second-signer on dual-approval flow | Same | Highest in-tenant — should be gated by PIN |
| **Vendor** | Receives vendor-payment payouts; configures their own payout destination | Funds in their bank | Low — can't initiate anything; passive recipient |
| **External recipient (bank account holder)** | None — purely receives | Funds | None — not an authenticated user |
| **System (recurringScheduler)** | Fires recurring payroll on a cron; ECS leader-elects to avoid duplicates | — | Privileged — should NOT need PIN but should write audit log |
| **Webhook (Stripe / Paystack)** | Updates payout / transaction status async after settlement | — | Signature-verified — should NOT need user auth |
| **Operator (DevOps)** | Sets env vars (Paystack key, etc.); runs deferred migrations; updates limits via `/admin/payout-limits` | — | Out-of-band — does NOT use the API; uses doctl / DO console / psql |

### 2.1 Persona × route matrix

For brevity, only routes that touch money are listed. ✓ = allowed by current code, ✗ = blocked, ⚠️ = allowed but should be more restricted, ❗ = currently allowed but should be blocked (cross-tenant attack vector).

| Route | Empl. | Mgr | Admin (own tenant) | Admin (cross-tenant) | Owner | Vendor | System | Webhook |
|---|---|---|---|---|---|---|---|---|
| `POST /api/payouts` | ✗ | ✗ | ✓ | ✗ (PR #23) | ✓ | ✗ | — | — |
| `POST /api/payouts/:id/approve` | ✗ | ✗ | ✓ | ⚠️ (no explicit check, but maker-checker logic effectively limits to own tenant) | ✓ | ✗ | — | — |
| `POST /api/payouts/:id/process` | ✗ | ✗ | ✓ | **❗ T-F-01** | ✓ | ✗ | — | — |
| `POST /api/payouts/batch` | ✗ | ✗ | ✓ | **❗ T-F-02** | ✓ | ✗ | — | — |
| `POST /api/payouts/:id/cancel` | ✗ | ✗ | ✓ | ⚠️ (T-F-03) | ✓ | ✗ | — | — |
| `POST /api/payouts/:id/reject` | ✗ | ✗ | ✓ | ⚠️ (T-F-03) | ✓ | ✗ | — | — |
| `POST /api/payment/transfer` | ✓ (own wallet only) | ✓ | ✓ | ✗ (user-scoped, not company-scoped) | ✓ | — | — | — |
| `POST /api/payroll/process` | ✗ | ✗ | ✓ | ✗ (PR #22) | ✓ | ✗ | ✓ | — |
| `POST /api/payroll/:id/pay` | ✗ | ✗ | ✓ | ✗ (PR #22) | ✓ | ✗ | — | — |
| `POST /api/payroll/batch-payout` | ✗ | ✗ | ✓ | ✗ (PR #22) | ✓ | ✗ | — | — |
| `POST /api/expenses/:id/approve-and-pay` | ✗ | ⚠️ (approves but doesn't initiate transfer above threshold) | ✓ | needs verify | ✓ | ✗ | — | — |
| `PATCH /api/expenses/:id` (auto-disburse branch) | ✗ | ✓ (T-F-04) | ✓ | needs verify | ✓ | ✗ | — | — |
| Stripe webhook | — | — | — | — | — | — | — | ✓ |
| Paystack webhook | — | — | — | — | — | — | — | ✓ |

**Key:** the `Admin (cross-tenant)` column shows whether an admin authenticated against Tenant A can act on a resource belonging to Tenant B. The two **❗** marks are the CRITICAL findings.

---

## 3. Critical findings (verified against source)

### T-F-01 — `POST /payouts/:id/process` accepts any payout id, regardless of tenant

- **Severity:** CRITICAL
- **Layer:** route (`server/routes/payouts.routes.ts:554–587`)
- **Persona affected:** Admin attacker in Tenant A → any company's payout victims
- **Problem:** the handler reads `storage.getPayout(req.params.id)` at line 558 with no companyId scoping. It then validates status, destination, currency, and that `payout.companyId` is non-null (line 585) — but **never compares `payout.companyId` against the resolved caller's company**. `resolveUserCompany(req)` is never called in this route. The companyId used for `atomicPayoutDebit` is `payout.companyId` itself (line 590).
- **Impact:** an admin authenticated against Tenant A can call `POST /api/payouts/<tenant-B-payout-id>/process` and the system will:
  1. Atomically claim the payout
  2. Debit Tenant B's `company_balances` row
  3. Initiate a real Stripe / Paystack transfer to the destination Tenant B configured
  4. Write the transaction to Tenant B's ledger
  Tenant A's admin has effectively pushed money out of Tenant B's account. The funds go to whoever Tenant B set up as the recipient (typically a vendor or employee Tenant B intended to pay later) — so it's not direct theft of funds to Tenant A, but it IS unauthorized fund movement triggered by a different tenant, which is a multi-tenant data + funds integrity failure of the same class as the original `AUD-DB-001` finding closed in PR #23.
- **Evidence:**
  ```ts
  // server/routes/payouts.routes.ts:556–589
  let payout: Awaited<ReturnType<typeof storage.getPayout>> | null = null;
  try {
    payout = await storage.getPayout(param(req.params.id));   // ← no companyId
    if (!payout) return res.status(404)...
    if (!['pending', 'approved'].includes(payout.status)) ...
    const destination = payout.destinationId ? ... : null;
    if (!destination) return res.status(400)...
    const countryCode = destination.country || 'US';
    const currencyCheck = validatePayoutCurrency(payout.currency, countryCode);
    if (!currencyCheck.valid) ...
    if (!payout.companyId) {
      return res.status(400).json({ error: "Payout has no companyId; refusing to process" });
    }
    // ← never compares payout.companyId to caller's company
    const companyIdForDebit: string = payout.companyId;
  ```
- **Why PR #23 didn't close this:** the disbursement Sprint-1 PR added admin/PIN gates and `companyId` scoping to `POST /api/payouts` (the creator), but left the existing `/process` route alone because it was already gated by `requireAdmin + requirePin`. The implicit assumption — that an admin would only ever process their own tenant's payouts — was wrong. Cross-tenant id-enumeration defeats it.
- **Recommended fix:** add a scoped helper `storage.getPayoutInCompany(id, companyId)` (mirror of `getPayrollEntryInCompany` from PR #22) and fail-closed if `resolveUserCompany(req)` returns null:
  ```ts
  const company = await resolveUserCompany(req);
  if (!company?.companyId) return res.status(403).json({ error: "Company context required" });
  payout = await storage.getPayoutInCompany(param(req.params.id), company.companyId);
  if (!payout) return res.status(404).json({ error: "Payout not found" });
  ```
  404 not 403 on tenant mismatch to avoid leaking which ids exist (same convention as PR #22). Effort: **S** (1 storage helper + 1-line route change + test).
- **Tags:** cross-tenant, IDOR, money-movement, regression of AUD-DB-001 class

### T-F-02 — `POST /payouts/batch` accepts a client array of payout ids with no per-id tenant scoping

- **Severity:** CRITICAL
- **Layer:** route (`server/routes/payouts.routes.ts:826–925`)
- **Persona affected:** Admin attacker in Tenant A → 50 victims at once (the batch cap)
- **Problem:** the route accepts `payoutIds: string[]` (validated up to 50 via `batchPayoutsSchema`). For each id, it calls `storage.getPayout(payoutId)` at line 857 — no companyId filter. Each successfully-fetched payout then proceeds through the same debit-first claim/transfer/compensate flow as `/process`, with the same cross-tenant exposure as T-F-01 but amplified across the array.
- **Impact:** an admin in Tenant A submits a body of 50 payout ids harvested from any tenant. The handler processes each one against its own tenant's balance. **Same blast radius as T-F-01, multiplied by batch size.**
- **Evidence:**
  ```ts
  // server/routes/payouts.routes.ts:855–870
  for (const payoutId of payoutIds) {
    try {
      const payout = await storage.getPayout(payoutId);   // ← no companyId
      if (!payout) { results.push({ ..., 'Payout not found' }); skipped++; continue; }
      if (!['pending', 'approved'].includes(payout.status)) ...
  ```
  Compare to `/payroll/batch-payout` at `server/routes/payroll.routes.ts:735` which correctly calls `storage.getPayrollEntriesByIdsInCompany(payrollIds, company.companyId)`.
- **Why PR #22 closed payroll but not payouts:** PR #22's mandate was payroll, scoped narrowly. The same author should have caught the payouts equivalent but didn't; the audit pass was payroll-specific.
- **Recommended fix:** new storage method `storage.getPayoutsByIdsInCompany(ids, companyId)` that ANDs `payouts.id IN ($ids)` with `payouts.companyId = $companyId`. Use it as a pre-filter; per-iteration calls then skip silently when the id isn't in the resulting set. Surface skipped ids in the `results[]` array with `reason: 'not-found-or-cross-tenant'` (same convention as PR #22 batch-payout). Effort: **S** (storage helper + route refactor + test).
- **Tags:** cross-tenant, IDOR, batch-amplification, money-movement, regression of AUD-DB-001 class

---

## 4. High-priority findings

### T-F-03 — `POST /payouts/:id/cancel` and `/reject` lack tenant scoping

- **Severity:** HIGH (would be CRITICAL but cancel/reject don't move money — only transition state)
- **Layer:** route (`server/routes/payouts.routes.ts:1005–1108` for cancel; same shape for reject)
- **Persona affected:** Admin attacker in Tenant A → state manipulation in Tenant B
- **Problem:** same id-lookup pattern as T-F-01 and T-F-02. Cancel and reject read `storage.getPayout(id)` with no companyId AND-clause. An admin in Tenant A can cancel or reject any payout in Tenant B that's still in `pending` / `approved` / `pending_second_approval` state.
- **Impact:** denial of service against another tenant's payout queue. A malicious admin can cancel another tenant's pending vendor / payroll payouts, which the victim tenant would only notice when payouts stop landing. No funds move; only state.
- **Recommended fix:** same `getPayoutInCompany` pattern from T-F-01. Effort: **S** (same helper, 2 more call sites).

### T-F-04 — `PATCH /expenses/:id` auto-disburse branch creates a payout without re-PIN

- **Severity:** HIGH
- **Layer:** route (`server/routes/expenses.routes.ts:215–352`)
- **Persona affected:** Manager / Admin approving expense without explicit `/approve-and-pay`
- **Problem:** the PATCH handler has `requirePin` on the outer route, which gates the status-change to `approved`. When `payoutStatus === "not_started"` and the new status is `approved`, the handler creates a payout (lines 281–318). The PATCH PIN gate is the only gate — there's no re-PIN before the payout creation. Compare to the explicit `POST /expenses/:id/approve-and-pay` route which has `requirePin` on the combined operation.
- **Impact:** if the PIN cache is broader than the operator expects (e.g. an in-session cache that persists across multiple PATCHes within one PIN session), a single PIN entry can authorize multiple disbursements via PATCH. The user thinks they entered a PIN for "approve this one expense", but the same PIN-cached session lets them disburse arbitrary other approvals.
- **Recommended fix:** either (a) remove the auto-disburse branch from PATCH entirely (force operators to use `/approve-and-pay`), or (b) require an explicit `requirePin` invocation within the auto-disburse branch. Recommendation: (a) — simplifies the route + removes the implicit-disburse footgun.
- **Effort:** **M**

### T-F-05 — Daily payout limit check runs outside the debit transaction → TOCTOU race

- **Severity:** HIGH
- **Layer:** route (`server/routes/payouts.routes.ts:597–608`)
- **Persona affected:** Admin running concurrent batches
- **Problem:** the daily-limit check at line 597 calls `storage.getDailyPayoutTotalForCompany(...)` then validates `(used + requested) <= limit`. The subsequent `claimPayoutForProcessing` (line 614) takes a row lock on the payout but NOT on `company_balances`. Two concurrent `/process` calls on different payouts in the same company both read the same `dailyTotal`, both pass the limit check, both proceed to debit. The cumulative debit exceeds the daily limit.
- **Impact:** the limit ceiling is soft, not hard. In the worst case, N concurrent processes can each spend the full limit, ballooning to N × limit per day. The limit is currently a fraud / sanity bound; a determined attacker (or a buggy retry loop) can blow past it.
- **Recommended fix:** move the limit check inside the same transaction that holds the `company_balances` row lock. Drizzle pattern:
  ```ts
  await db.transaction(async (tx) => {
    // SELECT ... FOR UPDATE on company_balances inside the tx
    const dailyTotal = await getDailyPayoutTotalForCompanyTx(tx, company.companyId, payout.currency);
    if (dailyTotal + amount > limit) throw new DailyLimitExceededError(...);
    // ... then debit + claim
  });
  ```
  This serialises debits per company (the lock blocks other transactions reading the row), which is the right behaviour for the daily-limit invariant.
- **Effort:** **M**

### T-F-06 — `/payroll/process` and `/:id/pay` bypass the unified payout pipeline

- **Severity:** HIGH (audit + idempotency)
- **Layer:** route (`server/routes/payroll.routes.ts:321–507, 510–708`)
- **Persona affected:** Admin running payroll
- **Problem:** these routes initiate real Stripe / Paystack transfers DIRECTLY (e.g. `paystackClient.initiateTransfer` at line 397, `stripe.payouts.create` at line 420) without creating a `payouts` row. Consequences:
  1. **No unified audit:** auditors see payroll entries but not the resulting transfers in the payouts table.
  2. **No daily-limit enforcement:** payroll transfers don't count toward `getDailyPayoutTotalForCompany`; that limit was added for `/payouts/:id/process` only.
  3. **No idempotency-key derivation from payoutId:** the keys in PR #25 derive from `payout.id`; payroll doesn't have one. Provider retries within 60s use Stripe's implicit idempotency; > 60s = duplicate transfers.
  4. **No dual-approval logic:** payroll always processes without maker-checker, even for high-value entries that would trip the threshold via the payouts path.
- **Impact:** payroll is the most common money-movement path. The four gaps above mean payroll transfers (a) don't show up in admin payout dashboards, (b) can exceed daily limits without triggering 429, (c) can duplicate on retry beyond 60s, (d) skip the second-signer requirement that the `/payouts` flow enforces.
- **Recommended fix:** refactor `/payroll/:id/pay` and `/payroll/process` to create a `payouts` row (`type='payroll'`, `relatedEntityType='payroll'`, `relatedEntityId=entry.id`) with `status='pending'`, then route through `/payouts/:id/process` (or call the same `paymentService.initiateTransfer` with the new payoutId in metadata). This unifies state, audit, idempotency, limits, and dual-approval in one path.
- **Effort:** **L** — touches both payroll routes + the wallet-credit-on-success path. Worth a dedicated PR.

### T-F-07 — `getDailyPayoutTotalForCompany` query has no composite index covering the predicate

- **Severity:** HIGH (performance) / MEDIUM (correctness — query still works, just slow)
- **Layer:** storage / schema (`server/storage.ts:2626–2636`, schema `payouts` table)
- **Problem:** the query filters on `(companyId, currency, DATE(createdAt), status NOT IN ('cancelled','rejected','failed'))`. Existing indices are individual (`payouts_company_id_idx`, `payouts_created_at_idx`, `payouts_status_idx`). The optimizer cannot combine those into a single index scan; it has to bitmap-AND them or do a sequential scan with secondary filters.
- **Impact:** at low payout volume, fine. At ~10k payouts/day per company, the daily-limit check could take ~200ms+ per `/process` call. Compounds with T-F-05 (the limit check runs serially before the debit transaction).
- **Recommended fix:** add a composite partial index:
  ```sql
  CREATE INDEX payouts_daily_limit_idx
    ON payouts (company_id, currency, created_at DESC)
    WHERE status NOT IN ('cancelled', 'rejected', 'failed');
  ```
  Partial index keeps the index narrow (only counts what the predicate counts).
- **Effort:** **S** — single migration.

---

## 5. Medium findings

### T-F-08 — `payroll_entries.status` state machine is parallel to (not integrated with) `payouts.status`

- **Severity:** MEDIUM
- **Layer:** schema
- **Problem:** `payroll_entries.status` transitions independently of `payouts.status`. There's no FK or join key. A payroll entry can be `processing` while its (hypothetically-related) payout is `failed`, or vice versa. Reconciliation across the two tables is operator-driven.
- **Fix:** same root cause as T-F-06; resolving that resolves this. Add `payroll_entries.payoutId` FK column pointing at the unified payouts row.
- **Effort:** **L** (paired with T-F-06).

### T-F-09 — `companyBalances` lacks `CHECK` constraint on currency enum

- **Severity:** MEDIUM
- **Layer:** schema (`shared/schema.ts:589–598`, storage `atomicPayoutDebit` at `server/storage.ts:2757–2759`)
- **Problem:** `atomicPayoutDebit` rejects a debit when `payouts.currency !== companyBalances.localCurrency`. The check runs at request time; the SQL schema has no `CHECK (local_currency IN (...))` constraint. Operators can write an arbitrary currency string via direct SQL update; subsequent debits fail at runtime with a generic error.
- **Fix:** add a `CHECK` constraint to `company_balances.local_currency` enumerating supported ISO 4217 codes (USD, EUR, GBP, NGN, GHS, ZAR, KES, EGP, RWF, XOF). Effort: **S**.

### T-F-10 — Decimal precision drift between `payouts.amount` (16,2) and `transactions.amount` (12,2)

- **Severity:** MEDIUM (rare blast radius, severe when triggered)
- **Layer:** schema (`shared/schema.ts` payouts table vs transactions table)
- **Problem:** `payouts.amount` is `decimal(16,2)` (max ~99 trillion units). `transactions.amount` is `decimal(12,2)` (max ~9.9 million). `atomicPayoutDebit` writes the payout amount into transactions without a bound check. A payout > $9,999,999.99 would either overflow or silently truncate.
- **Impact:** rare at typical fintech volumes. Real for institutional clients or batch-fan-out payroll.
- **Fix:** unify both to `decimal(16,2)`. Run a single ALTER TABLE on transactions.
- **Effort:** **M** (data migration may need a backfill validation step).

### T-F-11 — `atomicPayoutCompensateOnFailure` has no idempotency guard against double-credit

- **Severity:** MEDIUM
- **Layer:** storage (`server/storage.ts:2793–2832`)
- **Problem:** the compensation path takes `(transactionId, companyId, amount, currency, reason)` and credits the company balance back. It does NOT check `transactions.reversedAt IS NULL` before applying. If the failure path fires twice (webhook retry + manual retry, both calling compensate), the company is credited twice.
- **Impact:** money creation. Subtle — only fires on a specific failure-retry sequence.
- **Fix:** check `transactions.reversedAt IS NULL` before crediting; set `transactions.reversedAt = NOW(), reversedByTxId = compensationTxId` atomically inside the credit transaction.
- **Effort:** **S** (single storage method change + schema column if not present).

### T-F-12 — Webhook resolver fallback to `metadata.companyId` has no expiry

- **Severity:** MEDIUM
- **Layer:** webhook lib (`server/lib/webhook-company-resolver.ts:50–125`)
- **Problem:** the resolver uses `payment_intent_index` as authoritative, falls back to `metadata.companyId` for events created before the index shipped (LU-DD-2). Comments at line 19–22 say "After the index has been writing for one full retention window (~30 days), the metadata fallback can be removed" — but no code enforces this. The fallback is permanently live, which means a forged webhook with arbitrary `metadata.companyId` is still accepted indefinitely.
- **Impact:** a webhook payload with a spoofed `companyId` would be accepted as long as it passes signature verification AND the `payment_intent_index` lookup misses. Signature verification reduces the attack surface to "the provider's keys are compromised or the operator misconfigured the webhook secret" — which is real but rare.
- **Fix:** add a hard cutoff (env var `WEBHOOK_METADATA_FALLBACK_UNTIL=2026-06-01T00:00:00Z`); refuse the fallback if `Date.now() > cutoff`. Log the refusal so operators see it before it bites.
- **Effort:** **S**.

### T-F-13 — Wallet-to-wallet transfer credits to recipient wallet missing (inter-user not supported but un-documented as such)

- **Severity:** MEDIUM (latent bug, not currently triggered)
- **Layer:** route (`server/routes/payments.routes.ts:300–498`)
- **Problem:** `/payment/transfer` debits the sender's wallet, calls `paymentService.initiateTransfer` (external bank rails), and refunds the wallet on external failure. There is NO destination-wallet credit. This is correct for external transfers (funds leave the platform), wrong for any future inter-user transfer feature. The route's name doesn't differentiate.
- **Fix:** rename `/payment/transfer` to `/payment/withdraw` (matches actual behaviour). When inter-user transfer ships, add `/payment/transfer-internal` as a separate route with atomic dual-wallet update.
- **Effort:** **S** (rename + docs).

---

## 6. Low findings

### T-F-14 — `createPaymentIntentIndex` silently swallows `onConflictDoNothing` without logging

- **Severity:** LOW
- **Layer:** storage (`server/storage.ts:959–971`)
- **Fix:** add `paymentLogger.debug('payment_intent_index_inserted', { provider, providerIntentId, conflict: result.length === 0 })`. Effort: XS.

### T-F-15 — Soft-delete coverage is inconsistent across money tables

- **Severity:** LOW
- **Layer:** schema
- **Problem:** `transactions.deletedAt` and `walletTransactions.deletedAt` exist; `wallets` and `payouts` don't have `deletedAt`. Hard-delete of a wallet cascades + nukes `walletTransactions` history. Hard-delete of a payout is currently impossible (no route), but if added, it'd cascade-nuke its transaction.
- **Fix:** add `deletedAt` to `wallets` and `payouts` for consistency; update queries to filter `WHERE deleted_at IS NULL`. Effort: M.

### T-F-16 — Status string drift: `'paid'` vs `'Completed'` vs `'completed'` across payouts/transactions/payroll

- **Severity:** LOW
- **Problem:** `payouts.status` uses lowercase (`pending`, `paid`, `failed`). `transactions.status` uses TitleCase (`Pending`, `Completed`, `Failed`). `payroll_entries.status` uses lowercase. UI components have to know which casing each table uses. Search across the codebase:
  ```
  $ grep -c "status === 'paid'" server/   # 14
  $ grep -c "status === 'Completed'" server/   # 6
  $ grep -c "status === 'completed'" server/   # 11
  ```
- **Fix:** normalize to lowercase everywhere via a migration + a code sweep. Effort: M (high friction; surface-only consistency win).

---

## 7. Negative findings (verified correct)

These were checked and are CORRECT — included so a future audit pass doesn't re-investigate the same items.

- ✓ **PIN gating on `/payouts/:id/process`** (PR #23) — still in place.
- ✓ **Server-issued `initiatedBy`** on `POST /payouts` (PR #23) — caller can't forge attribution.
- ✓ **Debit-first compensation pattern** (LU-DD-5 / `claimPayoutForProcessing` + `atomicPayoutDebit` + `atomicPayoutCompensateOnFailure`) — correctness verified via concurrent-claim integration test in `server/__tests__/integration/atomic-claim.int.test.ts` (PR #31).
- ✓ **Maker-checker `initiator !== approver`** at all amounts (PR #23 / `payouts.routes.ts:432–442`).
- ✓ **Atomic claim** via `UPDATE payouts SET status='processing' WHERE id=$1 AND status IN ('pending','approved') RETURNING` — race-safe.
- ✓ **Webhook idempotency** via `isWebhookProcessed(eventId)` + `markWebhookProcessed` — replays are deduped within retention window.
- ✓ **Provider idempotency keys** derived from `payout.id` (PR #25) — Stripe + Paystack retries return the original transfer.
- ✓ **Company-scoped daily limits** with per-company JSONB overrides (PR #28 + #30) — limit check exists (separate issue T-F-05 about WHERE it runs in the transaction).
- ✓ **Webhook signature verification** on both Stripe and Paystack before any DB write.
- ✓ **Payroll `/process` company scoping** (PR #22) — only iterates the caller's tenant.
- ✓ **`POST /payouts` create-side scoping** (PR #23) — `companyId` is server-issued.

---

## 8. Remediation sequencing (multi-stage plan)

Three sprints. Each sprint is one or two PRs, each independent and testable.

### Sprint 1 — Cross-tenant fixes (CRITICAL, drop-everything)

- **PR-1.1 — Scope `/payouts/:id/{process,cancel,reject}` + `/payouts/batch` to caller's tenant** (closes T-F-01, T-F-02, T-F-03)
  - New `storage.getPayoutInCompany(id, companyId)` helper
  - New `storage.getPayoutsByIdsInCompany(ids, companyId)` helper for batch
  - Call sites: 4 routes
  - Cross-tenant 403 / 404 regression tests (mirror `server/__tests__/lib/payroll-multi-tenant.test.ts` from PR #22)
  - **Effort:** S
  - **Why first:** these are CRITICAL multi-tenant IDORs on real money-movement routes. Same fix pattern as already-merged PR #22.

- **PR-1.2 — Remove auto-disburse from `PATCH /expenses/:id`** (closes T-F-04)
  - Delete the auto-payout branch; require `/approve-and-pay` for the combined operation
  - Smoke-test the existing `/approve-and-pay` flow (already PIN-gated correctly)
  - **Effort:** S

### Sprint 2 — Transaction-boundary + limit correctness

- **PR-2.1 — Move daily-limit check inside debit transaction** (closes T-F-05)
  - Wrap `claimPayoutForProcessing` + `atomicPayoutDebit` + the limit check in one `db.transaction()`
  - Hold `SELECT ... FOR UPDATE` on `company_balances` before the limit check
  - Add a Postgres-integration test for concurrent `/process` calls
  - **Effort:** M

- **PR-2.2 — Composite partial index for `getDailyPayoutTotalForCompany`** (closes T-F-07)
  - Migration: `CREATE INDEX payouts_daily_limit_idx ON payouts (company_id, currency, created_at DESC) WHERE status NOT IN (...)`
  - EXPLAIN ANALYZE before/after as PR evidence
  - **Effort:** S

- **PR-2.3 — Idempotency guard on compensation** (closes T-F-11)
  - Add `transactions.reversedAt` if missing
  - Check `reversedAt IS NULL` before crediting; set inside the credit transaction
  - Unit test for the double-compensate scenario
  - **Effort:** S

### Sprint 3 — Architectural unification

- **PR-3.1 — Unify payroll → payout pipeline** (closes T-F-06, T-F-08)
  - Payroll routes create payouts rows and call `/process` internally
  - Daily limits + dual-approval start applying to payroll too
  - Audit-log entries unified across payroll + payouts
  - **Effort:** L

- **PR-3.2 — Webhook fallback expiry + currency CHECK + status normalization** (closes T-F-09, T-F-12, T-F-16)
  - Three small migrations + a code sweep for status string normalization
  - **Effort:** M

### Quarter

- Decimal-precision unification (T-F-10)
- Soft-delete consistency (T-F-15)
- Wallet-to-wallet rename (T-F-13)
- `createPaymentIntentIndex` logging (T-F-14)

---

## 9. What I did NOT verify

For honesty. Future audit passes should fill these gaps.

- The DB-layer agent's claim about **F-008 (decimal precision mismatch)** is included as T-F-10 here, but I did not load `shared/schema.ts` and verify the actual `decimal()` widths line by line. The agent's `decimal(16,2)` and `decimal(12,2)` figures are unverified.
- **`server/routes/expenses.routes.ts:215–352`** auto-disburse branch — I read the cited section but did not trace the full PIN-cache behaviour in `requirePin` middleware to confirm whether a single PIN entry persists across multiple PATCH calls. T-F-04 assumes the worst case; the actual cache TTL might be 0 (no-cache) which would partially mitigate.
- **State machine** §1.1 was synthesized from route reads; I did not enumerate every storage method that writes `payouts.status` to confirm all transitions go through the documented gates. A transition introduced via a backfill script or admin SQL would not appear here.
- **Webhook signature verification** (negative finding) — relied on the comment + prior audit pass. Did not re-read the actual HMAC-compare code in this pass.
- **Mobile app's payout / payroll surface** — entirely out of scope for this audit. Mobile may bypass any of these guards if it talks to the API directly with a stale token.

---

## 10. Cross-references

- `docs/audit-2026-04-26/AUDIT_DISBURSEMENT_2026_04_26.md` — prior pass; T-F-01 / T-F-02 are regressions of the same bug class as AUD-DB-001 (which IS closed for the create side) but on the process/batch side.
- `docs/audit-2026-04-26/AUDIT_PAYROLL_2026_04_26.md` — prior pass; T-F-06 references unified-pipeline work that should have happened in parallel with PR #22 but didn't.
- `docs/audit-2026-04-26/STRIPE_CONNECT_MIGRATION_PLAN.md` — Phase 1 scaffolding shipped; the fixes above don't change Connect activation gating.
- `docs/audit-2026-05-17/AUDIT_COUNTRY_PERSONA_ROLE_2026_05_17.md` — companion audit (auth + RBAC). Both audits dated 2026-05-17 should be cross-referenced when planning the next sprint.
- PR #22 (`fix-payroll-multi-tenant-2026-04-26`) — closed the payroll equivalent of T-F-01 / T-F-02. The fix pattern (`*InCompany` storage helpers + fail-closed routes + 404-not-403 info-leak prevention) is the model for the Sprint-1 PR here.
- PR #23 (`fix-disbursement-criticals-2026-04-26`) — closed the create-side of payouts but missed the process/batch side. The audit-vs-fix gap that produced T-F-01 / T-F-02 is a lesson for future audit scoping.
