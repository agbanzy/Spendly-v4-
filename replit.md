# Spendly - Global Expense Management Platform

## Overview
Spendly is a comprehensive financial operating system for high-growth teams. It provides expense tracking, budget management, virtual cards, team management, payroll, invoicing, vendor management, and transaction monitoring in a unified platform.

## Recent Changes (February 4, 2026)
- **Currency Formatting Fix**: Fixed currency display across all pages
  - Changed toLocaleString() to use 'en-US' locale consistently
  - Ensures proper formatting: commas for thousands (40,000.00) not periods (40.000.00)
  - Fixed in dashboard, expenses, transactions, cards, bills, budget, payroll, admin, invoices, team, vendors, analytics
- **Virtual Card Multi-Currency Support**: Enhanced virtual card system
  - Cards can be created in multiple currencies: USD, EUR, GBP (Stripe) and NGN, GHS, KES, ZAR (Paystack)
  - Provider auto-selected based on currency
  - Card funding from user wallets with balance verification
  - Exchange rate conversion for cross-currency funding
  - Fund Card option added to card dropdown menu
- **Exchange Rate System**: Complete currency conversion infrastructure
  - Exchange rate storage and retrieval
  - Default exchange rates seeded (USD, EUR, GBP, NGN, GHS, KES, ZAR)
  - Admin-only endpoint for seeding rates
- **Security Enhancements for Transfers**: 
  - Per-user wallet balance verification before transfers
  - Daily transfer limits ($50k/day per user) tracked by wallet
  - requireAdmin added to team mutation endpoints
  - requireAuth added to card creation/funding endpoints
- **Security Middleware Integration**: Merged security enhancements from Spendly-v4- repository
  - Rate limiting middleware: API (100/15min), Auth (5/15min), Financial (3/min), Email (3/hr)
  - Firebase Admin SDK integration with fail-closed production mode
  - Password validation utilities with breach checking
  - Auth middleware for token verification and admin role checking
- **Security Documentation**: Added comprehensive audit documents
  - ADMIN_SYSTEM_AUDIT.md, APPROVAL_PAYOUT_AUDIT.md, AUTH_SECURITY_AUDIT.md
  - DEPLOYMENT_GUIDE.md, MOBILE_APP_AUDIT.md, PAYROLL_SECURITY_AUDIT.md
  - SECURITY_FIXES_IMPLEMENTATION.md, VIRTUAL_CARD_AUDIT.md

## Previous Changes (January 31, 2026)
- **User-Generated Virtual Accounts**: Users can now generate their own virtual account numbers directly from the dashboard
  - "Generate Virtual Account" button appears when no account exists
  - Virtual accounts are linked to user's wallet for automatic crediting
  - SMS notifications sent when funds arrive via bank transfer
  - Enhanced Paystack webhook to find wallets via virtual account number lookup
- **Admin Authentication Separation**: Dedicated admin login portal (/admin-login) with backend session authentication
  - AdminRoute wrapper accepts both Firebase auth and admin session
  - Admin credentials managed separately from user Firebase authentication
- **Comprehensive Email Notification System**: 8 email templates with consistent Spendly branding:
  - Welcome email (on signup)
  - Password reset success confirmation
  - Email verification
  - Detailed payout confirmation
  - Invoice email to clients
  - Payslip notifications
  - Login security alerts
  - Transaction SMS alerts
- **Notification Triggers**: Automatic emails on user signup (welcome), payout processing (confirmation), invoice creation (client email), payroll batch/individual (payslip), admin login (security alert)
- **Notification API Endpoints**: `/api/auth/track-login`, `/api/auth/password-reset-success`, `/api/auth/send-verification`, `/api/notifications/transaction-sms`, `/api/invoices/:id/send`
- **AWS SES/SNS Integration**: Primary email/SMS provider with consistent branding (gradient #4F46E5 to #7C3AED)
- **TypeScript Type Safety Fixes**: Fixed 47+ type errors across routes.ts - all decimal field schemas now use String() transforms for PostgreSQL compatibility
- **Virtual Account User Linkage**: Added userId column to virtual_accounts table for proper user-account association
- **Expense Schema Defaults**: Added default values for userId and user to prevent null constraint violations
- **Vendor Update Schema**: Updated totalPaid and pendingPayments fields to use proper String() transforms
- **Report Status Updates**: Added updateReportStatus storage method for report lifecycle management
- **Organization Settings**: Industry type, company size, Tax ID/VAT, registration number, website fields
- **Branding Customization**: Company logo URL, tagline, primary/secondary brand colors with color picker
- **Invoice Settings**: Invoice prefix, fiscal year, payment terms, custom footer text
- **Logo Display Options**: Toggle logo on invoices and receipts
- **Theme Toggle**: Light/dark mode toggle in branding section
- **User Settings API**: Personal preferences (notifications, PIN, alerts) saved per user

## Previous Changes (January 30, 2026)
- **Dynamic Currency Formatting**: All major pages (dashboard, cards, budget, expenses, invoices, vendors, analytics, admin, team, bills, payroll) now use settings-based currency formatting with support for USD ($), EUR (€), GBP (£), NGN (₦), KES (KSh), GHS (₵), ZAR (R) - replaces all hardcoded "$" symbols
- **Transaction PIN System**: Backend endpoints for setting, verifying, and disabling transaction PINs with bcrypt hashing
- **Virtual Account Display**: Dashboard shows virtual account details (bank name, account number) with copy-to-clipboard
- **Enhanced Withdrawal Flow**: Bank selection dropdown with real-time account validation using Paystack API
- **Fixed Department Creation**: Resolved SelectItem empty value error in team management
- **Stripe Identity KYC**: Integrated Stripe Identity for document and selfie verification (US/Europe users)
- **Paystack BVN Verification**: Bank Verification Number verification for African users (Nigeria, Ghana, Kenya, South Africa)
- **Multi-Region KYC**: Auto-selects verification method based on user's country
- **Admin Dashboard**: System metrics, user distribution, activity monitoring, system health
- **User Management**: Role-based access (Owner, Admin, Manager, Editor, Employee, Viewer), permissions management
- **Audit Logs**: Activity tracking with filters, CSV export, IP/user agent logging
- **Organization Settings**: Company profile, currency, timezone, fiscal year configuration
- **Security Settings**: MFA, session timeout, password policies, API access controls

## Previous Changes (January 29, 2026)
- **Team Management**: Complete team member CRUD with roles, status toggling (active/inactive), and department assignment
- **Department Management**: Full department CRUD with name, description, budget, color picker, and department head assignment
- **Payroll System**: Complete payroll with add/edit/delete employees, batch processing, individual payments, payslip view/print, CSV/JSON export
- **Notification System**: Multi-channel notifications (SMS via Twilio, Email via SendGrid, Push via Expo, In-app)
- **KYC & Onboarding Flow**: Complete multi-step verification system with personal info, address, identity documents, and business information
- **User Profiles**: New userProfiles table linked to Firebase UID for extended user data and KYC status tracking
- **KYC Submissions**: kycSubmissions table for storing verification documents and personal details
- **KYC Status Banner**: Dashboard shows dynamic status (not started, pending review, rejected, approved)
- **PostgreSQL Database**: Migrated from in-memory storage to real PostgreSQL database (Neon-backed)
- **Database Schema**: Full Drizzle ORM schema with 24 tables (added departments, notifications, notificationSettings, pushTokens, payrollEntries)
- Integrated Firebase authentication (email/password + Google sign-in)
- Added Stripe and Paystack payment gateway configurations
- Full application build from GitHub repository (https://github.com/agbanzy/spendly-g)
- Implemented complete React frontend with 18+ pages
- Added Forgot Password page with Firebase password reset
- Added Terms of Service and Privacy Policy pages
- Created comprehensive dashboard with balance cards and AI insights
- Added Finance section: Analytics, Reports, Payroll, Invoices, Vendors
- Implemented Quick Actions FAB for rapid actions
- **Enhanced Analytics**: Real-time charts (area, bar, pie, line, composed) using recharts with live data from expenses/transactions APIs
- **Reports System**: Full CRUD API for reports with create, download (JSON export), and delete functionality
- **Paystack Auto-Debit**: Subscription plans, charge authorization, recurring payments endpoints
- **Live Data Only**: Removed all mock/hardcoded data - all statistics calculated from real API data
- **Financial Health Score**: Dynamic calculation based on budget utilization, savings rate, and spending patterns
- **Smart Insights**: Context-aware recommendations generated from actual expense and budget data

## Architecture

### Frontend (client/)
- React with TypeScript
- Wouter for routing (landing, auth, and app routes)
- TanStack Query for data fetching
- Shadcn/ui components with Tailwind CSS
- Dark/light theme support with ThemeProvider
- Responsive sidebar navigation
- Firebase authentication (client/src/lib/firebase.ts)
- Stripe SDK integration (client/src/lib/stripe.ts)
- Paystack SDK integration (client/src/lib/paystack.ts)

### Backend (server/)
- Express.js server
- PostgreSQL database with Drizzle ORM (DatabaseStorage)
- RESTful API endpoints
- Neon serverless PostgreSQL driver

### Shared (shared/)
- TypeScript types and schemas
- Drizzle-zod integration for validation

## Key Features

### Authentication
- Firebase Authentication with email/password and Google sign-in
- Auth state managed by AuthProvider with loading states
- Protected routes redirect to login if not authenticated
- User profile photos displayed from Google sign-in

### Public Pages
1. **Landing Page** (`/`) - Marketing page with features, pricing, testimonials
2. **Login** (`/login`) - Email/password and Google login (Firebase)
3. **Signup** (`/signup`) - New user registration (Firebase)
4. **Forgot Password** (`/forgot-password`) - Firebase password reset
5. **Terms of Service** (`/terms`) - Legal terms page
6. **Privacy Policy** (`/privacy`) - Privacy policy page
7. **Onboarding** (`/onboarding`) - Multi-step KYC verification flow (5 steps)

### App Pages (After Login)
1. **Dashboard** (`/dashboard`) - Financial overview with balance cards, AI insights, recent activity
2. **Transactions** (`/transactions`) - Full transaction history with filters
3. **Expenses** (`/expenses`) - Expense tracking and creation with approval workflow
4. **Bills** (`/bills`) - Recurring bill management
5. **Budget** (`/budget`) - Category-based budget tracking with progress bars
6. **Cards** (`/cards`) - Virtual card management with visual cards

### Finance Section
7. **Analytics** (`/analytics`) - Spending trends, charts, category breakdown
8. **Reports** (`/reports`) - Generate and download financial reports
9. **Payroll** (`/payroll`) - Employee salary management and payments
10. **Invoices** (`/invoices`) - Create and manage client invoices
11. **Vendors** (`/vendors`) - Vendor management and payments

### Management Section
12. **Team** (`/team`) - Team member management with roles
13. **Settings** (`/settings`) - Company and user preferences

## API Endpoints
- `GET /api/balances` - Company balances
- `GET /api/expenses` - List expenses
- `POST /api/expenses` - Create expense
- `PUT /api/expenses/:id` - Update expense (including approve/reject)
- `DELETE /api/expenses/:id` - Delete expense
- `GET /api/transactions` - List transactions
- `GET /api/bills` - List bills
- `GET /api/budgets` - List budgets
- `GET /api/cards` - List virtual cards
- `GET /api/team` - List team members
- `GET /api/insights` - AI-generated insights
- `GET /api/reports` - List reports
- `POST /api/reports` - Create report
- `DELETE /api/reports/:id` - Delete report
- `GET /api/reports/:id/download` - Download report as JSON
- `GET /api/analytics/summary` - Analytics summary with breakdowns
- `POST /api/paystack/subscriptions` - Create Paystack subscription plan
- `POST /api/paystack/charge/authorization` - Charge saved authorization
- `GET /api/paystack/authorizations` - List saved authorizations
- `POST /api/user/set-pin` - Set transaction PIN (4 digits, SHA-256 hashed)
- `POST /api/user/verify-pin` - Verify transaction PIN
- `POST /api/user/disable-pin` - Disable transaction PIN
- `POST /api/payment/validate-account` - Validate bank account via Paystack
- `POST /api/payments/utility` - Process utility payments (airtime, data, etc.)
- `GET /api/virtual-accounts` - List user's virtual accounts

## Components
- **AppSidebar** - Main navigation with sections (Main, Finance, Management)
- **QuickActions** - Floating action button for rapid actions
- **ThemeToggle** - Dark/light mode toggle
- **Various page components** with data fetching and forms

## Running the Application
The app runs on port 5000 with `npm run dev`.

## User Preferences
- Default theme: Light mode (toggle available in header)
- Currency: USD
- Clean, minimal interface with indigo accent color
- Professional design with Shadcn components

## Design Tokens
- Primary: Indigo (hsl 238, 84%, 57%)
- Background: Slate tones
- Cards: White/dark backgrounds with subtle borders
- Shadows: Minimal, for elevation only

## Environment Variables
- VITE_FIREBASE_API_KEY - Firebase API key
- VITE_FIREBASE_AUTH_DOMAIN - Firebase auth domain
- VITE_FIREBASE_PROJECT_ID - Firebase project ID
- VITE_FIREBASE_STORAGE_BUCKET - Firebase storage bucket
- VITE_FIREBASE_MESSAGING_SENDER_ID - Firebase messaging sender ID
- VITE_FIREBASE_APP_ID - Firebase app ID
- VITE_STRIPE_PUBLISHABLE_KEY - Stripe publishable key
- VITE_PAYSTACK_PUBLIC_KEY - Paystack public key
