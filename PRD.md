# Financiar — Product Requirements Document (PRD)

> **Version:** 2.0 (refresh) | **Date:** 2026-04-26 | **Author:** Godwin Agbane (Guru)
> **Product:** Financiar (codename: Spendly v4) | **Domain:** `app.thefinanciar.com`
> **Package:** `com.financiar.app` | **Brand colour:** `#6B2346`
> **Supersedes:** PRD v1.0 dated 2026-03-14
> **Companion documents:** [`docs/audit-2026-04-26/AUDIT_2026_04_26.md`](docs/audit-2026-04-26/AUDIT_2026_04_26.md), [`docs/audit-2026-04-26/BRD_2026_04_26.md`](docs/audit-2026-04-26/BRD_2026_04_26.md), [`docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md`](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md)

---

## What changed since v1.0 (2026-03-14)

This refresh consolidates the changes that landed in commits `0a93cec`, `d99c31a`, `acb67e7`, `be62fc2`, and `4e79399` and brings the spec back in sync with the codebase as of HEAD `e831622`.

| Area | v1.0 said | Reality at 2026-04-26 |
|---|---|---|
| Backend route file | One monolithic `server/routes.ts` (~11,000 lines) | **24 domain modules** under `server/routes/` plus `index.ts` and `shared.ts` (26 files total). A legacy `routes.legacy.ts` still exists and is being retired (see [AUD-BE-009](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register)). |
| Database tables | "41 tables" | **42 `pgTable` definitions** in `shared/schema.ts` (the v1.0 count was off by one) |
| Stripe webhook handler | "Empty" (per 2026-03-03 audit) | **Fully implemented** — `webhookHandlers.ts` covers payment_intent, checkout, charge, issuing, transfer, payout, treasury events with signature verification |
| Reversal idempotency | "Missing" | **Implemented** at `storage.ts:1722-1725`; `walletTransactions.reversedAt` and `reversedByTxId` columns added |
| Multi-tenant scoping | "Transactions table has no `companyId`" | **Closed** — `transactions.companyId` FK present at `schema.ts:262`; index at line 267 |
| Bill payment field tracking | "Atomic op leaves bills.paidBy/etc blank" | **Closed** — all 7 tracking fields populated atomically at `storage.ts:1530-1538` |
| Auth security | localStorage tokens, no PIN | **Triple-gate** (`requireAuth + requireAdmin + requirePin`) on financial mutations; CSP enabled in production; Helmet hardened |
| Currency selectors on UI | Missing on Expenses/Bills/Payroll/Budgets | **Closed** — all four pages now offer currency selection |
| KYC | Stripe Identity only | **Multi-provider** — Stripe Identity for Stripe markets, Paystack BVN for NG, manual upload + admin review fallback |
| Payment routing | Hardcoded | **Per-country** via `shared/constants.ts`; Paystack for NG/GH/KE/ZA/TZ/RW/SN/UG/ZM/ZW; Stripe everywhere else |
| OpenAPI documentation | Not present | **Generated** at [`docs/openapi.yaml`](docs/openapi.yaml) (~5,000 lines) |
| Email | AWS SES only | **AWS SES + Microsoft 365 SMTP** (Nodemailer fallback) |
| Test count | Unstated | **353 unit tests passing** (claim from commit `4e79399`); 1 Playwright spec in `e2e/` |

The remaining open audit findings — single-instance scheduler, single-NAT/single-AZ infrastructure, no CI test gate, mobile hardening gaps, client-side Cognito tokens — are tracked in [`AUDIT_2026_04_26.md`](docs/audit-2026-04-26/AUDIT_2026_04_26.md) and [`LOGIC_UPGRADE_PROPOSALS.md`](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md).

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Goals](#2-product-vision--goals)
3. [Target Users](#3-target-users)
4. [Platform Overview](#4-platform-overview)
5. [Tech Stack](#5-tech-stack)
6. [Authentication & Security](#6-authentication--security)
7. [Feature Catalog](#7-feature-catalog)
8. [Database Architecture](#8-database-architecture)
9. [API Surface](#9-api-surface)
10. [Payment Infrastructure](#10-payment-infrastructure)
11. [Billing & Subscription Model](#11-billing--subscription-model)
12. [Third-Party Services & API Costs](#12-third-party-services--api-costs)
13. [Supported Countries & Currencies](#13-supported-countries--currencies)
14. [Mobile App](#14-mobile-app)
15. [Infrastructure & Deployment](#15-infrastructure--deployment)
16. [Operational Runbooks](#16-operational-runbooks)
17. [Mobile–Web Parity Matrix](#17-mobile-web-parity-matrix)
18. [Feature Flags](#18-feature-flags)
19. [Non-Functional Requirements](#19-non-functional-requirements)
20. [Known Limitations & Tech Debt](#20-known-limitations--tech-debt)
21. [Roadmap](#21-roadmap)

---

## 1. Executive Summary

**Financiar** is a multi-tenant fintech SaaS for individuals and SMBs, providing expense tracking, bill payments, payroll, virtual cards, multi-currency wallets, invoicing, vendor management, team collaboration, and AI-assisted financial insights through a unified web and mobile experience.

The platform supports **dual payment processors** (Stripe for international markets, Paystack for African markets) and is engineered for global coverage across 177 countries (as listed in the Google Play Store) with **active payment integrations in 10 African countries plus Stripe's full geography**. It features Cognito authentication, multi-tier KYC, role-based access control with 9 granular permissions, transaction PIN security, audit logging, and an admin panel.

### Key metrics (post-refactor, 2026-04-26)

| Metric | Value | Source |
|---|---|---|
| API endpoints | **~517** (across `server/routes/*.ts` and `routes.legacy.ts`) | `grep router.\(get\|post\|patch\|put\|delete\) server/routes/*.ts server/routes.legacy.ts` |
| Domain route modules | **24** (+ `index.ts` + `shared.ts` = 26 files) | `ls server/routes/` |
| Database tables | **42** | `grep -c "^export const .* = pgTable" shared/schema.ts` |
| Web pages | **36** | `ls client/src/pages/*.tsx` |
| Mobile screens | **22** | `ls mobile/src/screens/*.tsx` |
| Active payment markets | **10** Paystack + Stripe global | `shared/constants.ts` |
| Notification channels | **4** (in-app, email, SMS, push) | `server/services/notification-service.ts` |
| Unit + integration tests | **353 passing** (claim) | commit `4e79399` |
| E2E tests | 1 Playwright spec | `e2e/app.spec.ts` |

---

## 2. Product Vision & Goals

### Vision

To be the financial operating system for individuals and SMBs across emerging and established markets — combining treasury management, expense control, payment processing, and financial intelligence in a single platform.

### Goals

1. **Unified financial management** — one platform for receive / hold / spend / track / report
2. **Global accessibility** — dual payment rails (Stripe + Paystack) ensure coverage in Western and African markets
3. **SMB-first design** — multi-tenant architecture with team roles, departments, approval workflows, company switching
4. **Compliance-ready** — built-in KYC, audit logging, transaction PINs, role-based permissions
5. **Mobile parity** — full-featured React Native app with biometric auth, push notifications, and an offline mutation queue

The 2026 emphasis (post-refactor) is **operational maturity**: shipping reliably, observability, multi-instance scaling, and disciplined release engineering.

---

## 3. Target Users

| Persona | Description |
|---|---|
| **Solo entrepreneurs** | Freelancers and sole traders managing personal/business finances |
| **SMB owners** | Small business owners needing expense management, payroll, and invoicing |
| **Finance teams** | Accountants and finance managers requiring approval workflows, budgets, and reporting |
| **Remote/distributed teams** | Companies with team members across countries/currencies |
| **African businesses** | Businesses in NG, GH, KE, ZA, TZ, RW, SN, UG, ZM, ZW needing local payment rails |

---

## 4. Platform Overview

### Web

- **Framework:** React 18 + Vite + TypeScript 5.6
- **UI:** Tailwind CSS + shadcn/ui (49 Radix primitives) + Framer Motion 11
- **Routing:** Wouter 3.3 (lightweight client-side routing)
- **State:** TanStack React Query 5.60
- **Pages:** 36 (10 public/auth, 18 dashboard/feature, 10 admin)

### Mobile

- **Framework:** React Native 0.76 + Expo 52
- **Navigation:** React Navigation 6 (native-stack + bottom-tabs)
- **Screens:** 22 (3 auth, 1 onboarding, 5 main tabs, 13 secondary)
- **Distribution:** Google Play Store (`com.financiar.app`, v1.0.3, versionCode 6) — internal track only as of 2026-04-26
- **Unique features:** Biometric auth, push notifications, offline mutation queue, secure credential storage

### Backend

- **Framework:** Express 5.0 + TypeScript 5.6
- **ORM:** Drizzle ORM 0.39
- **Database:** PostgreSQL 16.4 (Amazon RDS, single-AZ at present — see [AUD-IN-003](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register))
- **Output:** Single CommonJS bundle (`dist/index.cjs`) serving both API and static client

### Architecture pattern

Full-stack monorepo. Single deployable unit. The Express server serves the built React client from `dist/public/` and exposes the API at `/api/*`. Static caching headers and a Vite-based dev middleware are conditioned on `NODE_ENV`.

---

## 5. Tech Stack

### Core

| Layer | Technology | Version |
|---|---|---|
| Frontend | React + Vite + TypeScript | 18.3 / 5.4 / 5.6 |
| Mobile | React Native + Expo | 0.76 / 52 |
| Backend | Express + TypeScript | 5.0.1 / 5.6 |
| Database | PostgreSQL + Drizzle ORM | 16.4 / 0.39 |
| Auth | AWS Cognito | SDK v3 + amazon-cognito-identity-js (legacy) |
| Payments (Intl) | Stripe | 20.0.0 |
| Payments (Africa) | Paystack | REST API |
| Email | AWS SES + Microsoft 365 SMTP (Nodemailer) | SDK v3 |
| SMS | AWS SNS | SDK v3 |
| Push | Expo Push Notifications | — |
| Logging | pino + pino-pretty | 10.3 / 13.1 |
| Validation | Zod 3.24 + drizzle-zod 0.7 | — |
| Tests | Vitest + Playwright | 4.1 / 1.58 |
| Infra | AWS CDK + ECS Fargate + RDS + ALB | 2.x |

### Frontend libraries

| Category | Libraries |
|---|---|
| UI components | shadcn/ui (49 Radix primitives), Lucide icons, React Icons |
| Animations | Framer Motion 11 |
| Charts | Recharts 2.15 |
| Forms | React Hook Form 7.55 + Zod 3.24 (planned: shared schema reuse — [LU-009](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-009-shared-zod-schemas-on-client)) |
| Routing | Wouter 3.3 |
| State | TanStack React Query 5.60 |
| Date | date-fns, react-day-picker |
| Tour | react-joyride |
| Carousel | embla-carousel-react |

### Mobile libraries

| Category | Libraries |
|---|---|
| Navigation | React Navigation 6 (native-stack + bottom-tabs) |
| Auth | amazon-cognito-identity-js |
| Biometrics | expo-local-authentication |
| Storage | AsyncStorage + expo-secure-store |
| Notifications | expo-notifications |
| Camera/gallery | expo-image-picker |
| Browser | expo-web-browser |
| Clipboard | expo-clipboard |
| Network | @react-native-community/netinfo |
| Persistence | TanStack Query + AsyncStorage persister (planned migration to encrypted store — [LU-006c](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-006c--encrypted-local-storage)) |

---

## 6. Authentication & Security

### Authentication flow

```
User → Cognito (email/password OR Google OAuth OR SMS OTP)
     → JWT (id_token + access_token + refresh_token)
     → Server verifies via aws-jwt-verify (kid caching built-in)
     → User profile synced to PostgreSQL (user_profiles table)
     → req.user populated for downstream handlers
```

### Auth methods

1. **Email + password** — standard Cognito user-pool auth
2. **Google OAuth** — Cognito Hosted UI redirect → authz-code exchange (`/auth/callback`)
3. **SMS OTP** — custom auth challenge flow via Cognito Lambda triggers
4. **Biometric (mobile)** — Face ID / fingerprint via `expo-local-authentication`; credentials stored in `expo-secure-store`

### Security layers

| Layer | Implementation | Status |
|---|---|---|
| JWT verification | `aws-jwt-verify` on every authenticated request, kid caching automatic | ✅ |
| Transaction PIN | 4-digit bcrypt-hashed PIN; required on financial mutations | ✅ |
| Triple-gate | `requireAuth` + `requireAdmin` + `requirePin` on sensitive endpoints | ✅ |
| Role-based access | 6 roles: OWNER, ADMIN, MANAGER, EDITOR, EMPLOYEE, VIEWER | ✅ |
| 9 granular permissions | VIEW_TREASURY, MANAGE_TREASURY, CREATE_EXPENSE, APPROVE_EXPENSE, SETTLE_PAYMENT, MANAGE_CARDS, MANAGE_TEAM, VIEW_REPORTS, MANAGE_SETTINGS | ✅ |
| Rate limiting (5 tiers) | API 100/15min · Auth 5/15min · Sensitive 10/15min · Financial 3/min · Email 3/hr | ✅ |
| Audit logging | Every significant action: userId, IP, userAgent, entity details | ✅ (purge endpoint records `'system'` instead of admin — see [AUD-BE-017](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register)) |
| Webhook idempotency | `processed_webhooks` table + `wallet_transactions(reference)` UNIQUE | ✅ |
| Row-level locking | `SELECT ... FOR UPDATE` on wallet, card, virtual_account ops | ✅ |
| Atomic transactions | All 4 financial atomic ops use `db.transaction(...)` | ✅ |
| Input validation | Zod on all API inputs (server). Client-side reuse pending — see [LU-009](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-009-shared-zod-schemas-on-client). | ⚠️ |
| Error sanitisation | SQL/stack traces stripped before client display | ✅ |
| CORS | Production-locked to `thefinanciar.com` domains; dev permissive | ✅ |
| CSP | Strict directives in production (self + Stripe + Paystack + S3) | ✅ |
| Non-root container | Docker runs as `appuser:appgroup` (UID 1001) | ✅ |
| Secrets management | AWS Secrets Manager; not in `.env.example` | ✅ |
| Token storage (web) | localStorage (XSS exposure — see [AUD-FE-001](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register)) | ❌ planned [LU-010](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-010-auth-cookie-modernization) |
| Cert pinning (mobile) | Not implemented | ❌ planned [LU-006b](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-006b--certificate-pinning) |
| Jailbreak detection (mobile) | Not implemented | ❌ planned [LU-006a](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-006a--jailbreak--root-detection) |

### KYC / identity verification

**Multi-provider KYC:**

- **Stripe Identity** — automated document + selfie verification (US, EU, UK, AU, CA)
- **Paystack BVN** — Bank Verification Number resolution (Nigeria) — migrated in commit `d99c31a`
- **Manual KYC** — document upload + admin review (markets without automated providers)

**Country-specific ID types:**

| Country | ID types accepted |
|---|---|
| Nigeria | BVN, NIN, Voter's Card, Driver's License, International Passport |
| Ghana | Ghana Card, Voter's ID, Driver's License, Passport |
| Kenya | National ID, Passport, Alien Card |
| South Africa | SA ID, Passport, Asylum Document |
| US | SSN, Driver's License, Passport, State ID |
| UK | Passport, Driver's License, BRP |
| EU | National ID, Passport |
| Other | Passport, National ID, Driver's License |

---

## 7. Feature Catalog

### 7.1 Dashboard

- Balance overview (local currency + USD + escrow)
- Virtual account details (account number, bank name, routing/SWIFT)
- Fund wallet, withdraw, send-money dialogs
- Recent transactions feed (currently sourced from `transactions` table — does not include wallet transfers/bill payments until [LU-001](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-001-wallet--transaction-bridge) lands)
- AI-powered financial insights
- KPI cards (net cash flow, pending expenses, overdue bills, budget utilisation)
- Guided product tour (8 steps, auto-starts on first visit)
- Quick actions FAB

### 7.2 Multi-currency wallets

- Per-user, per-currency wallets with real-time balances
- `balance`, `availableBalance`, `pendingBalance` tracking
- Atomic credit/debit operations with row-level locking
- Full transaction ledger per wallet (`wallet_transactions`)
- Cross-wallet transfers with exchange-rate application
- Transaction reversals with idempotency guards (verified at `storage.ts:1722-1725`)
- DB-level uniqueness on `(user_id, currency)` — prevents duplicate wallets ([migrations/0007](migrations/0007_add_security_constraints.sql))

### 7.3 Expense management

- Create/edit/delete expenses with categories, receipts, notes
- Receipt upload via file/camera (multer on server, image picker on mobile)
- Approval workflow: PENDING → APPROVED / REJECTED / CHANGES_REQUESTED → PAID
- Batch approval for admins
- Approve-and-pay: approve expense + initiate payout in one action (triple-gate enforced)
- Vendor linking on expenses
- Department tagging
- Tagged reviewers

### 7.4 Bill management & utility payments

- Bill tracking with due dates, categories, recurring schedules
- Bill approval workflow (approve / reject / request changes)
- Atomic bill payment from wallet (all 7 tracking fields populated atomically — verified at `storage.ts:1530-1538`)
- Recurring bill auto-generation via scheduler (every 1h; **single-instance only — see [AUD-BE-001](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register)**)
- **Utility payments** (Paystack markets):
  - Airtime top-up
  - Data bundles
  - Electricity (prepaid/postpaid)
  - Cable TV (DStv, GOtv, StarTimes)
  - Internet

### 7.5 Budget management

- Create budgets by category with spending limits
- Period options: monthly, quarterly, yearly
- Real-time spent tracking with progress indicators
- Near-limit warnings (80%+ utilisation)
- Over-budget alerts

### 7.6 Virtual cards (Stripe Issuing)

- Create virtual and physical cards
- Fund cards from wallet (atomic operation, FOR UPDATE on wallet AND card row at `storage.ts:1595-1599`)
- Freeze/unfreeze cards
- View sensitive card details (PAN, CVV) with rate limiting
- Spending controls (per-transaction limits, merchant categories)
- Cancel cards permanently
- Card transaction history

### 7.7 Virtual bank accounts

- Create virtual accounts for receiving payments
- **Paystack DVA** (Dedicated Virtual Accounts) for Nigerian Naira
- **Stripe Treasury** for USD/EUR/GBP accounts
- Account details: number, bank name, routing number, SWIFT code (verify schema completeness — [AUD-VA-1](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register))
- Balance tracking per account

### 7.8 Invoicing

- Create invoices with line items (description, quantity, rate)
- Auto-generated sequential invoice numbers (e.g. `INV-2026-001`)
- Tax calculation (configurable rate)
- Multi-currency support
- Send invoices via email (AWS SES or M365 SMTP)
- **Public payment page** (`/pay/:id`) — clients pay invoices without authentication
- Payment via Stripe or Paystack based on invoice currency
- Status tracking: pending, paid, overdue

### 7.9 Payroll

- Add employees with salary, bonus, deductions breakdown (tax, pension, insurance)
- Net pay auto-calculation
- Department assignment with bank details
- Process payroll (batch payout to all employees)
- Individual payroll payments
- Recurring payroll with auto-generation (every 1h scheduler tick)
- Tax estimation endpoint
- Country-aware bank validation

### 7.10 Vendor management

- Vendor directory with contact info, category, payment terms
- Track total paid and pending payments (aggregated from payouts)
- Pay vendors directly from vendor profile
- Link vendors to expenses
- Payout destination management per vendor
- (Currency on vendors is missing — see [AUD-BE-013](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register))

### 7.11 Team & company management

- **Multi-company:** users can create and switch between multiple businesses (`X-Company-Id` header on all client requests)
- **Company invitations:** email-based invites with token-based acceptance
- **Roles:** OWNER, ADMIN, MANAGER, EDITOR, EMPLOYEE, VIEWER
- **Departments:** create departments with budgets, heads, and colour coding
- **Team members:** CRUD with role/department assignment
- **Permissions:** 9 granular permissions assignable per role

### 7.12 Analytics & reporting

- **Dashboard analytics:** summary totals, KPIs
- **Cash flow analysis:** income vs expenses over time
- **Vendor performance:** spending by vendor
- **Payroll summary:** payroll analytics
- **Category breakdowns:** spending by category
- **Business insights:** AI-generated recommendations (OpenAI)
- **Analytics snapshots:** historical period data (daily/weekly/monthly)
- **Report generation:** export to PDF/CSV with date ranges
- **Report types:** expense, revenue, budget, tax, custom

### 7.13 Notifications

- **4 channels:** in-app, email (AWS SES or M365 SMTP), SMS (AWS SNS), push (Expo)
- **14 notification types:** expense_submitted, expense_approved, expense_rejected, payment_received, payment_sent, bill_due, bill_overdue, budget_warning, budget_exceeded, kyc_approved, kyc_rejected, card_transaction, team_invite, system_alert

### 7.14 Admin panel

- User management (list, role/status updates, suspension, hard delete)
- Audit logs (paginated, filterable by action/user)
- Organization settings + API key generation
- Security (2FA, IP whitelisting, session termination — feature surface present, several controls in development)
- Wallets (balances, funding history)
- Payouts (batch creation, settlement logs)
- Exchange rates (manual update)
- **Database management** — currently a one-click purge endpoint behind `requireAdmin` (see [AUD-BE-003](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register); replacement specified in [LU-008](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-008-database-purge-hardening))

---

## 8. Database Architecture

**42 `pgTable` definitions** in [`shared/schema.ts`](shared/schema.ts).

### Tables by domain

| Domain | Tables |
|---|---|
| Tenancy & users | `companies`, `companyMembers`, `companyInvitations`, `userProfiles`, `users` (legacy/deprecated) |
| Financial ledgers | `transactions`, `walletTransactions`, `wallets`, `companyBalances` |
| Money movement | `expenses`, `bills`, `invoices`, `payouts`, `payoutDestinations`, `fundingSources`, `payrollEntries`, `scheduledPayments`, `vendors` |
| Cards & accounts | `virtualCards`, `cardTransactions`, `virtualAccounts` |
| Compliance & audit | `kycSubmissions`, `auditLogs`, `processedWebhooks`, `dataRetentionPolicies` |
| Notifications | `notifications`, `notificationSettings`, `pushTokens` |
| Configuration | `organizationSettings`, `systemSettings`, `adminSettings`, `rolePermissions`, `companySettings`, `sessionSettings` (legacy) |
| Reporting & teams | `analyticsSnapshots`, `businessInsights`, `reports`, `budgets`, `departments`, `teamMembers` |
| Billing | `subscriptions` |
| FX | `exchangeRates`, `exchangeRateSettings` |

### Multi-tenant scoping

Every financial table now has a `companyId` column with FK to `companies.id`:

- `cascade` on `companyMembers`, `companyInvitations`, `budgets`, `departments`, `teamMembers`
- `set null` on `expenses`, `bills`, `transactions`, `virtualCards`, `payrollEntries`, `invoices`, `vendors`, `walletTransactions` (preserves history if a company is deleted)

Indexes on `companyId` are present everywhere — verified by grep.

### Migrations

8 hand-written SQL files in [`migrations/`](migrations/), run idempotently by [`scripts/run-migration.cjs`](scripts/run-migration.cjs) on container startup.

| File | Purpose |
|---|---|
| `0000_natural_outlaw_kid.sql` | Initial schema + indices |
| `0001_schema_refactor.sql` | Consolidate tables + FKs |
| `0002_add_indexes_and_fk.sql` | FK constraints + indices (incl. `transactions.walletTransactionId` FK at SQL level) |
| `0003_add_missing_columns.sql` | Add columns to existing tables |
| `0004_subscriptions_and_billing.sql` | Subscription + scheduled payment tables |
| `0005_ensure_all_columns.sql` | Fill schema gaps |
| `0006_add_indexes_and_unique_reference.sql` | Index transaction reference |
| `0007_add_security_constraints.sql` | Unique on `wallets(user_id, currency)`; unique on `wallet_transactions(reference)`; partial unique on `transactions(reference)` |

Planned (per `LOGIC_UPGRADE_PROPOSALS.md`):

| File | From | Purpose |
|---|---|---|
| `0008_backfill_transactions_from_wallet.sql` | [LU-001](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-001-wallet--transaction-bridge) | Bridge wallet ledger → transactions |
| `0009_scheduler_advisory_lock.sql` | [LU-002](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-002-scheduler-leader-election) | SQL helper for advisory lock |
| `0010_soft_delete_on_financial_tables.sql` | [LU-004](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-004-soft-delete-on-financial-tables) | `deleted_at` + filtered indices |
| `0011_card_transactions_currency.sql` | [LU-005](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-005-cardtransactions-currency-column) | Add currency to card_transactions |
| `0012_pending_destructive_actions.sql` | [LU-008](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-008-database-purge-hardening) | Two-admin purge approval table |
| `0013_reconciliation_reports.sql` | [LU-014](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-014-payment-reconciliation-job) | Daily ledger reconciliation report |

---

## 9. API Surface

**~517 endpoints** across `server/routes/*.ts` and the legacy `server/routes.legacy.ts`. Mounted at `/api`. OpenAPI spec at [`docs/openapi.yaml`](docs/openapi.yaml) (~5,000 lines, autogenerated).

### Domain modules

| Module | Domain |
|---|---|
| `accounts.routes.ts` | Virtual bank accounts |
| `admin.routes.ts` | Admin panel (users, audit logs, organization, security, purge) |
| `analytics.routes.ts` | Dashboard analytics, KPIs, business insights |
| `balances.routes.ts` | Company balances, escrow |
| `bills.routes.ts` | Bills CRUD + payment + recurring |
| `budgets.routes.ts` | Budgets CRUD + utilisation |
| `cards.routes.ts` | Virtual cards (Stripe Issuing) |
| `companies.routes.ts` | Company CRUD + switching |
| `expenses.routes.ts` | Expenses CRUD + approval workflow + batch approve-and-pay |
| `health.routes.ts` | `/api/health` for ALB health check |
| `invoices.routes.ts` | Invoices CRUD + public payment page support |
| `kyc.routes.ts` | KYC submissions, Stripe Identity, Paystack BVN |
| `notifications.routes.ts` | In-app notifications + push token registration |
| `payment-methods.routes.ts` | Saved payment methods (cards, bank accounts) |
| `payments.routes.ts` | Stripe + Paystack payment initiation |
| `payouts.routes.ts` | Payouts to vendors, employees |
| `payroll.routes.ts` | Payroll entries + processing + tax estimation |
| `reports.routes.ts` | PDF/CSV export of expense, revenue, budget, tax reports |
| `scheduled.routes.ts` | Scheduled payments CRUD |
| `settings.routes.ts` | User profile, password change, account closure |
| `team.routes.ts` | Team members, departments, invitations |
| `transactions.routes.ts` | Transaction history (currently `transactions` only — see [AUD-BE-002](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register)) |
| `vendors.routes.ts` | Vendor CRUD + payments |
| `wallets.routes.ts` | Wallet CRUD + funding + transfers + reversals |
| `webhooks.routes.ts` | Stripe + Paystack webhook receivers (signature-verified) |

Plus utilities: `index.ts` (route registration), `shared.ts` (`verifyCompanyAccess`, `resolveUserCompany`, `logAudit`).

### Cross-cutting middleware

| Middleware | File | Purpose |
|---|---|---|
| `helmet` | `index.ts:65-80` | Security headers, strict CSP in production |
| `cors` | `index.ts:110-124` | Origin allowlist, credentials, custom headers |
| `csrfProtection` | `middleware/csrf.ts` | `X-Requested-With` enforcement on `/api` |
| `apiLimiter` | `middleware/rateLimiter.ts` | 5-tier rate limiting |
| `requestLogger` | `lib/logger.ts:64-96` | Correlation IDs, status-aware level routing |
| `requireAuth` | `middleware/auth.ts` | Cognito JWT verification |
| `requireAdmin` | `middleware/auth.ts` | Role check + company scope |
| `requirePin` | `middleware/auth.ts` | Transaction PIN verification + financial limiter |

---

## 10. Payment Infrastructure

### Per-country routing

Source of truth: [`shared/constants.ts`](shared/constants.ts).

| Country code | Provider | Currency |
|---|---|---|
| NG, GH, KE, ZA, TZ, RW, SN, UG, ZM, ZW | Paystack | NGN, GHS, KES, ZAR, TZS, RWF, USD |
| US, CA, GB, EU (DE/FR/etc.), AU, etc. | Stripe | USD, CAD, GBP, EUR, AUD, etc. |

### Stripe integration

[`server/stripeClient.ts`](server/stripeClient.ts) and [`server/webhookHandlers.ts`](server/webhookHandlers.ts) (1,205 lines). Events handled:

- `payment_intent.succeeded` / `payment_intent.payment_failed`
- `checkout.session.completed`
- `charge.refunded`
- `issuing_transaction.created` (for virtual card spend)
- `transfer.paid` / `transfer.failed` / `transfer.reversed`
- `payout.paid` / `payout.failed`
- `treasury.received_credit.created` / `treasury.outbound_payment.posted`

Signature verification via `stripe.webhooks.constructEvent` with raw body captured by the JSON parser's `verify` callback.

### Paystack integration

[`server/paystackClient.ts`](server/paystackClient.ts) and [`server/paystackWebhook.ts`](server/paystackWebhook.ts) (~22 KB). Events handled:

- `charge.success`
- `transfer.success` / `transfer.failed` / `transfer.reversed`
- `refund.processed` / `refund.failed`

Signature verification via HMAC-SHA512 with `crypto.timingSafeEqual` to prevent timing attacks.

### Idempotency

- Webhook events: `processed_webhooks` table tracks (eventId, provider, eventType)
- Wallet transactions: DB-level UNIQUE on `wallet_transactions(reference)` (since [migration 0007](migrations/0007_add_security_constraints.sql))
- Reversals: code-level guard at `storage.ts:1722-1725` plus `walletTransactions.reversedAt` timestamp

### Refunds & reversals

| Path | Trigger |
|---|---|
| Stripe | `charge.refunded` webhook → update transaction, credit wallet |
| Paystack | `refund.processed` webhook → similar |
| Manual | `atomicReversal` via admin endpoint |

Reconciliation against provider ledgers is **not yet automated** — proposed in [LU-014](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-014-payment-reconciliation-job).

---

## 11. Billing & Subscription Model

`subscriptions` table tracks per-company subscription state. Today the platform supports a flat-rate model (set up via Stripe and/or Paystack); tiered pricing is proposed in [`BRD_2026_04_26.md`](docs/audit-2026-04-26/BRD_2026_04_26.md) Part B.

Planned tiers (subject to Godwin's pricing call):

| Tier | Audience | Headline price | Features |
|---|---|---|---|
| Free | Solo / trial | $0 | Single user, single company, 50 transactions/mo, basic reports |
| Starter | Solo entrepreneurs | $9–19/mo | Single user, single company, unlimited transactions, virtual cards, basic invoicing |
| Pro | SMB | $49–99/mo | Up to 10 users, multi-currency, payroll, KYC, advanced reports, priority support |
| Enterprise | Larger SMBs | $199+/mo or custom | Unlimited users, multi-company, custom roles, SSO (planned), dedicated support, SLA |

Transaction fees layer on top: a markup over Stripe/Paystack base fees (e.g. +0.4% + ₦20 / +0.4% + $0.20). See BRD Part B for the modelling framework.

---

## 12. Third-Party Services & API Costs

| Service | Purpose | Pricing model | Approximate cost (current scale) |
|---|---|---|---|
| AWS Cognito | Auth | $0.0055 per MAU above 50,000 free | $0 |
| AWS RDS PostgreSQL | Database | t3.micro $14/mo + storage $0.115/GB-mo | $15-25/mo |
| AWS ECS Fargate | API + web | $0.04/vCPU-hr + $0.004/GB-hr; current task: 0.5 vCPU + 1 GB | $20-40/mo |
| AWS ALB | Load balancer | $16/mo + $0.008/LCU-hr | $18-25/mo |
| AWS NAT Gateway | Egress | $0.045/hr + $0.045/GB processed | $32/mo (single NAT — see [AUD-IN-002](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register)) |
| AWS SES | Email | $0.10 per 1k | $1-5/mo |
| AWS SNS | SMS | varies by region; ~$0.04 per SMS to Nigeria | $5-30/mo |
| AWS Secrets Manager | Secrets | $0.40/secret/mo | $2/mo |
| AWS CloudWatch Logs | Logging | $0.50/GB ingested | $5-15/mo |
| Stripe | Payments | 2.9% + $0.30 (US); per-country variants | pass-through to customer |
| Paystack | Payments | 1.5% + ₦100 (capped at ₦2,000) NG | pass-through |
| Microsoft 365 | SMTP fallback | included with M365 sub | included |
| Expo Push Notifications | Push | Free | $0 |
| Sentry / Honeycomb / Datadog | Observability | Free tier sufficient at current scale | $0 (planned) |

**Estimated baseline AWS cost: $100–175/month.** Multi-AZ RDS adds ~$15–30/mo; multi-NAT adds $32/mo; multi-environment dev/staging adds $60–120/mo.

---

## 13. Supported Countries & Currencies

### Active payment integrations

| Country | Currency | Provider | KYC method |
|---|---|---|---|
| Nigeria | NGN | Paystack | Paystack BVN, NIN, Voter's Card |
| Ghana | GHS | Paystack | Manual (Ghana Card) |
| Kenya | KES | Paystack | Manual (National ID) |
| South Africa | ZAR | Paystack | Manual (SA ID) |
| Tanzania | TZS | Paystack | Manual |
| Rwanda | RWF | Paystack | Manual |
| Senegal | XOF | Paystack | Manual |
| Uganda | UGX | Paystack | Manual |
| Zambia | ZMW | Paystack | Manual |
| Zimbabwe | USD | Paystack | Manual |
| United States | USD | Stripe | Stripe Identity |
| Canada | CAD | Stripe | Stripe Identity |
| United Kingdom | GBP | Stripe | Stripe Identity |
| EU (DE/FR/IE/etc.) | EUR | Stripe | Stripe Identity |
| Australia | AUD | Stripe | Stripe Identity |

Google Play distribution: 177 countries (Play Store availability list). Active payments: as above. Other countries can sign up but cannot process payments.

---

## 14. Mobile App

- **Bundle ID:** `com.financiar.app`
- **Version:** 1.0.3, versionCode 6
- **Distribution:** Google Play **internal track only** as of 2026-04-26 (production track not yet promoted; iOS App Store not submitted)
- **Min SDK:** Android 24 (Android 7.0 / Nougat)
- **Target SDK:** Android 35
- **Permissions declared:** `USE_BIOMETRIC`, `USE_FINGERPRINT`, plus standard internet/network state

### Screens (22 total)

**Auth (3):** LoginScreen, SignupScreen, ForgotPasswordScreen
**Onboarding (1):** OnboardingScreen (3-step wizard: country → company → KYC)
**Main tabs (5):** DashboardScreen, WalletScreen, ExpensesScreen, BillsScreen, SettingsScreen
**More stack (13):** TransactionsScreen, BudgetScreen, CardsScreen, InvoicesScreen, VendorsScreen, TeamScreen, PayrollScreen, AnalyticsScreen, ReportsScreen, VirtualAccountsScreen, NotificationsScreen, KYCScreen, InviteAcceptScreen

### Mobile auth flow

```
1. User enters email/password OR taps Google OAuth
2. Cognito SDK handles auth (hosted UI for OAuth, direct SDK for email)
3. JWT tokens stored in AsyncStorage (planned: encrypted secure store — LU-006c)
4. On subsequent launches, biometric (Face ID / Fingerprint) via expo-local-authentication
5. Network detection via @react-native-community/netinfo
6. On reconnect, queued mutations auto-sync from AsyncStorage
```

### Mobile-specific risks (from audit)

| Risk | Status | Tracked in |
|---|---|---|
| No jailbreak/root detection | OPEN — HIGH | [AUD-MO-001](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register) |
| No certificate pinning | OPEN — HIGH | [AUD-MO-002](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register) |
| AsyncStorage unencrypted | OPEN — HIGH | [AUD-MO-003](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register) |
| Biometric not re-prompted on each financial action | OPEN — MEDIUM | [AUD-MO-004](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register) |
| Push notifications: no device segmentation | OPEN — LOW | [AUD-MO-007](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register) |
| Offline-first reads not implemented (only mutation queue) | OPEN — MEDIUM | [AUD-MO-006](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register) |
| No crash reporting (Sentry/Bugsnag) | OPEN — MEDIUM | [AUD-MO-005](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register) |
| Expo OTA updates not explicitly disabled in production | OPEN — LOW | [AUD-IN-008](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register) |

Remediation specified in [LU-006](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-006-mobile-hardening) (3-5 days bundle).

---

## 15. Infrastructure & Deployment

### CDK stack

[`infrastructure/lib/financiar-stack.ts`](infrastructure/lib/financiar-stack.ts) defines:

- **VPC:** 2 AZs, **1 NAT gateway** (single point of failure — see [AUD-IN-002](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register))
- **RDS:** PostgreSQL 16.4 on `t3.micro`, **single-AZ** ([AUD-IN-003](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register)), 7-day backups, deletion protection enabled, removal policy `RETAIN`, encrypted at rest
- **ECR:** lifecycle keeps last 10 images
- **ECS Cluster:** Container Insights enabled
- **ECS Task:** 512 CPU / 1024 MB; non-root user `appuser` UID 1001; healthcheck on `/api/health`
- **ECS Service:** desiredCount 0 baseline (manual scale-up after ECR push), auto-scaling min 1 / max 4 at 70% CPU target, circuit-breaker rollback on health-check failure
- **ALB:** internet-facing; HTTPS listener if `certificateArn` provided, HTTP→HTTPS redirect; HTTP-only fallback for initial deploy
- **Secrets:** AWS Secrets Manager; granted to ECS task role; no plaintext secrets in `.env.example`
- **IAM:** task role granted `ses:SendEmail`, `sns:Publish`, secrets read

### CI/CD

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — triggered on push to `main` or manual dispatch:

1. Checkout
2. Configure AWS credentials via OIDC (`AWS_DEPLOY_ROLE_ARN`)
3. ECR login
4. `docker build` with `VITE_*` build args + push (tags `<sha>` and `latest`)
5. `aws ecs update-service --force-new-deployment`
6. `aws ecs wait services-stable` (10-min timeout)

**No test gate** — see [AUD-IN-001](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register) and [LU-007](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-007-ci-test-gate).

### Dockerfile

Multi-stage:

- **Builder:** Node 22 Alpine, npm 11 (via tarball fallback), `npm ci`, `VITE_*` build args, `npm run build`
- **Production:** Node 22 Alpine, copy `dist`/`migrations`/`scripts`, non-root user, healthcheck on `/api/health`, `CMD: node scripts/run-migration.cjs migrate && node dist/index.cjs`

(Production image still ships dev dependencies — minor cleanup tracked in [AUD-IN-005](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register).)

### Environment variables

Total ~40+. Core:

- **Server:** `DATABASE_URL`, `NODE_ENV`, `SESSION_SECRET`, `APP_URL`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_IDENTITY_WEBHOOK_SECRET`, `PAYSTACK_SECRET_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_SES_FROM_EMAIL`, `AWS_SNS_SENDER_ID`, optional `SMTP_*` for M365
- **Client:** `VITE_COGNITO_*`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_PAYSTACK_PUBLIC_KEY`
- **Mobile:** `EXPO_PUBLIC_*`

`.env.example` contains placeholder values only; no real secrets are committed.

---

## 16. Operational Runbooks

Runbooks live in [`docs/runbooks/`](docs/runbooks/) (planned). Initial set:

| Runbook | Purpose |
|---|---|
| `incident-payment-down.md` | Triage when Stripe or Paystack outage detected |
| `incident-database-down.md` | RDS failover / restore from snapshot |
| `incident-ecs-deploy-failed.md` | Rollback procedure (ECS circuit-breaker auto-rolls; manual fallback documented) |
| `routine-rotate-secrets.md` | Cognito client secret, Stripe webhook secret, Paystack secret rotation cadence |
| `routine-database-purge.md` | Two-admin purge procedure post-[LU-008](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-008-database-purge-hardening) |
| `routine-mobile-release.md` | EAS build → internal track → production promotion |
| `routine-cdk-deploy.md` | Provisioning a new env (post-multi-env [LU-012](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-012-multi-nat-multi-env-cdk)) |

Each runbook should answer: trigger, severity, on-call engineer, first 5 minutes, escalation path, all-clear criteria.

---

## 17. Mobile–Web Parity Matrix

| Feature | Web | Mobile | Notes |
|---|---|---|---|
| Login (email/password) | ✅ | ✅ | |
| Login (Google OAuth) | ✅ | ✅ | |
| Login (SMS OTP) | ✅ | ✅ | |
| Biometric login | — | ✅ | Mobile only |
| Signup + onboarding | ✅ | ✅ | |
| Dashboard | ✅ | ✅ | |
| Transactions | ✅ | ✅ | Web filters more granular |
| Expenses (CRUD + approval) | ✅ | ✅ | |
| Bills (CRUD + payment + utility) | ✅ | ✅ | |
| Budgets | ✅ | ✅ | |
| Virtual cards | ✅ | ✅ | Reveal PAN/CVV: web only at this version |
| Virtual accounts | ✅ | ✅ | |
| Invoices (CRUD + send) | ✅ | ✅ | |
| Public invoice payment | ✅ | — | Web link, viewable on mobile browser |
| Payroll | ✅ | ✅ | |
| Vendors | ✅ | ✅ | |
| Team management | ✅ | ✅ | Mobile invitation flow simpler |
| Analytics & charts | ✅ Recharts | ✅ Victory Native (simplified) | |
| Reports (PDF/CSV export) | ✅ | partial | Mobile shows summaries; CSV export web-only |
| Notifications (in-app feed) | ✅ | ✅ | |
| Push notifications | — | ✅ | Mobile only |
| Settings (profile + password) | ✅ | ✅ | |
| Account closure | ✅ | partial | |
| **Admin: users, audit logs, etc.** | ✅ | — | Web only |
| **Admin: exchange rates** | ✅ | — | Web only |
| **Admin: database management** | ✅ | — | Web only (purge — see [LU-008](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-008-database-purge-hardening)) |
| Offline mutation queue | — | ✅ | Mobile only |
| Offline reads | — | partial (cache only) | Both [AUD-MO-006](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register) |

Admin features are intentionally web-only — mobile is the customer-facing surface.

---

## 18. Feature Flags

**Current state:** no feature-flag infrastructure. Flags are env-var booleans.

**Proposal:** introduce GrowthBook (self-hosted, MIT-licensed) once the customer base supports per-customer rollouts. Until then, a small in-database flag table (`system_settings` already supports key-value flags) is sufficient for the rollout patterns described in the upgrade proposals.

Flags planned during the LU rollout:

| Flag | Owner | Default (prod) |
|---|---|---|
| `BRIDGE_WALLET_TO_TRANSACTIONS` | LU-001 | `false` initially → `true` after backfill |
| `AUTH_COOKIE_MODE` | LU-010 | `false` → `true` after rollout |
| `allow_purge_endpoint` | LU-008 | `false` (set by ops only when intentionally purging) |
| `RECONCILIATION_PAGE_ON_DIFF` | LU-014 | `false` until tuned |

---

## 19. Non-Functional Requirements

| Category | Target | Current state |
|---|---|---|
| **Availability** | 99.5% in 2026, 99.9% in 2027 | Single-AZ RDS + single-NAT means SLA cannot exceed AWS regional AZ uptime (~99.95%). After [LU-012](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-012-multi-nat-multi-env-cdk), 99.9% is realistic. |
| **API p95 latency** | < 300ms for read endpoints | Unmeasured. APM ([LU-013](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-013-observability)) needed to verify. |
| **API p99 latency** | < 1s | Unmeasured. |
| **Webhook acknowledgement** | < 200ms p95 | Unmeasured. |
| **Atomic op throughput** | 50 TPS sustained | Single-instance ECS at default sizing handles this; needs validation under load. |
| **Recovery Time Objective (RTO)** | 1 hour | Manual ECS rollback + DB restore from snapshot. After multi-AZ, automated failover < 5 min. |
| **Recovery Point Objective (RPO)** | 24 hours | RDS automated daily backups; 7-day retention. |
| **Mobile cold start** | < 3s | Untested. |
| **Tests passing in CI** | 100% required | **No test gate** today — see [LU-007](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-007-ci-test-gate). |
| **Security incident response** | < 1 hour for CRITICAL | No formal IR process documented. |

---

## 20. Known Limitations & Tech Debt

This list is a curated subset of [`AUDIT_2026_04_26.md`](docs/audit-2026-04-26/AUDIT_2026_04_26.md), with emphasis on items that affect product behaviour or roadmap decisions.

### Critical (do not ignore)

- **[AUD-BE-001](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register)**: Recurring scheduler runs on every ECS instance. Multi-instance scaling is not safe today.
- **[AUD-BE-002](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register)**: Wallet ↔ Transactions ledger split. Transactions page does not show wallet operations.
- **[AUD-BE-003](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register)**: One-click full database purge endpoint with a single admin's auth.
- **[AUD-IN-001](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register)**: No CI test gate. Any commit on `main` ships.

### High

- **[AUD-IN-002](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register) + [AUD-IN-003](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register) + [AUD-IN-004](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register)**: Single-NAT, single-AZ RDS, single-stack CDK.
- **[AUD-FE-001](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register)**: Cognito tokens in localStorage.
- **[AUD-FE-005](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register)**: Client-side validation duplicated; not reusing shared Zod schemas.
- **[AUD-MO-001](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register) / [-002](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register) / [-003](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register)**: Mobile lacks jailbreak detection, certificate pinning, encrypted local storage.
- **[AUD-BE-004](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register)**: Scheduler uses `console.log` instead of pino.
- **[AUD-BE-005](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register)**: Mock-heavy tests — no testcontainers Postgres.
- **[AUD-BE-007](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register)**: `cardTransactions.currency` missing.
- **[AUD-BE-009](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register)**: Legacy `routes.legacy.ts` still in tree.

### Medium / Low

See full list in [`AUDIT_2026_04_26.md` § 7](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register). Most are 0.5- to 1-day fixes.

---

## 21. Roadmap

### Q2 2026 (May–June) — operational maturity

Theme: **make the platform safe to scale.** All items map to [`LOGIC_UPGRADE_PROPOSALS.md`](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md).

- ✅ CI test gate ([LU-007](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-007-ci-test-gate))
- ✅ Scheduler leader election ([LU-002](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-002-scheduler-leader-election)) + pino-ify ([LU-003](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-003-pino-ify-the-scheduler))
- ✅ Database purge hardening ([LU-008](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-008-database-purge-hardening))
- ✅ Multi-NAT + multi-environment CDK ([LU-012](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-012-multi-nat-multi-env-cdk))
- ✅ Wallet ↔ transactions bridge ([LU-001](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-001-wallet--transaction-bridge))
- ✅ Auth cookie modernization ([LU-010](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-010-auth-cookie-modernization))
- ✅ Shared Zod schemas on client ([LU-009](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-009-shared-zod-schemas-on-client))
- ✅ Mobile hardening bundle ([LU-006](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-006-mobile-hardening))
- ✅ Observability (OTel + auto PII redaction) ([LU-013](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-013-observability))

### Q3 2026 (July–September) — feature consolidation

- Storage god-object → domain services ([LU-011](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-011-storage-layer-domain-split))
- Soft-delete on financial tables ([LU-004](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-004-soft-delete-on-financial-tables))
- Daily payment reconciliation ([LU-014](docs/audit-2026-04-26/LOGIC_UPGRADE_PROPOSALS.md#lu-014-payment-reconciliation-job))
- iOS App Store submission (mobile)
- Real testcontainers integration tests ([AUD-BE-005](docs/audit-2026-04-26/AUDIT_2026_04_26.md#7-risk-register))
- SSO (Okta / Google Workspace) for Enterprise tier — discovery + spec
- Apple Pay / Google Pay on the public invoice page
- Spend categorisation ML — discovery

### Q4 2026 — growth features

- Subscription billing for paying tiers (driven by BRD pricing model)
- Affiliate / referral programme
- Compliance roadmap milestones (SOC 2 Type 1 audit kick-off — see BRD Part D)
- Expanded country support (Egypt, Côte d'Ivoire, Morocco)
- Fraud / sanctions screening (ComplyAdvantage or Sumsub)

### 2027

- 99.9% uptime SLA (multi-region RDS, blue/green ECS)
- Transaction monitoring dashboard for in-app fraud detection
- Open banking integrations (Plaid for US, Mono for Africa)
- Deep ledger reporting / customer-statement export
- Treasury / yield product (Stripe Treasury yield + local equivalents)

---

**Document state:** This PRD describes Spendly v4 as it exists in source today (HEAD `e831622`) plus the planned remediation work captured in `LOGIC_UPGRADE_PROPOSALS.md`. It supersedes v1.0 dated 2026-03-14. The previous v1.0 PRD is preserved in git history.
