# Financiar — Product Requirements Document (PRD)

> **Version:** 1.0 | **Date:** 2026-03-14 | **Author:** Godwin Agbane (Guru)
> **Product:** Financiar (formerly Spendly v4) | **Domain:** `app.thefinanciar.com`
> **Package:** `com.financiar.app` | **Brand Color:** `#6B2346`

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
16. [Non-Functional Requirements](#16-non-functional-requirements)
17. [Known Limitations & Tech Debt](#17-known-limitations--tech-debt)
18. [Roadmap Considerations](#18-roadmap-considerations)

---

## 1. Executive Summary

**Financiar** is a full-stack, multi-tenant fintech SaaS platform for personal and business finance management. It provides expense tracking, bill payments, payroll processing, virtual cards, multi-currency wallets, invoicing, vendor management, team collaboration, and AI-powered financial insights — all through a unified web and mobile experience.

The platform supports **dual payment processors** (Stripe for international markets, Paystack for African markets), enabling seamless global coverage across 177 countries. It features KYC/identity verification, role-based access control, transaction PIN security, and a comprehensive admin panel.

### Key Metrics (Current State)

| Metric | Count |
|--------|-------|
| API endpoints | ~250 unique |
| Database tables | 41 |
| Web pages | 36 |
| Mobile screens | 22 |
| Supported countries | 177 (Play Store) / 7 with active Paystack support |
| Payment processors | 2 (Stripe + Paystack) |
| Notification channels | 4 (in-app, email, SMS, push) |

---

## 2. Product Vision & Goals

### Vision
To be the go-to financial operating system for individuals and SMBs across emerging and established markets — combining treasury management, expense control, payment processing, and financial intelligence in a single platform.

### Goals
1. **Unified financial management** — One platform for all money operations (receive, hold, spend, track, report)
2. **Global accessibility** — Dual payment rail (Stripe + Paystack) ensures coverage in both Western and African markets
3. **SMB-first design** — Multi-tenant architecture with team roles, departments, approval workflows, and company switching
4. **Compliance-ready** — Built-in KYC, audit logging, transaction PINs, and role-based permissions
5. **Mobile parity** — Full-featured React Native app with biometric auth, push notifications, and offline support

---

## 3. Target Users

| Persona | Description |
|---------|-------------|
| **Solo Entrepreneurs** | Freelancers and sole traders managing personal/business finances |
| **SMB Owners** | Small business owners needing expense management, payroll, and invoicing |
| **Finance Teams** | Accountants and finance managers requiring approval workflows, budgets, and reporting |
| **Remote/Distributed Teams** | Companies with team members across multiple countries/currencies |
| **African Businesses** | Businesses in Nigeria, Ghana, Kenya, South Africa needing local payment rails |

---

## 4. Platform Overview

### Web Application
- **Framework:** React 18 + Vite + TypeScript
- **UI:** Tailwind CSS + shadcn/ui (47 Radix primitives) + Framer Motion
- **Routing:** Wouter (lightweight client-side routing)
- **State:** TanStack React Query v5
- **Pages:** 36 (12 public/auth, 18 dashboard, 6 admin)

### Mobile Application
- **Framework:** React Native 0.76 + Expo 52
- **Navigation:** React Navigation 6 (stack + bottom tabs)
- **Screens:** 22 (3 auth, 1 onboarding, 5 main tabs, 14 secondary)
- **Distribution:** Google Play Store (`com.financiar.app`, v1.0.3, versionCode 6)
- **Unique features:** Biometric auth, push notifications, offline sync, secure credential storage

### Backend
- **Framework:** Express 5.0 + TypeScript
- **ORM:** Drizzle ORM 0.39
- **Database:** PostgreSQL 16.4
- **Output:** Single CJS bundle (`dist/index.cjs`) serving both API and static client

---

## 5. Tech Stack

### Core Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + Vite + TypeScript | 18.3 / 5.4 / 5.6 |
| Mobile | React Native + Expo | 0.76 / 52 |
| Backend | Express + TypeScript | 5.0.1 / 5.6 |
| Database | PostgreSQL + Drizzle ORM | 16.4 / 0.39 |
| Auth | AWS Cognito | SDK v3 |
| Payments (Intl) | Stripe | 20.0.0 |
| Payments (Africa) | Paystack | REST API |
| Email | AWS SES | SDK v3 |
| SMS | AWS SNS | SDK v3 |
| Push | Expo Push Notifications | — |
| Infra | AWS ECS Fargate + RDS + ALB | CDK 2.170 |

### Frontend Libraries

| Category | Libraries |
|----------|-----------|
| UI Components | shadcn/ui (47 Radix primitives), Lucide icons, React Icons |
| Animations | Framer Motion 11.13 |
| Charts | Recharts 2.15 |
| Forms | React Hook Form 7.55 + Zod 3.24 |
| Routing | Wouter 3.3 |
| State | TanStack React Query 5.60 |
| Date | date-fns, react-day-picker |
| Tour | react-joyride |
| Carousel | embla-carousel-react |

### Mobile Libraries

| Category | Libraries |
|----------|-----------|
| Navigation | React Navigation 6 (native-stack + bottom-tabs) |
| Auth | amazon-cognito-identity-js |
| Biometrics | expo-local-authentication |
| Storage | AsyncStorage + expo-secure-store |
| Notifications | expo-notifications |
| Camera/Gallery | expo-image-picker |
| Browser | expo-web-browser |
| Clipboard | expo-clipboard |
| Network | @react-native-community/netinfo |
| Persistence | TanStack Query + AsyncStorage persister |

---

## 6. Authentication & Security

### Authentication Flow

```
User -> Cognito (email/password or Google OAuth or SMS OTP)
     -> JWT (id_token + access_token + refresh_token)
     -> Server verifies via aws-jwt-verify
     -> User profile synced to PostgreSQL (user_profiles table)
```

### Auth Methods
1. **Email + Password** — Standard Cognito user pool auth
2. **Google OAuth** — Cognito Hosted UI redirect -> code exchange
3. **SMS OTP** — Custom auth challenge flow via Cognito Lambda triggers
4. **Biometric (Mobile)** — Face ID / Fingerprint using expo-local-authentication; credentials stored in expo-secure-store

### Security Layers

| Layer | Implementation |
|-------|---------------|
| JWT verification | `aws-jwt-verify` on every authenticated request |
| Transaction PIN | 4-digit bcrypt-hashed PIN for financial operations |
| Role-based access | 6 roles: OWNER, ADMIN, MANAGER, EDITOR, EMPLOYEE, VIEWER |
| 9 granular permissions | VIEW_TREASURY, MANAGE_TREASURY, CREATE_EXPENSE, APPROVE_EXPENSE, SETTLE_PAYMENT, MANAGE_CARDS, MANAGE_TEAM, VIEW_REPORTS, MANAGE_SETTINGS |
| Rate limiting | 5 tiers: API (100/15min), Auth (5/15min), Sensitive (10/15min), Financial (3/1min), Email (3/1hr) |
| Audit logging | Every significant action logged with userId, IP, userAgent, entity details |
| Webhook idempotency | `processed_webhooks` table prevents duplicate event processing |
| Row-level locking | `SELECT ... FOR UPDATE` on wallet operations |
| Atomic transactions | All financial operations use PostgreSQL transactions |
| Input validation | Zod schemas on all API inputs |
| Error sanitization | SQL/stack traces stripped from client-facing errors |
| CORS | Production-locked to `thefinanciar.com` domains |
| Non-root container | Docker runs as `appuser:appgroup` (UID 1001) |

### KYC / Identity Verification

**Multi-provider KYC:**
- **Stripe Identity** — Automated document + selfie verification (US, EU, UK)
- **Paystack BVN** — Bank Verification Number resolution (Nigeria)
- **Manual KYC** — Document upload + admin review

**Country-specific ID types:**
| Country | ID Types |
|---------|----------|
| Nigeria | BVN, NIN, Voter's Card, Driver's License, International Passport |
| Ghana | Ghana Card, Voter's ID, Driver's License, Passport |
| Kenya | National ID, Passport, Alien Card |
| South Africa | SA ID, Passport, Asylum Document |
| US | SSN, Driver's License, Passport, State ID |
| UK | Passport, Driver's License, BRP |
| General | Passport, National ID, Driver's License |

---

## 7. Feature Catalog

### 7.1 Dashboard
- Balance overview (local currency + USD + escrow)
- Virtual account details (account number, bank name, routing)
- Fund wallet, withdraw, and send money dialogs
- Recent transactions feed
- AI-powered financial insights
- KPI cards (net cash flow, pending expenses, overdue bills, budget utilization)
- Guided product tour (8 steps, auto-starts on first visit)
- Quick actions FAB (Fund Wallet, New Expense, Pay Bills)

### 7.2 Multi-Currency Wallets
- Per-user, per-currency wallets with real-time balances
- `balance`, `availableBalance`, `pendingBalance` tracking
- Atomic credit/debit operations with row-level locking
- Full transaction ledger per wallet
- Cross-wallet transfers with exchange rate application
- Transaction reversals with idempotency guards

### 7.3 Expense Management
- Create/edit/delete expenses with categories, receipts, notes
- Receipt upload via file/camera (multer on server, image picker on mobile)
- Approval workflow: PENDING -> APPROVED/REJECTED/CHANGES_REQUESTED
- Batch approval for admins
- Approve-and-pay: Approve expense + initiate payout in one action
- Vendor linking on expenses
- Department tagging
- Tagged reviewers

### 7.4 Bill Management & Utility Payments
- Bill tracking with due dates, categories, recurring schedules
- Bill approval workflow (approve/reject/request changes)
- Pay bills from wallet (atomic wallet debit + bill status update)
- Recurring bill auto-generation via scheduler
- **Utility payments** (Paystack markets):
  - Airtime top-up
  - Data bundles
  - Electricity (prepaid/postpaid)
  - Cable TV (DStv, GOtv, StarTimes)
  - Internet

### 7.5 Budget Management
- Create budgets by category with spending limits
- Period options: monthly, quarterly, yearly
- Real-time spent tracking with progress indicators
- Near-limit warnings (80%+ utilization)
- Over-budget alerts

### 7.6 Virtual Cards (Stripe Issuing)
- Create virtual and physical cards
- Fund cards from wallet (atomic operation)
- Freeze/unfreeze cards
- View sensitive card details (PAN, CVV) with rate limiting
- Spending controls (per-transaction limits, merchant categories)
- Cancel cards permanently
- Card transaction history

### 7.7 Virtual Bank Accounts
- Create virtual accounts for receiving payments
- **Paystack DVA** (Dedicated Virtual Accounts) for Nigerian Naira
- **Stripe Treasury** for USD/EUR/GBP accounts
- Account details: number, bank name, routing number, SWIFT code
- Balance tracking per account

### 7.8 Invoicing
- Create invoices with line items (description, quantity, rate)
- Auto-generated sequential invoice numbers (INV-2026-001)
- Tax calculation (configurable rate)
- Multi-currency support
- Send invoices via email (AWS SES)
- **Public payment page** (`/pay/:id`) — clients pay invoices without authentication
- Payment via Stripe or Paystack based on invoice currency
- Status tracking: pending, paid, overdue

### 7.9 Payroll
- Add employees with salary, bonus, deductions breakdown (tax, pension, insurance)
- Net pay auto-calculation
- Department assignment with bank details
- Process payroll (batch payout to all employees)
- Individual payroll payments
- Recurring payroll with auto-generation
- Tax estimation endpoint
- Country-aware bank validation

### 7.10 Vendor Management
- Vendor directory with contact info, category, payment terms
- Track total paid and pending payments (aggregated from payouts)
- Pay vendors directly from vendor profile
- Link vendors to expenses
- Payout destination management per vendor

### 7.11 Team & Company Management
- **Multi-company:** Users can create and switch between multiple businesses
- **Company invitations:** Email-based invites with token-based acceptance
- **Roles:** OWNER, ADMIN, MANAGER, EDITOR, EMPLOYEE, VIEWER
- **Departments:** Create departments with budgets, heads, and color coding
- **Team members:** CRUD with role/department assignment
- **Permissions:** 9 granular permissions assignable per role

### 7.12 Analytics & Reporting
- **Dashboard analytics:** Summary totals, KPIs
- **Cash flow analysis:** Income vs expenses over time
- **Vendor performance:** Spending by vendor
- **Payroll summary:** Payroll analytics
- **Category breakdowns:** Spending by category
- **Business insights:** AI-generated recommendations
- **Analytics snapshots:** Historical period data (daily/weekly/monthly)
- **Report generation:** Export to PDF/CSV with date ranges
- **Report types:** Expense, revenue, budget, tax, custom

### 7.13 Notifications
- **4 channels:** In-app, email (AWS SES), SMS (AWS SNS), push (Expo)
- **14 notification types:** expense_submitted, expense_approved, expense_rejected, payment_received, payment_sent, bill_due, bill_overdue, budget_warning, budget_exceeded, kyc_approved, kyc_rejected, card_transaction, team_invite, system_alert
- Per-user channel preferences
- Unread count badge
- Mark as read (individual + bulk)
- Push token management with device tracking
- Test email endpoint

### 7.14 Admin Panel
- **Platform stats dashboard**
- **User management:** View, edit, suspend users
- **Audit logs:** Full audit trail viewer with filters
- **Organization settings:** Platform-level configuration
- **Security settings:** Session policies, 2FA enforcement
- **Wallet management:** View and manage platform wallets
- **Payout management:** Approve, process, reject payouts
- **Exchange rate management:** Set rates, configure markup, fetch live rates
- **Database tools:** Seed data, purge database, run scheduler
- **Role & permission management**

### 7.15 Onboarding
- **4-step wizard (web) / 3-step wizard (mobile):**
  1. Account type selection (personal/business)
  2. Profile details (name, country, currency, phone, DOB, business info)
  3. KYC verification (country-specific ID, address)
  4. Completion (creates company, wallet, virtual accounts, subscription)
- Auto-provisioning: Company + wallet + virtual account + trial subscription created in one transaction

### 7.16 Settings
- **Profile:** Display name, photo, phone, timezone, language, date format
- **Company:** Name, email, phone, address, currency, fiscal year, branding (logo, colors), invoice settings
- **Notifications:** Per-channel toggles, per-category toggles, weekly digest
- **Security:** Transaction PIN (enable/disable/change), 2FA, session timeout
- **Billing:** Subscription management, plan details, payment method
- **KYC:** Verification status and resubmission

---

## 8. Database Architecture

### Overview
- **41 tables** in PostgreSQL via Drizzle ORM
- **Multi-tenant architecture** — `companies` table is the central hub with 24 foreign keys pointing to it
- **14 enum-like constants** for type safety
- **35 foreign key relationships**
- **70+ database indexes**

### Core Tables

| Table | Purpose | Key Relations |
|-------|---------|--------------|
| `companies` | Multi-tenant root entity | Central hub — 24 FKs reference it |
| `user_profiles` | Cognito-synced user data | -> companies |
| `wallets` | Multi-currency balances | -> companies, virtual_accounts |
| `wallet_transactions` | Immutable ledger entries | -> wallets |
| `expenses` | Expense records | -> companies, departments, vendors |
| `transactions` | General transaction log | -> companies |
| `bills` | Bill records | -> companies |
| `budgets` | Budget limits & tracking | -> companies |
| `virtual_cards` | Card records | -> companies |
| `card_transactions` | Card usage log | -> virtual_cards |
| `virtual_accounts` | Bank accounts (DVA/Treasury) | -> companies |
| `invoices` | Invoice records | -> companies |
| `payroll_entries` | Payroll records | -> companies, departments |
| `vendors` | Vendor directory | -> companies |
| `departments` | Department structure | -> companies |
| `team_members` | Team records | -> companies, departments |
| `company_members` | User-company membership | -> companies |
| `company_invitations` | Invitation tokens | -> companies |
| `company_balances` | Aggregated balances (local + USD + escrow) | -> companies |
| `kyc_submissions` | KYC verification data | -> user_profiles |
| `audit_logs` | Security audit trail | -> companies |
| `payouts` | Outbound payment records | -> payout_destinations, companies |
| `payout_destinations` | Saved bank accounts | -> vendors |
| `scheduled_payments` | Recurring payment schedules | -> companies |
| `notifications` | In-app notification records | Indexed by userId |
| `notification_settings` | Per-user notification preferences | Unique by userId |
| `push_tokens` | Device push tokens | Indexed by userId |
| `subscriptions` | Billing subscriptions | -> companies |
| `exchange_rates` | Currency rates | — |
| `exchange_rate_settings` | Markup configuration | — |
| `analytics_snapshots` | Historical analytics | -> companies |
| `business_insights` | AI-generated insights | -> companies |
| `processed_webhooks` | Webhook idempotency | Unique by eventId |
| `funding_sources` | Saved payment methods | — |
| `reports` | Generated report records | -> companies |
| `role_permissions` | Role-permission mappings | — |
| `system_settings` | Key-value config | — |
| `admin_settings` | Admin key-value config | — |
| `organization_settings` | Platform org settings | — |
| `company_settings` | Legacy single-row settings | — |
| `users` | Legacy user table (deprecated) | — |

---

## 9. API Surface

### Summary

| Category | Endpoint Count | Auth Required |
|----------|---------------|---------------|
| Health | 1 | No |
| Auth & SMS | 9 | Mixed |
| User Profile & Settings | 7 | Yes |
| Onboarding & KYC | 12 | Mixed |
| Transaction PIN | 3 | Yes |
| Balances | 5 | Yes |
| Expenses | 10 | Yes |
| Transactions | 5 | Yes |
| Bills | 10 | Yes |
| Budgets | 5 | Yes |
| Cards (Stripe Issuing) | 13 | Yes |
| Virtual Accounts | 6 | Yes |
| Departments | 5 | Yes |
| Companies & Invitations | 10 | Mixed |
| Team | 5 | Yes |
| AI Insights & Reports | 5 | Yes |
| Payroll | 9 | Yes (Admin) |
| Invoices | 9 | Mixed |
| Vendors | 6 | Yes |
| Payment Routes | 14 | Mixed |
| Wallet Operations | 3 | Yes |
| Utility Payments | 2 | Yes |
| Paystack-Specific | 20 | Mixed |
| Subscriptions | 3 | Yes |
| Analytics | 8 | Yes |
| Notifications | 10 | Yes |
| Admin | 19 | Admin |
| Wallets (Multi-currency) | 6 | Yes |
| Exchange Rates | 8 | Mixed |
| Payout Destinations | 4 | Yes |
| Payouts | 7 | Yes |
| Scheduled Payments | 6 | Admin |
| Funding Sources | 3 | Yes |
| Audit Logs | 2 | Yes |
| **Total** | **~250** | |

### Webhooks (3)

| Endpoint | Provider | Events Handled |
|----------|----------|---------------|
| `POST /api/paystack/webhook` | Paystack | charge.success, transfer.success/failed, subscription.create, invoice.payment_failed, DVA events |
| `POST /api/stripe/webhook` | Stripe | payment_intent.succeeded, checkout.session.completed, issuing_authorization.*, issuing_transaction.created, treasury.*, payout.* |
| `POST /api/kyc/stripe/webhook` | Stripe Identity | identity.verification_session.verified/requires_input |

---

## 10. Payment Infrastructure

### Dual Payment Processor Model

```
User's Country
├── Africa (NG, GH, KE, ZA, RW, CI, EG) -> Paystack
└── International (US, UK, EU, AU, CA, ...) -> Stripe
```

### Stripe Capabilities

| Feature | Stripe Product | Usage |
|---------|---------------|-------|
| Card payments | Payment Intents | Wallet funding (international) |
| Checkout | Stripe Checkout | Subscription payments, invoice payments |
| Card issuing | Stripe Issuing | Virtual/physical cards, spending controls |
| Bank accounts | Stripe Treasury | Virtual accounts (USD/EUR/GBP) |
| Payouts | Stripe Payouts | Bank transfers (ACH, SEPA, BACS, BECS) |
| Identity | Stripe Identity | KYC document + selfie verification |
| Subscriptions | Stripe Billing | Platform subscription management |
| Webhooks | Stripe Webhooks | Real-time event processing |

### Paystack Capabilities

| Feature | Paystack API | Usage |
|---------|-------------|-------|
| Card payments | Transaction Initialize | Wallet funding (Africa) |
| Bank transfers | Transfer API | Payouts, payroll, vendor payments |
| Bulk transfers | Bulk Transfer API | Batch payroll processing |
| Virtual accounts | DVA API | Dedicated Virtual Accounts (NGN) |
| BVN verification | Validate Customer | KYC for Nigerian users |
| Bank resolution | Resolve Account | Account name verification |
| Recurring billing | Subscription API | Platform subscriptions |
| Saved cards | Charge Authorization | Recurring payments |
| Utility payments | Transaction Initialize | Airtime, data, electricity, cable |

### Supported Transfer Methods by Country

| Country | Paystack Method | Stripe Method |
|---------|----------------|---------------|
| Nigeria | NUBAN (10-digit) | — |
| Ghana | GHIPSS (10-16 digit) | — |
| South Africa | BASA (8-12 digit + 6-digit branch) | — |
| Kenya | Mobile Money (format) | — |
| Rwanda | Mobile Money (format) | — |
| Côte d'Ivoire | Mobile Money (format) | — |
| Egypt | Bank account (10-29 digit) | — |
| US | — | ACH (9-digit routing + account) |
| Canada | — | EFT (transit + institution + account) |
| UK | — | BACS (6-digit sort code + 8-digit account) |
| Australia | — | BECS (6-digit BSB + account) |
| EU/EEA | — | SEPA (IBAN) |

---

## 11. Billing & Subscription Model

### Subscription States
`trialing` -> `active` -> `past_due` -> `canceled` -> `expired`

### Subscription Table Fields
- Provider (stripe / paystack)
- Provider subscription ID, customer ID, plan ID
- Trial start/end dates
- Current period start/end
- Quantity (seats) and unit price
- Currency

### Pricing
- Default unit price: **$5.00/seat/month** (500 cents)
- Trial period: Configurable (stored in `trialStartDate` / `trialEndDate`)

### Subscription Enforcement
- `SubscriptionBanner` component shows trial countdown, expired notice, or past-due warning
- Trial expiry scheduler runs **hourly** — checks and updates expired trials
- Dual provider: Stripe Billing for international, Paystack Subscriptions for Africa

---

## 12. Third-Party Services & API Costs

### AWS Services

| Service | Usage | Estimated Cost |
|---------|-------|---------------|
| **ECS Fargate** | 1-4 tasks (0.5 vCPU, 1GB RAM each) | ~$15-60/month |
| **RDS PostgreSQL** | t3.micro, 20-100GB, multi-AZ backup | ~$15-30/month |
| **ALB** | Application Load Balancer | ~$16-25/month |
| **ECR** | Docker image storage (10 images retained) | ~$1-3/month |
| **Cognito** | User pool (first 50K MAU free) | Free tier likely |
| **SES** | Transactional email (first 62K/month free from EC2) | ~$0-10/month |
| **SNS** | SMS notifications | ~$0.00645/SMS (US), varies by country |
| **Secrets Manager** | 1 secret | ~$0.40/month |
| **VPC + NAT Gateway** | 1 NAT gateway | ~$32/month |
| **ACM** | SSL certificate | Free |
| **Total AWS estimate** | | **~$80-175/month base** |

### Stripe Fees

| Product | Pricing |
|---------|---------|
| **Payments** | 2.9% + $0.30 per charge (US cards) |
| **International cards** | +1.5% |
| **Issuing** | $0.10/virtual card created + $0.20/transaction |
| **Treasury** | Contact sales (varies) |
| **Identity** | $1.50/verification |
| **Payouts** | $0.25/ACH payout |
| **Billing** | 0.5% of recurring revenue |

### Paystack Fees

| Product | Pricing |
|---------|---------|
| **Local transactions** (NG) | 1.5% + NGN 100 (capped at NGN 2,000) |
| **International cards** | 3.9% + NGN 100 |
| **Transfers** | NGN 10 (< NGN 5K), NGN 25 (5K-50K), NGN 50 (> 50K) |
| **DVA (Virtual Accounts)** | Free creation, standard transaction fees |
| **BVN Verification** | NGN 100/lookup |
| **Subscriptions** | Standard transaction fees |

### Other Service Costs

| Service | Usage | Cost |
|---------|-------|------|
| **Expo Push** | Push notifications | Free (included with Expo) |
| **EAS Build** | Mobile app builds | Free tier: 30 builds/month; $99/mo for more |
| **Exchange Rate API** | Live FX rates | Varies ($0-50/month depending on provider) |
| **Google Play Store** | App distribution | $25 one-time |
| **Apple App Store** | App distribution | $99/year |

---

## 13. Supported Countries & Currencies

### Paystack-Supported Countries (Full Integration)

| Country | Code | Currency | Transfer Method | DVA Support |
|---------|------|----------|----------------|-------------|
| Nigeria | NG | NGN | NUBAN | Yes |
| Ghana | GH | GHS | GHIPSS | No |
| South Africa | ZA | ZAR | BASA | No |
| Kenya | KE | KES | Mobile Money | No |
| Rwanda | RW | RWF | Mobile Money | No |
| Côte d'Ivoire | CI | XOF | Mobile Money | No |
| Egypt | EG | EGP | Bank Account | No |

### Stripe-Supported Countries (Full Integration)

| Country | Code | Currency | Transfer Method |
|---------|------|----------|----------------|
| United States | US | USD | ACH |
| United Kingdom | GB | GBP | BACS |
| Canada | CA | CAD | EFT |
| Australia | AU | AUD | BECS |
| EU/EEA | EU | EUR | SEPA |

### Global Availability
- **177 countries** targeted on Google Play Store for app distribution
- Payment processing available wherever Stripe or Paystack operates
- Exchange rates supported between all currency pairs (manual or auto-fetched)

---

## 14. Mobile App

### App Identity
- **Name:** Financiar
- **Bundle ID:** `com.financiar.app`
- **Version:** 1.0.3 (versionCode 6)
- **Target SDK:** 35 | **Min SDK:** 24
- **EAS Project:** `5bfb69f9-1bc9-4f13-8e2a-c479a648ecfd`
- **Owner:** `agbanzy`

### Screen Architecture

**Auth Stack (unauthenticated):**
- Login (email/password + biometric)
- Signup
- Forgot Password

**Onboarding (post-first-login):**
- 3-step wizard: Country -> Company -> KYC

**Main Tabs (authenticated):**
| Tab | Screen | Key Features |
|-----|--------|-------------|
| Home | Dashboard | Balance card, KPIs, insights, recent transactions, virtual account info |
| Wallet | Wallet | Multi-currency balances, fund/withdraw/send, virtual accounts, history |
| Expenses | Expenses | Create/edit, receipt upload, status filters |
| Bills | Bills | Bill management, utility payments (airtime/data/electricity/cable) |
| More | Settings Hub | Profile, security, preferences, navigation to all other screens |

**More Stack (14 screens):**
Transactions, Budget, Cards, Invoices, Vendors, Team, Payroll, Analytics, Reports, Virtual Accounts, Notifications, KYC, Invite Accept, Settings

### Mobile-Specific Features
1. **Biometric Authentication** — Face ID / Fingerprint with secure credential storage
2. **Push Notifications** — Expo push tokens with retry logic and Android channels
3. **Offline Support** — Network monitoring, mutation queue, auto-sync on reconnect
4. **Query Persistence** — 24-hour cache in AsyncStorage for instant data on reopen
5. **Dark/Light Theme** — 90+ color tokens, persisted preference
6. **Deep Linking** — `financiar://payment-callback` for payment return flows

---

## 15. Infrastructure & Deployment

### Architecture Diagram

```
Internet
  │
  ▼
[ACM Certificate] -> [ALB (public subnet)]
                        │
                        ▼
              [ECS Fargate (private subnet)]
              ┌─────────────────────────────┐
              │  Docker Container            │
              │  ┌────────────────────────┐  │
              │  │ Node.js 20 Alpine      │  │
              │  │ ┌──────────────────┐   │  │
              │  │ │ Express 5 Server │   │  │
              │  │ │ + Static Client  │   │  │
              │  │ └──────────────────┘   │  │
              │  └────────────────────────┘  │
              └─────────────────────────────┘
                        │
                        ▼
              [RDS PostgreSQL 16.4 (private subnet)]
              [20-100GB, encrypted, 7-day backups]
```

### AWS Resources (CDK Stack)

| Resource | Spec |
|----------|------|
| VPC | 2 AZs, 1 NAT Gateway, public + private subnets |
| RDS | t3.micro, PostgreSQL 16.4, encrypted, deletion protection |
| ECS Cluster | Fargate, container insights |
| Task Definition | 512 CPU (0.5 vCPU), 1024MB RAM |
| ECS Service | Private subnet, circuit breaker + rollback |
| Auto-scaling | 1-4 tasks, CPU target 70% |
| ALB | Internet-facing, HTTP->HTTPS redirect |
| ECR | `financiar`, 10 image retention |
| Secrets Manager | `financiar/app-secrets` |

### Deployment Pipeline

```
1. npm run build              (Vite client + esbuild server)
2. docker build               (Multi-stage: builder -> production)
3. docker push to ECR         (financiar repository)
4. ECS deploys new task       (rolling update with circuit breaker)
5. Container startup:
   a. run-migration.cjs       (idempotent SQL migrations + schema fixes)
   b. node dist/index.cjs     (Express server on port 5000)
6. ALB health check           (GET /api/health)
```

### Environment Variables

| Category | Variables |
|----------|----------|
| Core | DATABASE_URL, PORT, NODE_ENV, SESSION_SECRET, APP_URL |
| Cognito | COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID |
| Cognito (Client) | VITE_COGNITO_USER_POOL_ID, VITE_COGNITO_CLIENT_ID, VITE_COGNITO_DOMAIN |
| Stripe | STRIPE_SECRET_KEY, VITE_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_IDENTITY_WEBHOOK_SECRET |
| Paystack | PAYSTACK_SECRET_KEY, VITE_PAYSTACK_PUBLIC_KEY |
| AWS | AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_SES_FROM_EMAIL, AWS_SES_FROM_NAME, AWS_SNS_SENDER_ID |

---

## 16. Non-Functional Requirements

### Performance
- API rate limits enforced at 5 tiers
- PostgreSQL indexes on 70+ columns for query performance
- TanStack Query with 30s stale time (web) / 5min (mobile)
- Client-side query caching with AsyncStorage persistence (mobile)
- Auto-scaling: 1-4 Fargate tasks at 70% CPU

### Reliability
- ECS circuit breaker with automatic rollback
- Database: Encrypted storage, 7-day automated backups, deletion protection
- Webhook idempotency prevents duplicate processing
- Atomic database transactions with row-level locking for financial operations
- Mobile offline queue with auto-sync on reconnect

### Security
- JWT-based auth with server-side verification
- Transaction PIN on all financial operations
- Rate limiting on auth, financial, and sensitive endpoints
- Audit trail on all significant actions
- CORS locked to production domains
- Non-root Docker container
- Secrets in AWS Secrets Manager (never in code)
- Input validation via Zod on all endpoints
- Error sanitization (no SQL/stack traces leaked)

### Observability
- Request logging on all `/api` routes with response body truncation
- Container health checks (ALB + Docker)
- ECS Container Insights enabled
- Audit log table for business-level observability

---

## 17. Known Limitations & Tech Debt

| Issue | Severity | Description |
|-------|----------|-------------|
| Monolithic routes file | Medium | `server/routes.ts` is 11,023 lines — needs splitting into feature modules |
| Legacy tables | Low | `users` and `company_settings` tables are deprecated but still present |
| Firebase remnant | Low | `client/src/lib/firebase.ts` exists but is unused (auth moved to Cognito) |
| Duplicate route registrations | Low | `/api/stripe/webhook` and `/api/cards/:id/transactions` registered twice |
| `strict: false` in root tsconfig | Medium | TypeScript strict mode disabled (only `strictNullChecks` enabled) |
| Transaction reference bug | Medium | `updateTransactionByReference` matches on `description` field instead of `reference` |
| No CI/CD pipeline | Medium | Deployment is manual — no GitHub Actions or similar automation |
| 16KB page size warning | Low | Android build doesn't support 16KB memory pages (Android 15 requirement) |
| Mobile Firebase env | Low | Mobile `.env.example` still references Firebase config vars |
| Single NAT Gateway | Low | Single AZ NAT Gateway — SPOF for outbound traffic |

---

## 18. Roadmap Considerations

### Near-Term
- [ ] Split `routes.ts` into feature-based route modules
- [ ] Set up CI/CD pipeline (GitHub Actions -> ECR -> ECS)
- [ ] Add Apple App Store distribution
- [ ] Fix TypeScript strict mode
- [ ] Remove deprecated Firebase files and legacy tables
- [ ] Add 16KB page size support to Android builds

### Mid-Term
- [ ] Multi-currency exchange between wallets (UI + backend ready)
- [ ] Advanced reporting with scheduled email delivery
- [ ] Recurring invoice generation
- [ ] Mobile receipt OCR (auto-fill expense from receipt photo)
- [ ] WebSocket for real-time notifications (ws dependency already present)
- [ ] Stripe Treasury full integration (currently placeholder for non-Paystack markets)

### Long-Term
- [ ] Open Banking integrations (Plaid, Mono)
- [ ] AI-powered expense categorization
- [ ] Multi-language support (i18n infrastructure partially present)
- [ ] White-label/API-first offering
- [ ] SOC 2 / PCI DSS compliance certification

---

*Document generated from full codebase analysis on 2026-03-14.*
