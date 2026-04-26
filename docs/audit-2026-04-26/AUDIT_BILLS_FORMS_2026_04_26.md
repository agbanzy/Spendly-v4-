# Spendly v4 (Financiar) — Bill Payments + Forms Audit

**Date:** 2026-04-26
**Branch:** `fix-package-lock-drift` (this audit shipped alongside the lock-drift fix; the doc is purely informative — no schema or code change in this commit)
**Sibling docs:** [`AUDIT_2026_04_26.md`](AUDIT_2026_04_26.md), [`AUDIT_DEEP_DIVE_2026_04_26.md`](AUDIT_DEEP_DIVE_2026_04_26.md)
**Methodology:** Two parallel `Explore` agents producing ~60 raw findings; the highest-severity claims then **verified against current source**. Inaccurate agent claims are listed in §6 with the contradicting source citations.

---

## 1. Executive Summary

Two functional surfaces audited at the user's request:

1. **Bill payments + auto-completes** — the entire bill lifecycle from creation through utility-provider payments through approval → wallet debit, plus the small set of typeahead inputs across the app.
2. **All forms** — the validation posture of every form on every page (~60 forms identified across 35+ pages), with a focus on what's been migrated to shared Zod schemas and what's still hand-rolled.

After verification: **2 HIGH, 6 MEDIUM, ~30 LOW** findings stand. The CRITICAL claim about the public pay-invoice form ("amount manipulation") was **rejected on source inspection** — the server already clamps `paymentAmount = Math.min(requestedAmount, amountRemaining)` at [server/routes/invoices.routes.ts:177](../../server/routes/invoices.routes.ts), making upward tampering impossible.

The two genuinely-actionable bill findings are:

- **AUD-DD-BILL-001** — `DELETE /api/bills/:id` has no tenancy check. Any authenticated user can delete any bill across tenant boundaries.
- **AUD-DD-BILL-003** — Concurrent `POST /api/bills/:id/pay` calls can both pass the `bill.status === 'paid'` precheck (it lives outside `atomicBillPayment`'s transaction). The wallet's `SELECT FOR UPDATE` serialises the debits but the bill update happens twice with the same destination; under concurrency a customer could be double-debited until the wallet runs dry.

This PR's **lock-drift fix branch carries surgical fixes for both** so the merge unblocking sequence also closes them. Form-level findings are documented for follow-up — a dedicated LU-009-Phase-2 PR will migrate the next 5 forms to shared Zod schemas.

---

## 2. Bill payment surface

### 2.1 Endpoint inventory ([server/routes/bills.routes.ts](../../server/routes/bills.routes.ts))

| Method | Path | Auth | PIN | Tenancy check | Notes |
|---|---|---|---|---|---|
| GET | `/bills` | requireAuth | — | ✅ via `resolveUserCompany` + `getBills(companyId)` | |
| GET | `/bills/:id` | requireAuth | — | ✅ via `verifyCompanyAccess` | |
| POST | `/bills` | requireAuth | — | ✅ stamps `companyId` from caller | |
| PATCH | `/bills/:id` | requireAuth | — | ✅ before update | Blocks `status='paid'` to force /pay endpoint |
| **DELETE** | **`/bills/:id`** | **requireAuth** | — | **❌ NONE** | **AUD-DD-BILL-001 — verified** |
| POST | `/bills/:id/approve` | requireAuth + requireAdmin + requirePin | ✅ | ✅ | |
| POST | `/bills/:id/reject` | requireAuth + requireAdmin | ❌ no PIN | ✅ | AUD-DD-BILL-002 (MED) |
| POST | `/bills/:id/request-changes` | requireAuth + requireAdmin | ❌ no PIN | ✅ | AUD-DD-BILL-010 (MED) |
| POST | `/bills/pay` | requireAuth + requirePin + financialLimiter | ✅ | partial | Generic dispatcher; checks `bill.status` |
| POST | `/bills/:id/pay` | requireAuth + requirePin + financialLimiter | ✅ | ✅ | Atomic wallet debit + bill update |

### 2.2 Verified findings (with file:line)

| ID | Severity | Finding | File:line | Status |
|---|---|---|---|---|
| **AUD-DD-BILL-001** | HIGH | `DELETE /bills/:id` calls `storage.deleteBill(id)` directly with no `verifyCompanyAccess` check. Any auth'd user can delete any tenant's bill. | [server/routes/bills.routes.ts (delete bill route)](../../server/routes/bills.routes.ts) | **Fixed in this PR** |
| **AUD-DD-BILL-003** | HIGH | Race window: `bill.status === 'paid'` check happens *before* `atomicBillPayment` opens its DB transaction. Two concurrent calls can both observe `'unpaid'`, both enter the atomic op, both serialise on the wallet `FOR UPDATE`, and the first updates the bill to `'paid'` while the second's update is a no-op (already paid) BUT its wallet debit may have already happened by then. The wallet `availableBalance < amount` check inside the atomic op can still pass on the second call if the first hasn't committed when row read happens. Under sustained concurrent load on an over-funded wallet, customer can be double-debited. | [server/routes/bills.routes.ts (post pay route)](../../server/routes/bills.routes.ts), [server/storage.ts atomicBillPayment](../../server/storage.ts) | **Fixed in this PR** |
| AUD-DD-BILL-002 | MEDIUM | Reject endpoint doesn't require PIN. Inconsistent with approve. | [server/routes/bills.routes.ts](../../server/routes/bills.routes.ts) | Defer |
| AUD-DD-BILL-010 | MEDIUM | Request-changes endpoint doesn't require PIN. | [server/routes/bills.routes.ts](../../server/routes/bills.routes.ts) | Defer |
| AUD-DD-BILL-007 | MEDIUM | `computeNextDate` in `recurringScheduler.ts` uses raw `Date.setMonth` arithmetic. `Jan 31 + 1 month = Mar 3` (overflow), not `Feb 28`. | [server/recurringScheduler.ts:6-25](../../server/recurringScheduler.ts) | Defer — needs `date-fns/addMonths` semantics |
| AUD-DD-BILL-008 | MEDIUM | Same module: `Feb 29 (leap) + 1 year = Mar 1`. | [server/recurringScheduler.ts:6-25](../../server/recurringScheduler.ts) | Defer |
| AUD-DD-BILL-011 | MEDIUM | Bill-payment Stripe/Paystack provider purchase is **not implemented** for utility bills. The `/bills/:id/pay` endpoint debits the wallet and stamps `bill.status='paid'` — there is no provider call to actually deliver airtime/electricity. The PRD lists utility payments under Paystack markets (§7.4) but the route does not exercise the API. Either the feature is wired elsewhere (route-level), purely-record-keeping by design, or genuinely unimplemented. | [server/routes/bills.routes.ts (post pay)](../../server/routes/bills.routes.ts) | **Verify with product** |
| AUD-DD-BILL-012 | LOW | Provider field on bill schema is `z.string().min(2)` — no enum validation against the curated `utilityProvidersByRegion` list in [client/src/pages/bills.tsx](../../client/src/pages/bills.tsx). Free-text accepted. | [shared/schema.ts (bill schema)](../../shared/schema.ts) | Defer |

### 2.3 Auto-complete surfaces

| Surface | Source | Server validation | Findings |
|---|---|---|---|
| Expense category suggestion | Hardcoded keyword map ([client/src/pages/expenses.tsx](../../client/src/pages/expenses.tsx)) | `category: z.string().min(1)` — accepts any | AUD-DD-AC-001 (LOW) — free-text fallback |
| Vendor name on expense | Free text | `merchant: z.string().min(1)` | AUD-DD-AC-002 (LOW) — not constrained to registered vendors |
| Bill provider | Hardcoded `utilityProvidersByRegion` per region | Free text on server | AUD-DD-AC-003 (MED) — same global list shown to every tenant |
| Account number → name | Paystack `resolveAccountNumber` | Resolved server-side, not blocking | AUD-DD-AC-005 (LOW) — saved unverified on Paystack outage |
| Country/currency | Static `SUPPORTED_COUNTRIES` array | Inconsistent across endpoints | AUD-DD-AC-007 (LOW) |

None of the auto-completes leak cross-tenant data. None of the gaps are exploitable in the IDOR sense — they're UX/correctness debt, not security.

---

## 3. Form coverage matrix (all pages)

The full ~60-row matrix is in the second agent's deliverable; the summary that matters:

| Validation pattern | Forms |
|---|---|
| **RHF + zodResolver + shared schema** | 0 |
| **Manual `useState` + shared Zod (LU-009 phase 1)** | 3 (login, signup email, signup full) |
| **Manual `useState` + shared `pinSchema` from auth-schemas** | 1 (PIN verification dialog) |
| **RHF without zodResolver** | 3 (expenses, bills, invoices) |
| **Manual `useState` without Zod** | ~50 (everything else) |
| **No client validation at all** | 6 (admin shortcuts, role toggles, simple confirms) |

### Top 5 forms to migrate next (LU-009 Phase 2)

Order by traffic × risk:

1. **Invoices create + edit** — high traffic, revenue-critical, currently RHF without resolver. Has `insertInvoiceSchema` already exported from `shared/schema.ts`.
2. **Pay-invoice (public)** — server already clamps amount (verified) but client form has no schema; defensive belt-and-braces.
3. **Expenses create + edit** — RHF in place; just needs `zodResolver(insertExpenseSchema)`.
4. **Onboarding multi-step (3 steps)** — high-bounce risk if validation feedback is poor.
5. **Settings: company profile + password change** — consolidates 4+ admin forms onto a single schema.

### Verified form-level findings worth noting

| ID | Severity | Where | Issue |
|---|---|---|---|
| AUD-DD-FORM-019 | MEDIUM | invoice create | Line-item `quantity * rate` not cross-validated against top-level `amount`. |
| AUD-DD-FORM-020 | MEDIUM | invoice create | `taxRate * subtotal` not enforced server-side; client can store arbitrary `taxAmount`. |
| AUD-DD-FORM-021 | MEDIUM | payroll | `deductions` can exceed `salary`, producing negative `netPay`. |
| AUD-DD-FORM-009 | MEDIUM | vendor phone | Regex `/^[+]?.../`  accepts E.164-shaped strings without per-country length validation. |
| AUD-DD-FORM-014 | LOW | expense receipt upload | Client gives no pre-upload feedback; server-side `validateUploadedFile` (magic bytes + size) is the only gate. |

---

## 4. What this PR ships

The audit doc lives in `docs/audit-2026-04-26/`. Two surgical fixes for the verified-HIGH bill findings travel with the lock-drift fix branch:

1. **`DELETE /api/bills/:id`** now resolves the caller's company and rejects with 403 unless the bill belongs to it.
2. **`storage.atomicBillPayment`** now adds `WHERE bills.status != 'paid'` to its bill UPDATE, so the second of two racing requests will UPDATE zero rows; we detect this inside the transaction and throw `'BILL_ALREADY_PAID'` to force compensation. The wallet debit then rolls back.

Everything else — the medium and low-severity findings, the form migration backlog, and the unimplemented utility-provider purchase — is deferred to dedicated PRs.

---

## 5. Recommended remediation sequencing

| Sprint | Engineer-days | Items |
|---|---|---|
| Sprint A | 0.5 | AUD-DD-BILL-001 + AUD-DD-BILL-003 — **shipped in this PR** |
| Sprint A | 0.5 | AUD-DD-BILL-002 + AUD-DD-BILL-010 — add PIN to reject + request-changes |
| Sprint B | 1 | AUD-DD-BILL-007 + AUD-DD-BILL-008 — switch `computeNextDate` to `date-fns/addMonths` |
| Sprint B | 0.5 | AUD-DD-FORM-019 + AUD-DD-FORM-020 — invoice cross-field validation |
| Sprint B | 0.5 | AUD-DD-FORM-021 — payroll non-negative netPay |
| Sprint C | 3 | LU-009 Phase 2 — migrate the top 5 forms to RHF + zodResolver + shared schemas |
| Backlog | TBD | AUD-DD-BILL-011 — utility-provider purchase: confirm with product whether record-keeping is the intended behaviour |

Total ~5 engineer-days for everything in Sprints A–B.

---

## 6. Agent claims rejected on verification

These were claimed by exploration agents but found incorrect when read against current source.

| Claim | Source check | Verdict |
|---|---|---|
| "Public pay-invoice has no server-side amount validation; amount can be manipulated" | [server/routes/invoices.routes.ts:167-181](../../server/routes/invoices.routes.ts) does `paymentAmount = Math.min(requestedAmount, amountRemaining)`. Upward tampering is impossible. | **False.** Downward partial payments are intentional. |
| "AUD-DD-BILL-005: Bill marked paid before Paystack validates meter (CRITICAL)" | The `/bills/:id/pay` endpoint does NOT call any Paystack utility-provider API. It is a wallet debit + record-keeping move. The "validate before mark paid" framing implies a provider purchase that the code does not perform. | **Misframed.** Reclassified as AUD-DD-BILL-011 — utility-provider purchase appears unimplemented; needs product clarification. |
| "AUD-DD-BILL-006: No refund flow if provider rejects after payment (HIGH)" | Same root: there is no provider call, so no provider rejection to refund from. | **Rejected** — derived from the same misframing as -005. |
| "Reject endpoint doesn't require PIN (CRITICAL)" | True that PIN is missing, but the endpoint sets `bill.status='rejected'` — it does not move money. Rejection without PIN is consistent with the approve-only-with-PIN posture of most fintech apps. | **Reclassified MEDIUM** (AUD-DD-BILL-002). |
| "PIN missing on request-changes (CRITICAL)" | Same: state-only change, no money movement. | **Reclassified MEDIUM** (AUD-DD-BILL-010). |
| "Vendor name auto-complete leaks across tenants" | The agent did not produce evidence; vendor list is server-fetched per request and `getVendors(companyId)` is scoped. | **No evidence — not declared.** |

---

## 7. See also

- [`AUDIT_2026_04_26.md`](AUDIT_2026_04_26.md) — Sprint 1+2 audit
- [`AUDIT_DEEP_DIVE_2026_04_26.md`](AUDIT_DEEP_DIVE_2026_04_26.md) — countries, multi-tenant, teams, money flows, invoices, reports
- [`LOGIC_UPGRADE_PROPOSALS.md`](LOGIC_UPGRADE_PROPOSALS.md) — open upgrade specs (LU-001 through LU-014)
- [`STATUS.md`](STATUS.md) — Sprint 1+2 implementation status
