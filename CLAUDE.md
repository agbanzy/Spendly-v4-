# Spendly v4 — Personal Finance Platform

## Overview
Spendly is a full-stack fintech application for personal finance management. It features dual payment processor support (Stripe + Paystack), AWS Cognito authentication, and a React + Express architecture with Drizzle ORM.

## Architecture
- **Pattern:** Full-stack monorepo with shared types
- **Frontend:** React 18 + Vite + Tailwind CSS v4 + shadcn/ui + Radix UI
- **Backend:** Express 5.0 + TypeScript + Drizzle ORM
- **Database:** PostgreSQL with Drizzle migrations
- **Auth:** AWS Cognito + JWT (aws-jwt-verify) — both server and client-side
- **Payments:** Stripe + Paystack dual processor
- **Email:** AWS SES
- **Forms:** React Hook Form + Zod validation
- **Sessions:** Express-session + postgres-simple adapter

## Directory Structure
```
Spendly v4/
├── client/          # Vite React frontend
├── server/          # Express 5 backend
├── shared/          # Drizzle schema + shared types
├── migrations/      # Drizzle-generated SQL migrations
├── scripts/         # Database and migration utilities
├── infrastructure/  # IaC and deployment
└── attached_assets/ # Static resources
```

## Development Commands
```bash
# Full-stack dev
npm run dev

# Client only
cd client && npm run dev

# Database migrations
npx drizzle-kit generate
npx drizzle-kit push

# Build for production
npm run build
```

## Key Conventions
- Path aliases: `@/*` (client), `@shared`, `@assets`
- Server output: CommonJS (`dist/index.cjs`)
- Client output: ESNext via Vite
- Drizzle schema in `shared/` is the single source of truth
- Cognito handles auth on both sides — server verifies JWT, client uses Cognito SDK
- Zod schemas for all form validation AND API request validation
- shadcn/ui components from Radix primitives

## Payment Integration
- Stripe for international payments
- Paystack for Nigerian Naira payments
- Payment processor selected based on user's currency/region
- Webhook endpoints for both processors must stay in sync

## Deployment
- Multi-stage Docker build (builder → production)
- Drizzle migrations run automatically at startup
- Health check on `/api/health` (port 5000)
- Production serves static client from `dist/public/`

## Important Notes
- Express 5 (not 4) — async error handling is built-in, no need for express-async-errors
- Cognito user pool configuration must match between client and server env vars
- Never store payment tokens or card details server-side
- All monetary values stored as integers (cents/kobo), converted to display format on client
