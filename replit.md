# Spendly - Global Expense Management Platform

## Overview
Spendly is a comprehensive financial operating system for high-growth teams, offering a unified platform for expense tracking, budget management, virtual cards, team management, payroll, invoicing, vendor management, and transaction monitoring. Its core purpose is to streamline financial operations and provide robust tools for modern businesses, aiming to be a complete financial operating system for high-growth teams.

## User Preferences
- Default theme: Light mode (toggle available in header)
- Currency: USD
- Clean, minimal interface with indigo accent color
- Professional design with Shadcn components

## System Architecture

### UI/UX Decisions
- **Design System**: Shadcn/ui components with Tailwind CSS for a professional, clean, and minimal interface.
- **Color Scheme**: Indigo (hsl 238, 84%, 57%) as the primary accent, with slate tones for backgrounds and subtle borders for cards.
- **Theming**: Dark/light theme support with `ThemeProvider` and a toggle available in the header.
- **Navigation**: Responsive sidebar navigation for core application sections.

### Technical Implementations
- **Frontend**: React with TypeScript, Wouter for routing, and TanStack Query for data fetching.
- **Backend**: Express.js server providing RESTful API endpoints.
- **Database**: PostgreSQL with Drizzle ORM (DatabaseStorage) and Neon serverless driver.
- **Authentication**: Firebase Authentication (email/password, Google sign-in) with `AuthProvider` for state management and protected routes. Dedicated admin login portal (`/admin-login`) with backend session authentication.
- **Security**:
    - Per-user wallet balance verification and daily transfer limits.
    - Role-based access control (Owner, Admin, Manager, Editor, Employee, Viewer).
    - Rate limiting middleware (API, Auth, Financial, Email).
    - Firebase Admin SDK integration with fail-closed production mode.
    - Password validation utilities with breach checking.
    - MFA, session timeout, password policies, and API access controls.
    - Transaction PIN system with bcrypt hashing.
- **KYC & Onboarding**: Multi-step verification using Stripe Identity (US/Europe) and Paystack BVN (Africa) based on user's country, storing submissions in `kycSubmissions` table.
- **Virtual Accounts**: User-generated virtual account numbers linked to wallets, with SMS notifications via Paystack webhooks.
- **Multi-Currency Support**: Virtual cards and exchange rates support USD, EUR, GBP, NGN, GHS, KES, ZAR. Live market rates from `exchangerate-api.com` with admin-configurable buy/sell markups.
- **Notifications**: Comprehensive email notification system (8 templates) via AWS SES and SMS via AWS SNS, triggered by user actions (signup, payout, invoice, payroll, login security).
- **Organization Settings**: Customizable company profile, currency, timezone, fiscal year, branding (logo, colors, tagline), and invoice settings.
- **Analytics & Reporting**: Real-time charts (recharts) and a CRUD API for generating and downloading financial reports (JSON export).
- **Financial Health Score & AI Insights**: Dynamic calculation based on spending patterns and context-aware recommendations.

### Core Features
- **Dashboard**: Financial overview, balance cards, AI insights, recent activity.
- **Transactions**: Full transaction history with filters.
- **Expenses**: Tracking, creation, and approval workflow.
- **Bills**: Recurring bill management with utility payments (airtime, data, electricity, cable, internet). Country-specific validation for phone numbers, meter numbers, and smartcard numbers. Wallet balance verification before payment. Supports Africa (NG, KE, GH, ZA), US, GB, and EU regions with provider auto-selection based on currency. Enhanced bill form validation (name, provider, amount, due date, category) with server-side validation matching frontend rules. Bills table includes userId, recurring, frequency, createdAt, updatedAt fields.
- **Budget**: Category-based budget tracking.
- **Cards**: Virtual card management with multi-currency support.
- **Analytics**: Spending trends, charts, category breakdown.
- **Reports**: Generate and download financial reports.
- **Payroll**: Employee salary management, batch processing, payslips.
- **Invoices**: Create and manage client invoices.
- **Vendors**: Vendor management and payments.
- **Team**: Team member CRUD with roles and department assignments.
- **Settings**: Company and user preferences.
- **Audit Logs**: Activity tracking with filters, CSV export.

## External Dependencies
- **Firebase**: Authentication (email/password, Google Sign-in) and Firebase Admin SDK.
- **Stripe**: Payment gateway for virtual cards and Stripe Identity for KYC.
- **Paystack**: Payment gateway for virtual cards, BVN verification, bank account validation, subscriptions, and charge authorizations.
- **AWS SES/SNS**: Email and SMS notification services.
- **exchangerate-api.com**: Live currency exchange rates.
- **PostgreSQL**: Primary database (hosted on Neon).