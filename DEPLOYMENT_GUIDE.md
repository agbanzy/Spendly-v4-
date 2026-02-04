# 🚀 Spendly Production Deployment Guide

> **Status**: Production-Ready after Critical Fixes Applied
> **Last Updated**: 2026-02-04
> **Environment**: https://spendlymanager.com/

---

## 📋 Table of Contents

1. [Critical Fixes Applied](#critical-fixes-applied)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Environment Setup](#environment-setup)
4. [Database Setup](#database-setup)
5. [Payment Provider Configuration](#payment-provider-configuration)
6. [Deployment Steps](#deployment-steps)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Monitoring & Troubleshooting](#monitoring--troubleshooting)

---

## ✅ Critical Fixes Applied

### 1. **Payment Currency Fix**
**File**: `server/paystackClient.ts`, `server/paymentService.ts`
- **Issue**: Virtual account transfers were hardcoded to NGN currency only
- **Fix**: Now dynamically uses correct currency based on country code (NGN, GHS, ZAR, KES, etc.)
- **Impact**: Multi-currency transfers now work correctly across all supported African countries

### 2. **Webhook Security Fix** ⚠️ CRITICAL
**File**: `server/routes.ts` (Line 2301-2320)
- **Issue**: Paystack webhooks could be processed without signature verification if `PAYSTACK_SECRET_KEY` was not set
- **Fix**: Now rejects all webhooks with 500 error if secret key is not configured
- **Impact**: Prevents unauthorized webhook injection attacks

### 3. **Wallet Not Found Fix** 💰 CRITICAL
**File**: `server/routes.ts` (Line 2438-2530)
- **Issue**: Virtual account deposits were lost if no wallet was found for the customer
- **Fix**:
  - Attempts to auto-create wallet for the user
  - If auto-creation fails, stores transaction as "Pending" for manual reconciliation
  - Logs critical alerts for admin review
- **Impact**: No more lost funds from virtual account deposits

### 4. **Payout Currency Balance Fix**
**File**: `server/routes.ts` (Line 2082-2143)
- **Issue**: Payout endpoint always checked USD balance even for NGN/GHS/other currency payouts
- **Fix**: Now checks and deducts from the correct currency balance based on country code
- **Impact**: Multi-currency payout balance tracking now accurate

### 5. **Email XSS Security Fix** 🔒
**File**: `server/services/notification-service.ts`
- **Issue**: User inputs (name, role, department, etc.) were directly interpolated into HTML email templates
- **Fix**:
  - Added `escapeHtml()` function to sanitize all user inputs
  - Applied to all email templates (team invite, welcome, payout confirmation)
- **Impact**: Prevents XSS attacks via malicious user names/data in emails

---

## 🔍 Pre-Deployment Checklist

### Required Accounts & Services

- [ ] PostgreSQL database provisioned (AWS RDS, Supabase, or similar)
- [ ] Stripe account with live API keys (for US/Europe payments)
- [ ] Paystack account with live API keys (for African payments)
- [ ] AWS account with SES and SNS enabled (for emails & SMS)
- [ ] Domain configured: `spendlymanager.com`
- [ ] SSL certificate installed

### Required Information

- [ ] Database connection URL
- [ ] Stripe live secret key
- [ ] Stripe live publishable key
- [ ] Paystack live secret key
- [ ] Paystack live public key
- [ ] AWS access credentials (Access Key ID & Secret)
- [ ] AWS SES verified sender email address
- [ ] Firebase config (if using Firebase auth)

---

## 🔧 Environment Setup

### Automated Setup (Recommended)

Run the provided setup script:

```bash
./setup-env.sh
```

This interactive script will:
- ✅ Guide you through all required environment variables
- ✅ Auto-generate secure JWT secrets
- ✅ Validate all configurations
- ✅ Create a production-ready `.env` file

### Manual Setup

If you prefer manual setup, copy the template:

```bash
cp attached_assets/.env_1769719046941.production .env
```

Then edit `.env` and replace ALL `PLACEHOLDER` values with real credentials:

```bash
# CRITICAL - Replace these values:
DATABASE_URL=postgresql://user:password@host:5432/spendly_production
STRIPE_SECRET_KEY=sk_live_YOUR_ACTUAL_KEY
PAYSTACK_SECRET_KEY=sk_live_YOUR_ACTUAL_KEY
VITE_JWT_SECRET=your_32_character_secret_here
VITE_JWT_REFRESH_SECRET=your_32_character_refresh_secret
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_KEY
```

### Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `STRIPE_SECRET_KEY` | ✅ Yes | Stripe live secret key | `sk_live_...` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | ✅ Yes | Stripe live public key | `pk_live_...` |
| `PAYSTACK_SECRET_KEY` | ✅ Yes | Paystack live secret key | `sk_live_...` |
| `VITE_PAYSTACK_PUBLIC_KEY` | ✅ Yes | Paystack live public key | `pk_live_...` |
| `VITE_JWT_SECRET` | ✅ Yes | JWT signing secret (32+ chars) | `your_random_secret_here` |
| `VITE_JWT_REFRESH_SECRET` | ✅ Yes | JWT refresh secret (32+ chars) | `your_refresh_secret_here` |
| `AWS_REGION` | ✅ Yes | AWS region for SES/SNS | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | ✅ Yes | AWS access key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | ✅ Yes | AWS secret key | `(secret)` |
| `AWS_SES_FROM_EMAIL` | ✅ Yes | Verified sender email | `noreply@spendly.app` |
| `NODE_ENV` | ✅ Yes | Environment | `production` |
| `VITE_API_URL` | ✅ Yes | API base URL | `https://api.spendly.app/api` |

---

## 🗄️ Database Setup

### 1. Provision Database

**Recommended**: AWS RDS PostgreSQL or Supabase

```bash
# Connection format:
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"
```

### 2. Run Migrations

Apply the database schema:

```bash
npm run db:push
```

This will create all required tables:
- `users`, `wallets`, `wallet_transactions`
- `virtual_accounts`, `payouts`, `payout_destinations`
- `transactions`, `expenses`, `invoices`
- `notifications`, `notification_settings`
- And more...

### 3. Verify Schema

Check that all tables were created:

```bash
psql $DATABASE_URL -c "\dt"
```

---

## 💳 Payment Provider Configuration

### Stripe Setup (US, Canada, Europe)

1. **Get Live API Keys**
   - Go to: https://dashboard.stripe.com/apikeys
   - Copy "Publishable key" → `VITE_STRIPE_PUBLISHABLE_KEY`
   - Reveal and copy "Secret key" → `STRIPE_SECRET_KEY`

2. **Configure Webhooks**
   - Go to: https://dashboard.stripe.com/webhooks
   - Add endpoint: `https://spendlymanager.com/api/kyc/stripe/webhook`
   - Select events:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `charge.succeeded`
     - `charge.failed`
   - Copy webhook signing secret → `STRIPE_IDENTITY_WEBHOOK_SECRET`

3. **Supported Countries**
   - 🇺🇸 United States (USD)
   - 🇨🇦 Canada (USD)
   - 🇬🇧 United Kingdom (GBP)
   - 🇪🇺 Europe (EUR) - Germany, France, Spain, Italy, Netherlands, etc.

### Paystack Setup (Africa)

1. **Get Live API Keys**
   - Go to: https://dashboard.paystack.com/#/settings/developers
   - Copy "Public Key" → `VITE_PAYSTACK_PUBLIC_KEY`
   - Copy "Secret Key" → `PAYSTACK_SECRET_KEY`

2. **Configure Webhooks**
   - Go to: https://dashboard.paystack.com/#/settings/developers
   - Add webhook URL: `https://spendlymanager.com/api/paystack/webhook`
   - Enable events:
     - `charge.success`
     - `dedicatedaccount.assign.success`
     - `transfer.success`
     - `transfer.failed`
     - `transfer.reversed`

3. **Supported Countries**
   - 🇳🇬 Nigeria (NGN)
   - 🇬🇭 Ghana (GHS)
   - 🇿🇦 South Africa (ZAR)
   - 🇰🇪 Kenya (KES)
   - 🇪🇬 Egypt (EGP)
   - 🇷🇼 Rwanda (RWF)
   - 🇨🇮 Côte d'Ivoire (XOF)

4. **Enable Features**
   - Enable "Transfers" in Paystack dashboard
   - Enable "Dedicated Virtual Accounts" (for DVA)
   - Add settlement bank account

---

## 🚀 Deployment Steps

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Configure Environment

```bash
./setup-env.sh
```

Or manually create `.env` file.

### Step 3: Build Application

```bash
npm run build
```

This creates production build in `dist/` directory.

### Step 4: Run Database Migrations

```bash
npm run db:push
```

### Step 5: Start Production Server

```bash
npm start
```

Or with PM2 for process management:

```bash
pm2 start npm --name "spendly" -- start
pm2 save
pm2 startup
```

### Step 6: Configure Reverse Proxy

**Nginx Example**:

```nginx
server {
    listen 80;
    server_name spendlymanager.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Step 7: Enable SSL (Let's Encrypt)

```bash
sudo certbot --nginx -d spendlymanager.com
```

---

## ✅ Post-Deployment Verification

### 1. Health Check

```bash
curl https://spendlymanager.com/
```

Expected: HTML page with "Spendly - Global Expense Management"

### 2. API Health Check

```bash
curl https://spendlymanager.com/api/health
```

### 3. Database Connection

Check server logs for:
```
✓ Database connected successfully
```

### 4. Payment Providers

Check server logs for:
```
✓ Stripe client initialized
✓ Paystack client initialized
```

### 5. Email Service

Check server logs for:
```
AWS SES client initialized
Email provider: aws
```

### 6. Test Payment Flow

1. Create test user account
2. Fund wallet via Stripe/Paystack
3. Check webhook logs for successful processing
4. Verify wallet balance updated

### 7. Test Virtual Accounts

1. Create virtual account via API
2. Check Paystack dashboard for DVA creation
3. Test bank transfer to virtual account
4. Verify webhook processes deposit
5. Check wallet balance credited

### 8. Test Transfers/Payouts

1. Create test payout via API
2. Check Paystack/Stripe for transfer initiation
3. Verify webhook handles completion
4. Check transaction status updated

---

## 📊 Monitoring & Troubleshooting

### View Logs

```bash
# PM2 logs
pm2 logs spendly

# Or direct logs
tail -f logs/production.log
```

### Common Issues

#### ❌ "DATABASE_URL must be set" Error

**Cause**: Database environment variable not configured
**Fix**:
```bash
echo "DATABASE_URL=your_connection_string" >> .env
```

#### ❌ Payments Failing

**Cause**: Invalid API keys or webhook not configured
**Fix**:
1. Verify API keys in Stripe/Paystack dashboard
2. Check webhook URL matches exactly
3. Check webhook logs in provider dashboard

#### ❌ Emails Not Sending

**Cause**: AWS SES not configured or sender email not verified
**Fix**:
1. Verify sender email in AWS SES console
2. Check AWS credentials are correct
3. Check SES sending limits not exceeded

#### ❌ Virtual Account Deposits Not Crediting

**Cause**: Webhook signature verification failing
**Fix**:
1. Check `PAYSTACK_SECRET_KEY` is set correctly
2. Check webhook signature in logs
3. Verify webhook URL in Paystack dashboard

#### ❌ Unmatched Deposits

**Check pending transactions**:
```sql
SELECT * FROM transactions
WHERE status = 'Pending'
AND description LIKE '%UNMATCHED DVA DEPOSIT%';
```

Manually reconcile these transactions by:
1. Finding the user by email/customer code
2. Crediting their wallet manually
3. Updating transaction status to 'Completed'

### Webhook Testing

Test webhooks locally with webhook forwarding:

```bash
# Stripe
stripe listen --forward-to https://spendlymanager.com/api/kyc/stripe/webhook

# Paystack - use ngrok or similar
ngrok http 3000
```

### Database Backups

Set up automated backups:

```bash
# Daily backup cron
0 2 * * * pg_dump $DATABASE_URL > /backups/spendly-$(date +%Y%m%d).sql
```

---

## 🔐 Security Best Practices

1. **Never commit `.env` files** to version control
2. **Rotate secrets regularly** (JWT secrets, API keys)
3. **Enable 2FA** on all provider accounts (Stripe, Paystack, AWS)
4. **Monitor webhook logs** for suspicious activity
5. **Set up rate limiting** on sensitive endpoints
6. **Regular security audits** of dependencies (`npm audit`)
7. **HTTPS only** - Never use HTTP in production
8. **Backup database daily** with retention policy

---

## 📞 Support & Resources

- **Stripe Docs**: https://stripe.com/docs
- **Paystack Docs**: https://paystack.com/docs
- **AWS SES Docs**: https://docs.aws.amazon.com/ses/
- **PostgreSQL Docs**: https://www.postgresql.org/docs/

---

## 📝 Code Changes Summary

### Files Modified

1. **server/paystackClient.ts** - Added currency parameter to transfer recipient creation
2. **server/paymentService.ts** - Dynamic currency selection for transfers
3. **server/routes.ts** - Multiple fixes:
   - Webhook security hardening
   - Auto-wallet creation for unmatched deposits
   - Currency-aware payout balance checking
4. **server/services/notification-service.ts** - XSS prevention in email templates

### New Files

1. **setup-env.sh** - Interactive environment setup script
2. **DEPLOYMENT_GUIDE.md** - This comprehensive deployment guide

---

## ✨ Next Steps

After successful deployment:

1. **Test all features** thoroughly in production
2. **Set up monitoring** (Sentry, LogRocket, or similar)
3. **Configure email templates** in AWS SES
4. **Set up analytics** (Mixpanel, Amplitude, etc.)
5. **Enable two-factor authentication** for users
6. **Create admin dashboard** for monitoring transactions
7. **Set up automated alerts** for failed payments/webhooks

---

**🎉 Congratulations! Your Spendly instance is now production-ready!**

For issues or questions, review the logs and refer to the troubleshooting section above.
