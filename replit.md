# Spendly - Global Expense Management Platform

## Overview
Spendly is a comprehensive financial operating system for high-growth teams. It provides expense tracking, budget management, virtual cards, team management, and transaction monitoring in a unified platform.

## Recent Changes (January 29, 2026)
- Initial build from GitHub repository merge
- Implemented full React frontend with sidebar navigation
- Created backend API with in-memory storage and demo data
- Added 8 main pages: Dashboard, Transactions, Expenses, Bills, Budget, Cards, Team, Settings
- Configured indigo/slate color theme with dark mode support

## Architecture

### Frontend (client/)
- React with TypeScript
- Wouter for routing
- TanStack Query for data fetching
- Shadcn/ui components with Tailwind CSS
- Dark/light theme support

### Backend (server/)
- Express.js server
- In-memory storage (MemStorage)
- RESTful API endpoints

### Shared (shared/)
- TypeScript types and schemas
- Drizzle-zod integration for validation

## Key Features
1. **Dashboard** - Financial overview with balance cards, AI insights, recent activity
2. **Transactions** - Full transaction history with filters
3. **Expenses** - Expense tracking and creation
4. **Bills** - Recurring bill management
5. **Budget** - Category-based budget tracking with progress
6. **Cards** - Virtual card management
7. **Team** - Team member management
8. **Settings** - Company and user preferences

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

## Running the Application
The app runs on port 5000 with `npm run dev`.

## User Preferences
- Default theme: Light mode (toggle available in header)
- Currency: USD
- Clean, minimal interface with indigo accent color
