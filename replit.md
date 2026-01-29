# Spendly - Global Expense Management Platform

## Overview
Spendly is a comprehensive financial operating system for high-growth teams. It provides expense tracking, budget management, virtual cards, team management, payroll, invoicing, vendor management, and transaction monitoring in a unified platform.

## Recent Changes (January 29, 2026)
- Full application build from GitHub repository (https://github.com/agbanzy/spendly-g)
- Implemented complete React frontend with 15+ pages
- Added landing page, login/signup authentication flows
- Created comprehensive dashboard with balance cards and AI insights
- Added Finance section: Analytics, Reports, Payroll, Invoices, Vendors
- Implemented Quick Actions FAB for rapid actions
- Backend API with in-memory storage and demo data

## Architecture

### Frontend (client/)
- React with TypeScript
- Wouter for routing (landing, auth, and app routes)
- TanStack Query for data fetching
- Shadcn/ui components with Tailwind CSS
- Dark/light theme support with ThemeProvider
- Responsive sidebar navigation

### Backend (server/)
- Express.js server
- In-memory storage (MemStorage)
- RESTful API endpoints

### Shared (shared/)
- TypeScript types and schemas
- Drizzle-zod integration for validation

## Key Features

### Public Pages
1. **Landing Page** (`/`) - Marketing page with features, pricing, testimonials
2. **Login** (`/login`) - Email/password and Google login
3. **Signup** (`/signup`) - New user registration

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
- `GET /api/transactions` - List transactions
- `GET /api/bills` - List bills
- `GET /api/budgets` - List budgets
- `GET /api/cards` - List virtual cards
- `GET /api/team` - List team members
- `GET /api/insights` - AI-generated insights

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
