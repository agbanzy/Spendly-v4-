# Stripe Connect Migration Plan — 2026-04-27

**Closes audit findings:** AUD-PR-010 (payroll), AUD-DB-010 (disbursement)
**Status:** Strategic plan — needs decisions from Godwin before implementation
**Estimated effort:** 6–10 engineering weeks across two phases

---

## 1. Why this exists

Two separate audit findings (`AUDIT_PAYROLL_2026_04_26.md` AUD-PR-010 and `AUDIT_DISBURSEMENT_2026_04_26.md` AUD-DB-010) flagged the same problem: the Stripe-side payout path uses Stripe's **legacy bank-token model** (`stripe.tokens.create({ bank_account: ... })` → `stripe.payouts.create({ destination: token.id })`). Specifically:

```ts
// server/paymentService.ts:281–290
const token = await stripe.tokens.create({
  bank_account: bankAccountParams as any,
});
destinationBankAccountId = token.id;
```

```ts
// server/paymentService.ts:293–309 (the actual money-movement call)
const payout = await stripe.payouts.create({ ... destination: token.id ... });
```

This is the pre-Connect API. Stripe themselves have moved their docs and best-practice guidance to **Connect Express / Custom accounts**. The legacy path still works but creates three operational frictions documented below.

The Paystack side already uses the recipient model (`paystackClient.createTransferRecipient` → `paystackClient.initiateTransfer`), which is the Paystack equivalent of Connect. The migration scope is **Stripe only**.

---

## 2. The three frictions

### 2.1 PCI scope creep (AUD-PR-010 / AUD-DB-010 main concern)

In the current flow, **bank account numbers + routing numbers transit our server** to reach `stripe.tokens.create`. They live in `payout_destinations.account_number` and `payout_destinations.routing_number` columns (`shared/schema.ts`), and they pass through `server/routes/payouts.routes.ts:626–631` on every `/process` and `/batch` call.

This isn't card data, so it isn't PCI-DSS proper. But:
- AWS RDS where the columns are stored is in the data-handling perimeter
- Backups, logs, and any read replica also carry the data
- A SOC 2 Type II audit will flag the pattern as a "data-minimization weakness" even if it isn't a PCI item per se
- Some banking partners (especially in EU/UK) flag direct bank-detail handling as requiring additional licensing under PSD2 / FCA RAG

In the **Connect Express model**, the employee/vendor onboards via Stripe-hosted forms (Express dashboard or embedded onboarding components). We never touch the bank number; we only ever hold a `acct_*` ID. PCI/SOC scope drops.

### 2.2 Reconciliation friction

The legacy `stripe.payouts.create` charges the platform's own Stripe balance. So a $5,000 employee payout in our system creates one $5,000 debit on the platform Stripe account. The mapping back to "which employee, which company, which payroll period" lives **only in the payout's metadata field**, which we have to set carefully every time.

We do thread `companyId` and `userId` through metadata (LU-DD-2 / `paymentService.ts:306–307`), but reconciliation under audit is still painful: "give me a list of every payment made on behalf of Tenant X in March" requires querying our own DB plus filtering Stripe events on `metadata.companyId`. There's no cleaner Stripe-native answer.

In the Connect model, each connected account has its own ledger inside Stripe. A balance enquiry on Tenant X's Connect account answers the question directly. Stripe-native reporting plus external audits get easier.

### 2.3 No employee onboarding flow

The current path has us collecting bank details out-of-band (via the "Add payout destination" form in `client/src/pages/admin-payouts.tsx`) and storing them. The employee never directly interacts with Stripe.

In the Connect Express model, the employee receives an onboarding link and completes verification on a Stripe-hosted page. They confirm:
- Identity (name, DoB, last-4 SSN/EIN, etc. — **Stripe owns this verification**)
- Bank details (entered on Stripe's domain, never on ours)
- Agreement to Stripe's terms

Operational benefit: Stripe handles the KYC headache. Compliance benefit: we don't store the data. UX benefit: employees see a familiar, branded-by-us-but-hosted-by-Stripe form.

---

## 3. Migration approach — three phases

### Phase 1 — Connect Express setup + parallel-write pilot (3 weeks)

**Goal:** ship a `stripe_connect_account_id` column on `payout_destinations`, an onboarding-link generator, and parallel-write code paths so a single tenant can opt into Connect while the rest stay on the legacy flow.

**Scope:**
1. **Stripe dashboard work** (Godwin / ops):
   - Enable Stripe Connect on the existing platform account
   - Decide between Express (Stripe-hosted dashboard, Stripe handles KYC + tax forms) and Custom (we own the dashboard UI, more PCI scope back). **Recommendation: Express.**
   - Choose the onboarding flow type: Standard Express link vs Embedded Connect onboarding. **Recommendation: Embedded** — keeps users inside our app for branding consistency.

2. **Schema change**:
   ```sql
   ALTER TABLE payout_destinations
     ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
     ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_status text;
   ```
   `stripe_connect_account_id` holds the `acct_*` ID once the employee finishes onboarding. `stripe_connect_onboarding_status` holds `'not_started' | 'pending' | 'verified' | 'restricted'` so the UI can render the right next-step button.

3. **New endpoint**: `POST /api/payout-destinations/:id/onboard-stripe`. Calls `stripe.accountLinks.create({ account, return_url, refresh_url, type: 'account_onboarding' })` and returns the URL. Frontend opens it in a new window or embeds it via the Connect React component.

4. **Webhook**: subscribe to `account.updated` events; store the new `verified` / `restricted` status. Reuse the existing webhook signature verification + LU-DD-2 `payment_intent_index` pattern (extend the index to cover `account.*` events).

5. **Per-company opt-in flag**: extend `companies.dailyPayoutLimits` (already JSONB from PR #30) or add a separate `companies.payoutFlags jsonb` column with `{ useStripeConnect: true }` so opt-in is cohort-controllable without redeploying.

6. **Parallel-write payment service**: in `paymentService.ts:initiateTransfer`, when `recipientDetails.stripeConnectAccountId` is present AND the company flag is on, use:
   ```ts
   const transfer = await stripe.transfers.create(
     { amount: Money.toMinor(amount), currency, destination: stripeConnectAccountId, description: reason },
     { idempotencyKey: `txfr-payout-${payoutId}` },  // (already in PR #25)
   );
   ```
   Otherwise fall through to the legacy `stripe.tokens.create` + `stripe.payouts.create` path. **No removal yet.**

**Deliverables:** a working Connect onboarding for one pilot tenant; parallel-write code paths; metrics dashboard showing legacy-vs-Connect transfer counts.

**Decision points needing Godwin:**
- Pilot tenant choice (probably an internal Innoedge subsidiary, not a paying customer)
- Express vs Custom model (default: Express)
- Embedded vs hosted onboarding (default: embedded)
- Whether to require Connect for new tenants from day-1 of Phase 2 vs leave it opt-in until cutover

### Phase 2 — Cohort migration (3–4 weeks, depending on customer count)

**Goal:** move every existing tenant off the legacy path one cohort at a time. Each cohort is a 1-week soak: enable Connect for cohort N, watch for issues, advance to cohort N+1.

**Scope:**
1. **Customer-comms templates** (legal + ops co-author):
   - "Action required: re-link your payout destination" email per recipient
   - Admin dashboard banner explaining the change for tenants
   - FAQ covering "why is Stripe asking for my bank details again" and "what changes for me"

2. **Backfill / one-time migration**: for each existing `payout_destinations` row, generate a Stripe Connect onboarding link and email the recipient. **Cannot programmatically migrate** — Stripe requires the employee/vendor to consent to the new account terms, so we have to send them through onboarding fresh.

3. **Cohort cutover script**: for each tenant in cohort N:
   - Set `companies.payoutFlags = { useStripeConnect: true }`
   - Email all employees/vendors with onboarding links
   - Monitor `stripe_connect_onboarding_status` rollup
   - At end of cohort week: reject new payouts to non-onboarded recipients with a clear error ("This employee hasn't completed Stripe onboarding yet")

4. **Pause point at end of Phase 2**: hold for at least a full pay cycle (so every employee has had at least one Connect-routed paycheck) before Phase 3.

**Decision points needing Godwin:**
- Cohort size (recommendation: 3–5 tenants per week to keep support load manageable)
- Cohort ordering (recommendation: smallest first, then by tenant tier — gold/strategic last)
- How to handle vendors that refuse to re-onboard (recommendation: 30-day grace period during which the legacy path still works for that specific destination, after which payouts are blocked)

### Phase 3 — Sunset legacy + cleanup (1 week)

**Goal:** remove the legacy code path entirely. Drop the bank-detail columns. Pass the resulting code to a SOC 2 / PCI auditor for the data-minimization win.

**Scope:**
1. **Code removal**:
   - Delete the `stripe.tokens.create({ bank_account })` block in `paymentService.ts:280–290`
   - Delete the `destination: destinationBankAccountId` arm of `stripe.payouts.create` (line 298). Keep only `stripe.transfers.create` (Connect path).
   - Replace the `paystackClient.initiateTransfer` recipient-creation block with a `paystackRecipientId` lookup (Paystack already uses recipients but caches per-call; pre-create on onboarding instead).
   - Remove parallel-write feature-flag checks; the Connect path is the only path.

2. **Schema cleanup migration** (deferred, like LU-DD-3 / 0014_drop_team_members):
   ```sql
   -- migrations-deferred/0017_drop_legacy_bank_columns.sql
   -- Operator promotes after verifying zero recent usage.
   ALTER TABLE payout_destinations
     DROP COLUMN account_number,
     DROP COLUMN routing_number,
     DROP COLUMN sort_code,
     DROP COLUMN bsb_number,
     DROP COLUMN iban;
   ```
   Keep `stripe_connect_account_id` as the only identifier. Operator runs this after the soak window when the legacy columns haven't been read for 90+ days.

3. **Update KYC flow** in `client/src/components/kyc-verification-form.tsx` to remove bank-detail fields. KYC now only collects identity; banking is Stripe's job.

4. **Compliance documentation**:
   - Update SOC 2 evidence to show data-minimization
   - Update privacy policy if it referenced bank-detail collection
   - Notify Innoedge legal of the scope reduction (might affect existing customer contracts that reference data handling)

**Decision points needing Godwin:**
- Sunset timing relative to financial year-end (recommendation: NOT during Q4 close)
- Whether to keep an emergency-fallback feature flag for 30 days post-sunset (recommendation: yes, behind a runtime env var, never enabled in production)

---

## 4. What this affects in the codebase

| File / area | Change | Phase |
|---|---|---|
| `shared/schema.ts:payoutDestinations` | Add `stripe_connect_account_id`, `stripe_connect_onboarding_status` | 1 |
| `shared/schema.ts:companies` | Add `payoutFlags jsonb` for opt-in | 1 |
| `migrations/00XX_stripe_connect_columns.sql` | New ADD COLUMN migration | 1 |
| `server/paymentService.ts:initiateTransfer` | Branch on `useStripeConnect` flag; new `stripe.transfers.create` path | 1 (parallel) → 3 (only path) |
| `server/routes/payouts.routes.ts` | Add `/payout-destinations/:id/onboard-stripe` route | 1 |
| `server/webhookHandlers.ts` | Subscribe to `account.updated`; index via LU-DD-2 pattern | 1 |
| `server/storage.ts` | New `setPayoutDestinationStripeAccountId(id, acct)` and `getStripeConnectStatus(destinationId)` helpers | 1 |
| `client/src/pages/admin-payouts.tsx` | "Onboard with Stripe" button + status display | 1 |
| `client/src/components/kyc-verification-form.tsx` | Remove bank-detail fields | 3 |
| `migrations-deferred/00XX_drop_legacy_bank_columns.sql` | Gated cleanup migration | 3 |

---

## 5. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Employees/vendors refuse to re-onboard during Phase 2 | 30-day grace period per destination; admin override available; clear customer-comms |
| Stripe Connect account hits "restricted" status mid-payout (KYC escalation, identity mismatch) | Webhook on `account.updated`; UI shows status; payout `/process` refuses with clear error |
| Pilot tenant's payouts fail and we need to roll back Phase 1 | Parallel-write means rollback is just `companies.payoutFlags = { useStripeConnect: false }` — no data migration needed |
| Stripe Connect platform account isn't approved by Stripe (rare but happens) | Phase 0: confirm approval before scheduling Phase 1 |
| Extra Stripe fee per Connect transfer | Confirm pricing during Phase 0; budget impact assessment |
| Breaks an existing audit-log query that filtered on Stripe `metadata.payoutId` | Already shipped in PR #25 (AUD-DB-004/005/006); metadata threading remains identical |

---

## 6. Cross-references

- **`AUDIT_PAYROLL_2026_04_26.md` §AUD-PR-010** — original payroll-side finding
- **`AUDIT_DISBURSEMENT_2026_04_26.md` §AUD-DB-010** — original disbursement-side finding (same root cause)
- **PR #25 `fix(payouts): Sprint-2 idempotency keys`** — the `payout-${id}` idempotency token already lands the metadata threading that Phase 1 needs
- **PR #21 / LU-DD-2** — the `payment_intent_index` pattern Phase 1 extends to cover `account.*` events
- **PR #30 / `companies.dailyPayoutLimits`** — companion JSONB column showing the per-company opt-in pattern works in production

---

## 7. Recommended next move

Schedule a 1-hour planning meeting with:
- Godwin (technical owner)
- Whoever owns Innoedge legal/compliance
- Whoever owns customer-comms

Walk through §3 phase-by-phase. The decision points marked **Decision points needing Godwin** are the only ones blocking implementation; everything else is mechanical.

Once those are decided, Phase 1 can ship as a single PR (~3 weeks of one engineer's time). Phases 2 + 3 are operational + customer-facing work that can't be PR-ified — they need a project plan with calendar dates, customer-comm scheduling, and a status meeting cadence.

---

## 8. What this doc is NOT

- It is not a technical spec — Phase 1 needs a more detailed implementation spec when the time comes (storage layer signatures, API request/response shapes, error codes)
- It is not a customer-comms plan — Phase 2 needs separate ops/marketing-owned documents
- It is not a contract — pricing impact and partnership-tier implications need legal review

It is the **plan-of-plans** that surfaces what needs to be decided so the work can start.
