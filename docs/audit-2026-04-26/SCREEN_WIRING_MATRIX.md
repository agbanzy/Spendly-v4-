# Screen → Route → Module → Table Wiring Matrix

**Date:** 2026-04-26
**Purpose:** Single reference that maps every user-facing screen to the API routes it calls, the storage methods those routes invoke, and the database tables those storage methods touch. Sibling document of [`AUDIT_BILLS_FORMS_2026_04_26.md`](AUDIT_BILLS_FORMS_2026_04_26.md).

This document was assembled to answer "where does this button go?" without grepping. Production bugs surfaced during the session (pay-invoice `NaN`, pay-invoice 403 Forbidden, expense `approvedBy: "admin"` placeholder, virtual-accounts cross-tenant leak) all came from places where the wiring drifted between layers — having the matrix in one place catches the next drift sooner.

The wiring shipped in the same PR closes those four bugs. Future drift-catching: re-run the script in §6 before any release; flag any row where the **Notes** column does not say *Wired*.

---

## 1. Authenticated app pages

| Page | Routes called | Storage methods | Tables | Notes |
|---|---|---|---|---|
| `dashboard.tsx` | `GET /api/balance` · `GET /api/transactions` · `GET /api/user-profile` · `GET /api/insights` (post PR #2 scoped) | `getBalances` · `getTransactions` · `getUserProfileByCognitoSub` · `getInsights(companyId)` | `company_balances` · `transactions` · `user_profiles` · `expenses+budgets` (insights aggregation) | Wired |
| `transactions.tsx` | `GET /api/transactions?limit&offset` · `PATCH /api/transactions/:id` · `DELETE /api/transactions/:id` | `getTransactions(companyId, opts)` · `updateTransaction` · `deleteTransaction` (soft-delete since PR #2) | `transactions` (with `deleted_at IS NULL` filter) | Wired |
| `expenses.tsx` | `GET /api/expenses` · `POST /api/expenses` · `PATCH /api/expenses/:id` · `POST /api/expenses/:id/approve-and-pay` · `POST /api/upload-receipt` | `getExpenses(companyId)` · `createExpense` · `updateExpense` (now populates `approvedBy`/`approvedAt` per this PR) · `createPayout` | `expenses` · `payouts` · `audit_logs` · `transactions` (via wallet bridge) | Wired ✅ — hardcoded `approvedBy: "admin"` removed |
| `bills.tsx` | `GET /api/bills` · `POST /api/bills` · `PATCH /api/bills/:id` · `DELETE /api/bills/:id` · `POST /api/bills/:id/approve` · `POST /api/bills/:id/reject` · `POST /api/bills/:id/request-changes` · `POST /api/bills/:id/pay` · `POST /api/bills/pay` | `getBills` · `createBill` · `updateBill` · `deleteBill` (now tenancy-checked) · `atomicBillPayment` (now race-safe) · `createTransaction` | `bills` · `wallet_transactions` · `wallets` · `transactions` · `audit_logs` | Wired |
| `budget.tsx` | `GET /api/budgets` · `POST /api/budgets` · `PATCH /api/budgets/:id` · `DELETE /api/budgets/:id` | `getBudgets(companyId)` · `createBudget` · `updateBudget` · `deleteBudget` | `budgets` | Wired |
| `cards.tsx` | `GET /api/cards` · `POST /api/cards` · `POST /api/cards/:id/fund` · `POST /api/cards/:id/freeze` · `POST /api/cards/:id/cancel` | `getVirtualCards` · `createVirtualCard` · `atomicCardFunding` · `updateVirtualCard` | `virtual_cards` · `card_transactions` · `wallets` · `wallet_transactions` · `transactions` | Wired |
| `virtual-accounts.tsx` | `GET /api/virtual-accounts` (now fail-closed on no company) · `POST /api/virtual-accounts` · `POST /api/virtual-accounts/:id/withdraw` · `POST /api/virtual-accounts/:id/deposit` | `getVirtualAccounts(companyId)` · `createVirtualAccount` (provider-real, returns 502 if no provider issues) · payment-service `initiateTransfer` | `virtual_accounts` · `wallets` · `audit_logs` | Wired ✅ — fail-closed on missing company |
| `invoices.tsx` | `GET /api/invoices` · `POST /api/invoices` (server cross-validates line-items + tax since PR #11) · `PATCH /api/invoices/:id` · `DELETE /api/invoices/:id` · `GET /api/invoices/:id/payments` · `POST /api/invoices/:id/payments` | `getInvoices(companyId)` · `createInvoice` (now writes `rate`+`price`+`amount` per this PR) · `updateInvoice` · `deleteInvoice` (now soft) | `invoices` (filters `deleted_at IS NULL`) · `transactions` (on payment record) | Wired ✅ — line-item shape unified |
| `pay-invoice.tsx` (public, no auth) | `GET /api/public/invoices/:id` · `POST /api/public/invoices/:id/pay` (Stripe) · `POST /api/public/invoices/:id/pay/paystack` | `getInvoicePublic` (now filters `deleted_at IS NULL`) · server creates Stripe Checkout / Paystack init | `invoices` · in-process `invoicePaymentsStore` (legacy) | Wired ✅ — `X-Requested-With` header added; line-item NaN fixed (reads `rate ?? price ?? amount/qty`) |
| `payroll.tsx` | `GET /api/payroll` · `POST /api/payroll` (now refuses negative netPay since PR #10) · `PATCH /api/payroll/:id` · `POST /api/payroll/:id/process` · `POST /api/payroll/:id/cancel` | `getPayroll` · `createPayrollEntry` · `updatePayrollEntry` | `payroll_entries` · `payouts` · `transactions` · `wallet_transactions` | Wired |
| `vendors.tsx` | `GET /api/vendors` · `POST /api/vendors` · `PATCH /api/vendors/:id` · `DELETE /api/vendors/:id` · `POST /api/payout-destinations` · `GET /api/banks` (per country) | `getVendors(companyId)` · `createVendor` · `createPayoutDestination` (auto-verifies via Paystack/Stripe) | `vendors` · `payout_destinations` | Wired |
| `team.tsx` | `GET /api/team` (now reads from `company_members` since PR #9) · `POST /api/team` · `PATCH /api/team/:id` (now last-admin-guarded) · `DELETE /api/team/:id` (also guarded) · `POST /api/team/invite` · `GET /api/departments` · `POST /api/departments` | `getTeam(companyId)` · `createTeamMember` (mirror writes both tables) · `updateTeamMember` · `deleteTeamMember` · `getDepartments` | `company_members` (source of truth) · `team_members` (mirrored) · `departments` · `company_invitations` | Wired |
| `analytics.tsx` | `GET /api/analytics/*` | `getAnalyticsSnapshots` · `getBusinessInsights` | `analytics_snapshots` · `business_insights` | Wired |
| `reports.tsx` | `GET /api/reports` · `POST /api/reports` · `DELETE /api/reports/:id` (IDOR check since PR #2) · `GET /api/reports/:id/download` | `getReports(companyId)` · `createReport` · `getReport` + `verifyCompanyAccess` · `deleteReport` | `reports` (read scoped) · downstream `expenses`/`transactions`/`budgets`/`bills`/`payroll_entries` (aggregation) | Wired |
| `settings.tsx` | `GET /api/user/profile` · `PATCH /api/user/profile` · `POST /api/user/change-password` · `POST /api/user/transaction-pin` · `POST /api/user/account/close` | `getUserProfileByCognitoSub` · `updateUserProfile` · Cognito SDK · `bcrypt` PIN hash | `user_profiles` (Cognito for password) | Wired |
| `onboarding.tsx` | `POST /api/user-profile` · `POST /api/kyc/initiate` · `POST /api/kyc/upload` (multipart) | `createUserProfile` · `createKycSubmission` · `validateUploadedFile` (magic bytes) | `user_profiles` · `kyc_submissions` | Wired |
| `invite.tsx` (public) | `GET /api/invitations/:token` · `POST /api/invitations/:token/accept` | `getCompanyInvitation` · `acceptInvitation` (creates both `company_members` + mirrored `team_members`) | `company_invitations` · `company_members` · `team_members` | Wired |

## 2. Auth pages

| Page | Routes called | Storage / SDK | Notes |
|---|---|---|---|
| `login.tsx` | Cognito SDK (email+password) · `POST /api/auth/sms/initiate` · `POST /api/auth/sms/verify` · OAuth redirect | `loginSchema` (shared/auth-schemas.ts) | Wired — Zod validation since PR #1 |
| `signup.tsx` | Cognito SDK · `POST /api/user-profile` (server stamps companyId) | `signupSchema` | Wired — Zod validation since PR #1 |
| `forgot-password.tsx` | Cognito SDK | — | Wired |
| `auth-callback.tsx` | Cognito Hosted UI code-exchange · stores tokens in localStorage | — | Wired |
| `admin-login.tsx` | `POST /api/admin/login` | server admin path | Wired |

## 3. Admin pages

| Page | Routes | Notes |
|---|---|---|
| `admin.tsx` | `GET /api/team` · `GET /api/expenses` · `GET /api/admin/audit-logs` (scoped per PR #2) | Wired |
| `admin-users.tsx` | `GET /api/admin/users` · `PUT /api/admin/users/:id` · `DELETE /api/admin/users/:id` | Wired |
| `admin-audit-logs.tsx` | `GET /api/admin/audit-logs` (scoped) | Wired |
| `admin-organization.tsx` | `GET/PUT /api/admin/organization` · `GET/PUT /api/admin/settings` | Wired |
| `admin-security.tsx` | `GET/PUT /api/admin/security` (filter on `category='security'`) | Wired |
| `admin-wallets.tsx` | `GET /api/admin/wallets` · funding/balance views | Wired |
| `admin-payouts.tsx` | `GET /api/payouts` · `POST /api/payouts/:id/process` (debit-first since PR #5) · batch | Wired |
| `admin-exchange-rates.tsx` | `GET /api/admin/exchange-rates` · `PUT /api/admin/exchange-rates/:pair` | Wired |
| `admin-database.tsx` | `POST /api/admin/purge-database/initiate` · `POST /api/admin/purge-database/approve/:intentId` (two-admin since PR #1) | Wired — legacy `/admin/purge-database` returns 410 |

---

## 4. The five route → table groupings

### A. Money-movement chain
```
expenses.routes.ts ──► storage.atomicBillPayment / atomicCardFunding /
bills.routes.ts        atomicWalletTransfer / atomicReversal
cards.routes.ts        ──► wallet_transactions + transactions (bridged)
payouts.routes.ts          + wallets / company_balances
payroll.routes.ts          + payouts + payout_destinations
                       ──► audit_logs
```

The atomic ops are the single chokepoint that guarantees:

- Wallet `SELECT FOR UPDATE` lock before debit
- `transactions` row written same TX as `wallet_transactions` (bridge from PR #1)
- `companyId` resolved from the wallet's row, not from caller-supplied metadata
- Idempotency on bill payment (PR #6's `BILL_ALREADY_PAID` thrown error)

### B. Webhook chain
```
Stripe / Paystack ──► /api/webhooks/* (signature-verified)
                  ──► resolveCompanyForWebhook(provider, intentId, metadataCompanyId)
                  ──► payment_intent_index (server-issued mapping from PR #4)
                  ──► storage.creditWallet / updateBalances / createTransaction
                  ──► processed_webhooks (idempotency)
```

`resolveCompanyForWebhook` always trusts the index over metadata; mismatches log `webhook_company_mismatch`.

### C. Admin gate chain
```
requireAuth ──► verifies Cognito ID token
              ──► attaches req.user.cognitoSub

requireAdmin ──► flag admin_per_company (PR #3)
              │      ON: companyMembers.role IN (OWNER, ADMIN)
              │           for active company (X-Company-Id or first)
              │      OFF: legacy users.role
              └─► attaches req.adminUser + req.adminCompany

requirePermission(name) ──► PR #7
                       ──► getCachedRolePermissions(role) ∪ memberPermissions
                       ──► role_permissions (DB-backed) ∪ companyMembers.permissions
```

Three middlewares stack at the entry point of every admin / sensitive endpoint.

### D. Tenancy chain
Every read on a tenant-scoped table now goes through:
```
resolveUserCompany(req) → companyContext.companyId
storage.getX(companyId)  → SQL with WHERE company_id = ?
```
Plus the `verifyCompanyAccess` post-fetch check on writes/deletes.

Cross-tenant leaks are guarded in: `getInsights`, `getAuditLogs`, `getInvoices`, `getVirtualAccounts` (this PR), `DELETE /reports/:id`, `DELETE /bills/:id`, `DELETE /transactions/:id`, `DELETE /invoices/:id`. All fail-closed when no company resolves.

### E. Approval chain
```
expense.PENDING ──► POST /api/expenses/:id/approve-and-pay
                     - requireAuth + requireAdmin + requirePin
                     - approver identity = req.user.cognitoSub (NEVER the body)
                     - expense.approvedBy + approvedAt populated (this PR)
                     - payout.initiatedBy + approvedBy populated
                     - audit_logs entry with previous + new state
                ──► payout.pending → /process → debit-first → external

bill.pending ──► POST /api/bills/:id/approve|reject|request-changes
                  - all three now require PIN (PR #10)
                  - bill.approvedBy + approvedAt + reviewerComments
```

---

## 5. Production bugs closed by this PR

| Bug | Where | Root cause | Fix |
|---|---|---|---|
| Pay-invoice page shows `₦NaN` for line items | [`client/src/pages/pay-invoice.tsx`](../../client/src/pages/pay-invoice.tsx) | TypeScript declared `items: { rate: number }` but the post-LU-009 invoice writer stored `{ price, amount }` instead. Renderer accessed `item.rate` and got `NaN`. | (1) Renderer reads `item.rate ?? item.price ?? item.amount/qty`. (2) Schema declaration broadened to accept all three keys. (3) Invoice writer now stamps all three. |
| Pay-invoice "Payment Error / Forbidden" 403 toast | [`client/src/pages/pay-invoice.tsx`](../../client/src/pages/pay-invoice.tsx) | Raw `fetch()` without `X-Requested-With: XMLHttpRequest`. CSRF middleware (OWASP-recommended for token-auth APIs) rejects state-changing requests without it. | Added the header. |
| Expense audit trail missing approver identity | [`server/routes/expenses.routes.ts`](../../server/routes/expenses.routes.ts) | Route accepted client-supplied `approvedBy`. Client hardcoded `"admin"`. The `expenses.approvedBy` and `approvedAt` columns were never populated. | Server now uses `req.user.cognitoSub` exclusively. Both columns populated with the verified identity + `now()`. Client field removed. |
| Virtual-accounts cross-tenant leak when no company resolves | [`server/routes/accounts.routes.ts`](../../server/routes/accounts.routes.ts) | `companyContext?.companyId` is `undefined` when the user has no membership; storage treats `undefined` as "no filter" and returns every tenant's accounts. | Fail-closed: 403 if no active company membership. Same pattern already applied to `/insights`, `/admin/audit-logs`, and others in PR #2. |

---

## 6. Verification script

A quick "does the wiring still hold" probe to run before any release:

```bash
# Every page should call only the documented routes:
grep -oh 'apiRequest("[A-Z]*", *"/api/[^"]*"\|fetch(`/api/[^`]*`' client/src/pages/*.tsx | sort -u

# Every route should write to only the documented tables:
grep -oh 'db\.\(insert\|update\|delete\)([a-zA-Z]*' server/routes/*.routes.ts | sort -u

# Every storage helper should use either eq() with a typed column or
# sql.raw() with a type-pinned literal — same audit as
# DRIZZLE_ADVISORY_EVALUATION.md
grep -rn 'sql\.raw' server/storage.ts
```

Any new entry from these scripts that doesn't appear in §1–§4 above means the wiring drifted; update this doc OR fix the drift.
