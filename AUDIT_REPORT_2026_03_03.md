# Spendly v4 — Comprehensive System Audit Report

**Date:** 2026-03-03
**Scope:** Transactions, currencies, wallet relations, bill payments, API validations, user relations, approvals, live API connections, virtual accounts
**Files Analyzed:** schema.ts, storage.ts, routes.ts (9411 lines), paymentService.ts, paystackClient.ts, stripeClient.ts, paystackWebhook.ts, webhookHandlers.ts, recurringScheduler.ts, paymentUtils.ts, 10 client page files

---

## Executive Summary

**Total Findings: 63** — 11 CRITICAL, 18 HIGH, 22 MEDIUM, 12 LOW

The most urgent issues are:
1. **`transactions` table has no `companyId`** — complete multi-tenant data isolation failure
2. **Stripe webhook handler is empty** — no Stripe payment events are processed in production
3. **Two disconnected financial record systems** — `transactions` and `walletTransactions` are never linked
4. **`atomicReversal` has no idempotency guard** — same transaction can be reversed multiple times
5. **Any authenticated user can approve expenses** — no role check on the PATCH endpoint
6. **Wallet fund endpoint allows self-crediting** without payment verification

---

## 1. TRANSACTIONS AUDIT

### CRITICAL: `transactions` table has no `companyId` (C-TXN-1)
The `transactions` table has no `companyId` column. `storage.getTransactions()` returns ALL transactions globally with no company filtering. In a multi-tenant SaaS, every user sees every company's transactions.

**Fix:** Add `companyId` to `transactions` table, add FK to `companies`, make all transaction queries scope by companyId.

### CRITICAL: Disconnected financial record systems (C-TXN-2)
Two parallel financial systems exist:
- **`transactions`** — External-facing records. No companyId. Not created by wallet operations.
- **`walletTransactions`** — Internal wallet ledger. Created atomically with balance updates.

`atomicBillPayment`, `atomicCardFunding`, `atomicWalletTransfer` create `walletTransactions` but do NOT create `transactions` records. The Transactions page only shows `transactions` table data, so wallet-based operations are invisible there.

**Fix:** Either have atomic wallet operations also create `transactions` records, or unify the two tables.

### HIGH: Transaction lookup uses LIKE on description (H-TXN-1)
`getTransactionByReference()` uses `LIKE '%reference%'` on the description field — fragile and non-performant. The `reference` column was added but isn't used for lookups.

**Fix:** Use the `reference` column with an index for lookups.

### HIGH: `walletTransactionId` never populated (H-TXN-2)
The `transactions.walletTransactionId` field exists in the schema but is NEVER written to anywhere in routes.ts or storage.ts. It's also not a proper FK reference.

**Fix:** Add `.references(() => walletTransactions.id)` and populate it when creating transaction records linked to wallet operations.

### MEDIUM: No transaction pagination (M-TXN-1)
`getTransactions()` returns ALL rows with no limit. As the database grows, this will cause memory/performance issues.

---

## 2. CURRENCIES AUDIT

### Currency Fields Inventory

| Table | Currency Field | Default | Notes |
|---|---|---|---|
| companies | currency | USD | Company default |
| expenses | currency | USD | ✅ Present |
| transactions | currency | USD | ✅ Present |
| bills | currency | USD | ✅ Present |
| budgets | currency | USD | ✅ Present |
| virtualCards | currency | USD | ✅ Present |
| virtualAccounts | currency | USD | ✅ Present |
| invoices | currency | USD | ✅ Present |
| wallets | currency | USD | ✅ Present |
| walletTransactions | currency | USD | ✅ Present |
| payoutDestinations | currency | USD | ✅ Present |
| payouts | currency + feeCurrency | USD | ✅ Present |
| scheduledPayments | currency | USD | ✅ Present |
| exchangeRates | baseCurrency + targetCurrency | N/A | ✅ Present |

### HIGH: `cardTransactions` has no currency field (H-CUR-1)
The `cardTransactions` table has `amount` but no `currency`. International card purchases in different currencies cannot be recorded accurately.

### MEDIUM: `payrollEntries.currency` is nullable (M-CUR-1)
Payroll amounts without a currency indicator are ambiguous in a multi-currency environment.

### MEDIUM: `vendors` has no currency field (M-CUR-2)
Vendor `totalPaid` and `pendingPayments` are stored without knowing which currency. Cross-border vendor reporting is inaccurate.

### MEDIUM: Exchange rate validity not enforced (M-CUR-3)
Exchange rates have `validFrom`/`validTo` but `getExchangeRate()` returns the latest rate regardless of validity window.

### Client-Side Currency Availability

| Page | Currency Selector? | Impact |
|---|---|---|
| Expenses | ❌ NO | Always company default |
| Bills | ❌ NO | Always company default |
| Invoices | ✅ YES | 7 currencies |
| Payroll | ❌ NO | Always company default |
| Virtual Cards | ✅ YES | 7 currencies |
| Virtual Accounts | ✅ YES | 5 currencies (missing KES, ZAR) |
| Budgets | ❌ NO | Always company default |

### MEDIUM: Missing currency selectors on 4 forms (M-CUR-4)
Expenses, bills, payroll, and budgets forms have no currency picker. Multi-currency use is blocked at the UI level even though the DB supports it.

---

## 3. WALLET RELATIONS AUDIT

### Wallet → WalletTransactions
`walletTransactions.walletId` properly references `wallets.id` with `onDelete: cascade`. ✅ Correct FK.

### CRITICAL: `atomicReversal` has no idempotency guard (C-WAL-1)
There is no check whether a transaction has already been reversed. The same transaction can be reversed multiple times, each time crediting/debiting the wallet. No `reversedAt` or `reversedByTxId` field exists.

**Fix:** Add `reversedAt` and `reversedByTxId` to `walletTransactions`. Check before processing.

### HIGH: `atomicCardFunding` race condition (H-WAL-1)
Card balance is read without `SELECT ... FOR UPDATE` lock inside the card funding operation. Concurrent funding requests could read stale balance, causing lost updates.

**Fix:** Add `FOR UPDATE` lock on the virtualCards row.

### HIGH: `atomicBillPayment` incomplete bill tracking (H-WAL-2)
The method accepts `paidBy` in params but does NOT write it to the bill. Fields `paymentMethod`, `paymentReference`, and `walletTransactionId` are not populated. Only `status`, `paidAmount`, and `paidDate` are set.

**Fix:** Update the bill SET clause to include all tracking fields.

### MEDIUM: `wallets.pendingBalance` never updated (M-WAL-1)
Set to `0` on creation and never changed. Should either be integrated into the debit flow or removed.

### MEDIUM: `wallets.virtualAccountId` not a real FK (M-WAL-2)
No `.references()` call — just a plain text field. Virtual account mapping could become inconsistent.

### LOW: Wallet cascade delete may violate audit requirements (L-WAL-1)
Deleting a wallet cascades to all its transaction history. Financial audit requirements may mandate preserving transaction records (soft delete preferred).

### LOW: Transfer debit/credit linked only via metadata (L-WAL-2)
`atomicWalletTransfer` creates paired transactions linked only through metadata objects, not a formal `relatedTransactionId` FK.

---

## 4. BILL PAYMENT AUDIT

### Bill Payment Fields (Schema)
All new fields are present: `paidAmount`, `paidDate`, `paidBy`, `paymentMethod`, `paymentReference`, `walletTransactionId`. ✅

### HIGH: Two competing bill payment endpoints (H-BILL-1)
Routes.ts has two bill payment paths:
1. **`POST /api/bills/:id/pay`** — Uses `atomicBillPayment` (wallet-based). Only sets `paidAmount`, `paidDate`.
2. **`PATCH /api/bills/:id`** — Generic update that can set status to "paid" with any fields.

The first is the proper atomic path but doesn't use all tracking fields. The second is an unsecured backdoor that bypasses wallet balance checks.

**Fix:** Remove ability to set `status=paid` via generic PATCH. All payment must go through the atomic endpoint with full field population.

### MEDIUM: No bill approval workflow (M-BILL-1)
Bills have status values `paid`/`unpaid`/`overdue` — no `pending_approval` state. For larger organizations, bills over a threshold should require approval before payment.

### MEDIUM: Recurring bills not exposed in UI (M-BILL-2)
DB supports `recurring` (boolean) and `frequency` fields, but the bills form has no UI for creating recurring bills. The `recurringScheduler` processes them, but they can only be created via direct API calls.

---

## 5. API VALIDATIONS vs FORM FIELDS AUDIT

### Confirmed Client-Side Bugs

| Bug | File | Severity |
|---|---|---|
| **Expenses: `vendorId` never submitted** — `selectedVendorId` state exists but `onSubmit` never includes it | expenses.tsx | HIGH |
| **Vendors: `paymentTerms` never submitted** — Form collects it but mutation type signature excludes it | vendors.tsx | HIGH |
| **Payroll: `netPay` not calculated on create** — Only computed during update, not create | payroll.tsx | MEDIUM |

### Validation Quality by Page

| Page | Quality | Zod? | Key Gaps |
|---|---|---|---|
| Expenses | POOR | ❌ | Only `required:true` on 2 fields |
| Bills | EXCELLENT | ❌ | Full per-field validation |
| Bills (Utility) | EXCELLENT | ❌ | Country-specific regex |
| Invoices | GOOD | ❌ | Email regex, line items checked |
| Team Members | **NONE** | ❌ | Zero validation — empty name/email accepted |
| Payroll | FAIR | ❌ | No bank detail validation |
| Virtual Cards | FAIR | ❌ | Card name not required |
| Virtual Accounts | MINIMAL | ❌ | Only name non-empty |
| Vendors | POOR | ❌ | Only name+email non-empty |
| Budgets | FAIR | ❌ | Name + limit > 0 |
| Settings | **NONE** | ❌ | Zero validation |

### HIGH: No Zod validation used anywhere on client (H-VAL-1)
Despite `createInsertSchema` being imported from `drizzle-zod` in schema.ts, NO client form uses Zod validation. All validation is manual `if/else` checks.

### DB Fields Missing From Forms (Features Not Exposed)

| Table | Missing Fields | Impact |
|---|---|---|
| expenses | currency, date, department, departmentId, vendorId | No multi-currency, no custom date, no dept |
| bills | currency, recurring, frequency | No multi-currency, no recurring |
| payrollEntries | currency, country, departmentId, recurring, deductionBreakdown | No multi-currency, no recurring, no detailed deductions |
| budgets | currency | No per-budget currency |
| teamMembers | departmentId, permissions | No FK dept link, no permissions UI |
| virtualAccounts | KES, ZAR in currency selector | 2 supported currencies missing |

### `companyId` NEVER sent from any client form
Every form relies on the server to inject `companyId` from the authenticated session. If any route handler forgets, records will have null `companyId`, breaking multi-tenancy.

---

## 6. USER RELATIONS AUDIT

### Authentication Chain
1. User authenticates via Cognito → provides `cognitoSub`
2. `userProfiles.cognitoSub` (unique, indexed) → user profile
3. `companyMembers` table → company membership + role
4. `resolveUserCompany(req)` → extracts companyId from membership

### CRITICAL: Multiple storage methods lack company scoping (C-USER-1)

**Methods WITHOUT companyId filtering:**
- `getTransactions()` — ALL transactions globally
- `getTransaction(id)` — By ID, no company check
- `getInsights()` — Unscoped
- `getPayouts(filters?)` — No companyId in filters
- `getPayoutDestinations(userId?, vendorId?)` — No companyId
- `getFundingSources(userId)` — By userId only
- `getCardTransactions(cardId)` — By cardId only
- `getSettings()` — Hardcoded id: 1

### HIGH: companyId parameter optional everywhere (H-USER-1)
Every storage method uses `companyId?: string`. When omitted, the method returns ALL data across companies:
```typescript
async getExpenses(companyId?: string) {
    if (companyId) { /* scoped */ }
    return db.select().from(expenses); // ALL expenses, all companies
}
```
A bug in a route handler silently returns cross-tenant data instead of throwing an error.

### MEDIUM: Three user identity systems coexist (M-USER-1)
`cognitoSub`, `userId`, and legacy `users.id` all exist. The `users` table is deprecated but still has a `getUser()` call in routes.ts.

---

## 7. APPROVAL WORKFLOWS AUDIT

### CRITICAL: No role check on expense approval (C-APPR-1)
The `PATCH /api/expenses/:id` endpoint allows ANY authenticated user to change expense status to "APPROVED" or "REJECTED". There is no check that the user has APPROVE_EXPENSE permission or is a MANAGER/ADMIN/OWNER.

**Fix:** Add role/permission check before allowing status changes on expenses.

### HIGH: No expense approval audit fields (H-APPR-1)
The `expenses` table has no `approvedBy`, `approvedAt`, `rejectedBy`, `rejectedAt`, or `approvalComments` fields. The `taggedReviewers` list doesn't track which reviewer took action.

### Payout Approval (Best Model)
The `payouts` table has the most complete approval structure:
- `approvedBy`, `firstApprovedBy`, `approvalStatus`
- `initiatedBy` for tracking who started the payout
- Missing: `approvedAt`, `firstApprovedAt` timestamps

### MEDIUM: No bill approval workflow (M-APPR-1)
Bills have no `pending_approval` state. No threshold-based approval rules.

### MEDIUM: No dedicated approval workflow table (M-APPR-2)
Each entity has ad-hoc approval fields. No configurable approval chains, no multi-step approvals, no amount-threshold rules.

---

## 8. LIVE API CONNECTIONS AUDIT

### CRITICAL: Stripe webhook handler is EMPTY (C-API-1)
`server/webhookHandlers.ts` is 17 lines — an empty skeleton:
```typescript
export function registerStripeWebhooks(app: Express) {
  // Stripe webhooks will be registered here
}
```
No Stripe payment events (payment_intent.succeeded, charge.refunded, issuing events, etc.) are processed. Stripe payments succeed on the client but the server never confirms/records them.

**Fix:** Implement Stripe webhook handler for at minimum: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `issuing.transaction.created`.

### HIGH: Paystack webhook has no signature verification bypass protection (H-API-1)
The Paystack webhook handler at `POST /api/paystack/webhook` verifies signatures correctly, but the `verifyPaystackSignature` middleware only logs a warning on failure and continues processing in some paths.

### HIGH: Wallet fund endpoint allows self-crediting (H-API-2)
`POST /api/wallets/:id/fund` — If the Stripe payment intent completes client-side but the webhook never fires (because webhooks are empty), the client can call this endpoint to credit the wallet based on a client-reported payment. No server-side payment verification occurs.

**Fix:** Wallet funding must only happen via webhook confirmation, not client-initiated calls.

### Paystack Integration (Mostly Complete)
The Paystack webhook handler properly handles:
- `charge.success` → Credits wallet, records transaction
- `transfer.success/failed/reversed` → Updates payout status
- `dedicatedaccount.assign.success/failed` → Updates virtual account
- Idempotency via `processedWebhooks` table ✅

### Stripe Integration Gaps

| Feature | Stripe Status | Paystack Status |
|---|---|---|
| Payment collection | Client-side only (no webhook) | ✅ Full webhook flow |
| Transfer/Payout | API calls work, no webhook confirmation | ✅ Webhook confirmation |
| Virtual accounts | Returns "requires Financial Connections setup" | ✅ DVA via Paystack |
| Card issuing | API calls to Stripe Issuing | N/A (Stripe only) |
| Treasury | API calls to Stripe Treasury | N/A (Stripe only) |
| Refunds | No refund webhook handling | ✅ Via Paystack API |
| Subscription billing | No implementation | ✅ Via Paystack |

### Payment Provider Coverage by Country

| Country | Currency | Provider | Virtual Account | Transfers | Status |
|---|---|---|---|---|---|
| US | USD | Stripe | Treasury (partial) | ACH ✅ | Functional minus webhooks |
| CA | USD | Stripe | — | ACH ✅ | Functional minus webhooks |
| GB | GBP | Stripe | — | BACS ✅ | Functional minus webhooks |
| DE/FR/etc | EUR | Stripe | — | SEPA ✅ | Functional minus webhooks |
| AU | AUD | Stripe | — | BECS ✅ | Functional minus webhooks |
| NG | NGN | Paystack | DVA (NUBAN) ✅ | NUBAN ✅ | **Fully functional** |
| GH | GHS | Paystack | DVA ✅ | GHIPSS ✅ | Functional |
| ZA | ZAR | Paystack | — | BASA ✅ | Transfers only |
| KE | KES | Paystack | — | M-Pesa ✅ | Transfers only |
| EG | EGP | Paystack | — | Bank ✅ | Transfers only |
| RW | RWF | Paystack | — | Mobile Money ✅ | Transfers only |
| CI | XOF | Paystack | — | Mobile Money ✅ | Transfers only |

### Transfer Validation by Country
Country-specific bank detail validation is comprehensive:
- NG: NUBAN 10-digit + 3-digit bank code ✅
- GH: 10-16 digits ✅
- ZA: 8-12 digits + 6-digit branch code ✅
- KE: M-Pesa format (254/07/01 prefix) ✅
- RW: Mobile format (250/07 prefix) ✅
- CI: Mobile format (225/0 prefix) ✅
- EG: 10-29 digits ✅
- US/CA: 9-digit routing + 4-17 digit account ✅
- GB: 6-digit sort code + 8-digit account ✅
- AU: 6-digit BSB + 5-9 digit account ✅
- EU: IBAN format ✅

---

## 9. VIRTUAL ACCOUNT NUMBERS AUDIT

### Virtual Account Schema
Fields: `id, userId, companyId, name, accountNumber, accountName, bankName, bankCode, currency, balance, type, status, provider, providerAccountId, providerCustomerCode, createdAt`

### HIGH: Missing `routingNumber`, `swiftCode`, `country` fields (H-VA-1)
For US bank accounts, a routing number is essential but missing. For international accounts, SWIFT/BIC is needed. No `country` field means the account format cannot be determined programmatically.

### Virtual Account Creation by Country

| Country | Provider | Account Type | Status |
|---|---|---|---|
| NG | Paystack | DVA (NUBAN via Wema Bank) | ✅ Full implementation with fallback |
| GH | Paystack | DVA | Partial — uses same Wema Bank flow |
| US | Stripe | Treasury Financial Account | Returns "requires setup" message |
| Others | — | Not supported | — |

### Paystack DVA Flow (Nigeria)
1. Tries `assignDedicatedAccount` (one-step)
2. On failure, falls back to `createCustomer` → `createVirtualAccount` (two-step)
3. On second failure, returns `pending_validation` status with BVN verification message
4. Webhook `dedicatedaccount.assign.success` confirms assignment

### MEDIUM: Virtual accounts UI missing KES, ZAR currencies (M-VA-1)
The virtual accounts form only offers NGN, GHS, USD, EUR, GBP. KES and ZAR are supported by the payment infrastructure but not selectable.

### MEDIUM: No virtual account to wallet auto-linking (M-VA-2)
When deposits arrive at a virtual account (tracked via Paystack webhook `dedicatedaccount.assign.success`), there is no automatic wallet credit. The `wallets.virtualAccountId` field exists but the inbound payment flow doesn't auto-credit.

---

## 10. PRIORITY FIX LIST

### Phase A — Security Critical (Do Immediately)

| # | Finding | Fix |
|---|---|---|
| 1 | C-TXN-1: transactions has no companyId | Add column + FK + scope all queries |
| 2 | C-APPR-1: No role check on expense approval | Add permission check before status changes |
| 3 | C-API-1: Stripe webhooks empty | Implement payment_intent.succeeded handler |
| 4 | C-WAL-1: Reversal has no idempotency | Add reversedAt/reversedByTxId check |
| 5 | H-API-2: Wallet self-crediting | Move funding to webhook-only flow |

### Phase B — Data Integrity (This Sprint)

| # | Finding | Fix |
|---|---|---|
| 6 | C-TXN-2: Disconnected financial records | Unify transactions + walletTransactions flow |
| 7 | H-WAL-1: Card funding race condition | Add FOR UPDATE on card row |
| 8 | H-WAL-2: Bill payment tracking incomplete | Write all fields in atomicBillPayment |
| 9 | H-BILL-1: Generic PATCH can mark bills paid | Restrict status=paid to atomic endpoint |
| 10 | C-USER-1: Unscoped storage methods | Add companyId to getTransactions, getPayouts, etc. |

### Phase C — Client Bugs (This Sprint)

| # | Finding | Fix |
|---|---|---|
| 11 | Expenses: vendorId never submitted | Include selectedVendorId in onSubmit |
| 12 | Vendors: paymentTerms never submitted | Add to mutation type signature |
| 13 | Payroll: netPay not calculated on create | Compute before sending |

### Phase D — Validation & UX (Next Sprint)

| # | Finding | Fix |
|---|---|---|
| 14 | H-VAL-1: No Zod on client | Use createInsertSchema for all forms |
| 15 | Team form: zero validation | Add name/email validation |
| 16 | Settings: zero validation | Add company name/email validation |
| 17 | Add currency selectors | Expenses, bills, payroll, budgets |
| 18 | Add date field to expenses | Let users specify expense date |
| 19 | Expose recurring bills/payroll | Build UI for DB-supported features |

### Phase E — Schema Improvements (Next Sprint)

| # | Finding | Fix |
|---|---|---|
| 20 | H-CUR-1: cardTransactions no currency | Add currency field |
| 21 | H-VA-1: virtualAccounts missing fields | Add routingNumber, swiftCode, country |
| 22 | H-APPR-1: No approval audit fields | Add approvedBy/At, rejectedBy/At to expenses |
| 23 | M-APPR-2: No approval workflow table | Design configurable approval chains |
| 24 | H-USER-1: Optional companyId pattern | Make companyId required, separate admin methods |

---

## Appendix: All Findings by Severity

### CRITICAL (11)
1. C-TXN-1: transactions table has no companyId
2. C-TXN-2: Disconnected financial record systems
3. C-WAL-1: atomicReversal no idempotency guard
4. C-USER-1: Multiple storage methods lack company scoping
5. C-APPR-1: No role check on expense approval
6. C-API-1: Stripe webhook handler is empty skeleton
7. H-API-2: Wallet fund endpoint allows self-crediting (elevated to critical)
8. C-USER-1b: getTransactions() returns ALL companies' data
9. C-USER-1c: getPayouts() has no companyId filter
10. C-USER-1d: getInsights() unscoped
11. C-USER-1e: getCardTransactions() no company verification

### HIGH (18)
1. H-TXN-1: Transaction lookup uses LIKE on description
2. H-TXN-2: walletTransactionId never populated
3. H-WAL-1: atomicCardFunding race condition (no FOR UPDATE on card)
4. H-WAL-2: atomicBillPayment doesn't write paidBy/paymentMethod/paymentReference/walletTransactionId
5. H-CUR-1: cardTransactions has no currency field
6. H-VA-1: virtualAccounts missing routingNumber, swiftCode, country
7. H-APPR-1: No approvedBy/approvedAt/rejectedBy/rejectedAt on expenses
8. H-USER-1: companyId optional everywhere (silent cross-tenant leak)
9. H-VAL-1: No Zod validation on any client form
10. H-BILL-1: Generic PATCH can mark bills paid without wallet check
11. H-API-1: Paystack webhook signature verification gaps
12. H-BUG-1: Expenses vendorId never submitted from form
13. H-BUG-2: Vendors paymentTerms never submitted from form
14. H-TXN-3: transactions.walletTransactionId not a real FK
15. H-VAL-2: Team member form has zero validation
16. H-USER-2: getSettings() uses hardcoded id=1 singleton
17. H-BILL-2: Utility payment requires separate provider (Reloadly) not integrated
18. H-API-3: Stripe card issuing events not handled via webhook

### MEDIUM (22)
1. M-WAL-1: wallets.pendingBalance never updated
2. M-WAL-2: wallets.virtualAccountId not a real FK
3. M-CUR-1: payrollEntries.currency is nullable
4. M-CUR-2: vendors has no currency field
5. M-CUR-3: Exchange rate validity not enforced
6. M-CUR-4: Missing currency selectors on 4 forms
7. M-USER-1: Three user identity systems coexist
8. M-APPR-1: No bill approval workflow
9. M-APPR-2: No dedicated approval workflow table
10. M-BILL-1: No bill approval states
11. M-BILL-2: Recurring bills not exposed in UI
12. M-VA-1: Virtual accounts UI missing KES, ZAR
13. M-VA-2: No virtual account to wallet auto-linking
14. M-TXN-1: No transaction pagination
15. M-BUG-1: Payroll netPay not calculated on create
16. M-VAL-1: Settings page has zero validation
17. M-VAL-2: Expenses missing date field in form
18. M-VAL-3: Expenses missing department in form
19. M-VAL-4: Payroll bank details have no format validation
20. M-VAL-5: Payroll missing recurring support in UI
21. M-VAL-6: Payroll missing deduction breakdown in UI
22. M-WAL-3: getWallets() without userId returns all wallets globally

### LOW (12)
1. L-WAL-1: Wallet cascade delete may violate audit requirements
2. L-WAL-2: Transfer debit/credit linked only via metadata
3. L-APPR-1: Payout approval fields lack timestamps
4. L-CUR-1: Company default currency not enforced on creation
5. L-VAL-1: Card name not required in form
6. L-VAL-2: Virtual account form minimal validation
7. L-VAL-3: Budget form minimal validation
8. L-VAL-4: Vendor form poor validation (no email format)
9. L-TXN-1: No transaction export/filter by type
10. L-API-1: Stripe Treasury requires Financial Connections setup (documented limitation)
11. L-USER-1: Legacy users table still has getUser() call
12. L-VA-3: Paystack DVA only available for Nigeria (Wema Bank default)
