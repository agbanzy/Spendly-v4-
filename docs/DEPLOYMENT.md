# Financiar Deployment Guide

This guide covers everything needed to deploy the Financiar platform, from local development through production on AWS.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Development Setup](#2-local-development-setup)
3. [Infrastructure Provisioning (CDK)](#3-infrastructure-provisioning-cdk)
4. [Environment Variables](#4-environment-variables)
5. [CI/CD Pipeline](#5-cicd-pipeline)
6. [Manual Deployment](#6-manual-deployment)
7. [Database Migrations](#7-database-migrations)
8. [Monitoring & Health Checks](#8-monitoring--health-checks)
9. [Rollback Procedures](#9-rollback-procedures)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

### Tools

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | Runtime for app and build |
| npm | 10+ | Package management |
| PostgreSQL | 15+ | Local database |
| Docker | 24+ | Container builds |
| AWS CLI | v2 | AWS operations |
| AWS CDK | 2.x | Infrastructure as Code |
| Git | 2.x | Version control |

### AWS Accounts & Services

- **AWS Account ID:** `677343720858`
- **Region:** `us-east-1`
- IAM user or role with permissions for: ECS, ECR, RDS, Secrets Manager, VPC, ALB, CloudWatch, SES, SNS, IAM, ACM
- An **OIDC identity provider** configured in IAM for GitHub Actions (for the `role-to-assume` workflow)
- An **ACM certificate** for `app.thefinanciar.com` (and any other domains) in `us-east-1`

### External Service Accounts

- **AWS Cognito** -- User pool configured for email/password and Google OAuth
- **Stripe** -- API keys (secret + publishable) and webhook endpoint configured
- **Paystack** -- API keys (secret + public) for African payment processing
- **AWS SES** -- Verified sending domain (`thefinanciar.com`) or email address
- **DNS** -- Access to configure CNAME/A records pointing to the ALB

---

## 2. Local Development Setup

### Quick Start

```bash
# 1. Clone the repo
git clone <repo-url> && cd "Spendly v4"

# 2. Copy environment file
cp .env.example .env
# Edit .env with your local values (see Section 4)

# 3. Run the startup script
chmod +x start-local.sh
./start-local.sh
```

The `start-local.sh` script handles:
- Verifying Node.js 20 is available
- Checking PostgreSQL is running
- Creating the `financiar` database if it does not exist (also checks for the legacy `spendly_v4` name)
- Installing dependencies if `node_modules/` is missing
- Pushing the Drizzle schema to the local database (`drizzle-kit push`)
- Starting the dev server on `http://localhost:3000`

### Manual Steps (if not using the script)

```bash
# Install dependencies
npm install

# Create database
psql -d postgres -c "CREATE DATABASE financiar;"

# Push schema
npx drizzle-kit push

# Start development server
NODE_ENV=development npx tsx --env-file=.env server/index.ts
```

The development server serves both the API (`/api/*`) and the Vite-powered React frontend on port 3000.

---

## 3. Infrastructure Provisioning (CDK)

The infrastructure is defined in `infrastructure/` using AWS CDK (TypeScript).

### What Gets Created

| Resource | Name / ID | Details |
|----------|-----------|---------|
| VPC | `FinanciarVpc` | 2 AZs, 1 NAT gateway, public + private subnets |
| RDS PostgreSQL | `FinanciarDb` | PostgreSQL 16.4, `db.t3.micro`, 20-100 GB, encrypted, 7-day backups, deletion protection |
| ECR Repository | `financiar` | Image lifecycle: keeps last 10 images |
| ECS Cluster | `financiar` | Fargate, Container Insights enabled |
| ECS Service | `FinanciarService` | Fargate tasks (512 CPU / 1024 MB), auto-scaling 1-4 tasks at 70% CPU |
| ALB | `FinanciarAlb` | Internet-facing, HTTPS (443) with HTTP-to-HTTPS redirect |
| Secrets Manager | `financiar/app-secrets` | Application secrets (DB URL, Stripe, Paystack, Cognito, session) |
| Secrets Manager | `financiar/db-credentials` | Auto-generated RDS credentials |
| CloudWatch Logs | `/ecs/financiar` | 30-day retention |

### Deploy Infrastructure

```bash
cd infrastructure

# Install CDK dependencies
npm install

# Bootstrap CDK (first time only)
npx cdk bootstrap aws://677343720858/us-east-1

# Preview changes
npx cdk diff

# Deploy (without HTTPS -- for initial setup)
npx cdk deploy

# Deploy with HTTPS certificate
npx cdk deploy -c certificateArn=arn:aws:acm:us-east-1:677343720858:certificate/<cert-id>
```

### Post-CDK Setup (One-Time)

After the first CDK deploy, you must manually populate Secrets Manager:

1. **Get the RDS endpoint** from the CDK output (`DatabaseEndpoint`).
2. **Get the RDS password** from `financiar/db-credentials` in Secrets Manager.
3. **Update `financiar/app-secrets`** in Secrets Manager with real values:

```json
{
  "DATABASE_URL": "postgresql://financiar_admin:<password>@<rds-endpoint>:5432/financiar",
  "SESSION_SECRET": "<generate-a-strong-random-string>",
  "STRIPE_SECRET_KEY": "sk_live_...",
  "STRIPE_WEBHOOK_SECRET": "whsec_...",
  "PAYSTACK_SECRET_KEY": "sk_live_...",
  "COGNITO_USER_POOL_ID": "us-east-1_XXXXXXXXX",
  "COGNITO_CLIENT_ID": "<cognito-client-id>"
}
```

4. **Scale the ECS service up** (it starts with `desiredCount: 0`):

```bash
aws ecs update-service \
  --cluster financiar \
  --service <service-name-from-cdk-output> \
  --desired-count 1 \
  --region us-east-1
```

5. **Configure DNS** -- Point `app.thefinanciar.com` (CNAME or Route53 alias) to the ALB DNS name from the CDK output.

---

## 4. Environment Variables

### Server-Side (Runtime)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string. Format: `postgresql://user:pass@host:5432/financiar` |
| `PORT` | No | Server port (default: `5000` in production, `3000` in dev) |
| `NODE_ENV` | Yes | `development` or `production` |
| `SESSION_SECRET` | Yes | Secret for signing session cookies. Use a long random string in production. |
| `APP_URL` | Yes | Public URL of the app (e.g., `https://app.thefinanciar.com`) |
| `COGNITO_USER_POOL_ID` | Yes | AWS Cognito User Pool ID for JWT verification |
| `COGNITO_CLIENT_ID` | Yes | AWS Cognito App Client ID |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret API key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret (`whsec_...`) |
| `STRIPE_IDENTITY_WEBHOOK_SECRET` | No | Stripe Identity webhook secret (for KYC verification) |
| `PAYSTACK_SECRET_KEY` | Yes | Paystack secret API key |
| `AWS_ACCESS_KEY_ID` | Dev only | AWS credentials for SES/SNS. Not needed on ECS (uses IAM task role). |
| `AWS_SECRET_ACCESS_KEY` | Dev only | AWS credentials for SES/SNS. Not needed on ECS (uses IAM task role). |
| `AWS_REGION` | Yes | AWS region (`us-east-1`) |
| `AWS_SES_FROM_EMAIL` | Yes | Verified SES sender email (e.g., `noreply@thefinanciar.com`) |
| `AWS_SES_FROM_NAME` | No | Display name for outbound emails (default: `Financiar`) |
| `AWS_SNS_SENDER_ID` | No | SMS sender ID (default: `Financiar`) |

### Client-Side (Build-Time)

These are baked into the Vite bundle at build time via Docker build args:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_COGNITO_USER_POOL_ID` | Yes | Cognito User Pool ID (client SDK) |
| `VITE_COGNITO_CLIENT_ID` | Yes | Cognito App Client ID (client SDK) |
| `VITE_COGNITO_DOMAIN` | Yes | Cognito hosted UI domain (e.g., `your-app.auth.us-east-1.amazoncognito.com`) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key (`pk_test_...` or `pk_live_...`) |
| `VITE_PAYSTACK_PUBLIC_KEY` | Yes | Paystack public key |

### Where Variables Live in Production

- **Server-side secrets** are stored in AWS Secrets Manager (`financiar/app-secrets`) and injected into the ECS container as environment variables.
- **Non-secret environment vars** (`NODE_ENV`, `PORT`, `APP_URL`, `AWS_REGION`, SES/SNS config) are set directly in the ECS task definition via CDK.
- **Client-side vars** are passed as `--build-arg` during the Docker build in CI/CD and stored as GitHub Actions secrets.

---

## 5. CI/CD Pipeline

### Trigger

The GitHub Actions workflow (`.github/workflows/deploy.yml`) runs on:
- **Push to `main` branch** -- automatic deployment
- **Manual trigger** -- via the "Run workflow" button in GitHub Actions

### Pipeline Steps

```
Checkout code
    |
    v
Configure AWS credentials (OIDC role assumption)
    |
    v
Login to Amazon ECR
    |
    v
Build Docker image (multi-stage, includes VITE_ build args)
    |
    v
Tag image with git SHA + "latest"
    |
    v
Push both tags to ECR (financiar repo)
    |
    v
Force new ECS deployment (aws ecs update-service --force-new-deployment)
    |
    v
Wait for deployment stability (up to 10 minutes)
```

### Required GitHub Secrets

Configure these in your repository Settings > Secrets and variables > Actions:

| Secret | Description |
|--------|-------------|
| `AWS_DEPLOY_ROLE_ARN` | IAM role ARN for GitHub OIDC federation (e.g., `arn:aws:iam::677343720858:role/GitHubActionsDeployRole`) |
| `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `VITE_COGNITO_CLIENT_ID` | Cognito App Client ID |
| `VITE_COGNITO_DOMAIN` | Cognito domain |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `VITE_PAYSTACK_PUBLIC_KEY` | Paystack public key |

### Key CI/CD Details

- **ECR Repository:** `financiar`
- **ECS Cluster:** `financiar`
- **ECS Service:** `FinanciarStack-FinanciarService17E2212F-iqJEim2EGNKx`
- **Region:** `us-east-1`
- Images are tagged with the git commit SHA for traceability plus `latest` for the ECS task definition.
- The ECS service has a **circuit breaker with rollback enabled**, so a failed deployment automatically rolls back.

---

## 6. Manual Deployment

If you need to deploy without CI/CD (e.g., debugging, hotfix from a local machine):

### Step 1: Build and Push Docker Image

```bash
# Authenticate with ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 677343720858.dkr.ecr.us-east-1.amazonaws.com

# Build the image
docker build \
  --build-arg VITE_COGNITO_USER_POOL_ID=<value> \
  --build-arg VITE_COGNITO_CLIENT_ID=<value> \
  --build-arg VITE_COGNITO_DOMAIN=<value> \
  --build-arg VITE_STRIPE_PUBLISHABLE_KEY=<value> \
  --build-arg VITE_PAYSTACK_PUBLIC_KEY=<value> \
  -t 677343720858.dkr.ecr.us-east-1.amazonaws.com/financiar:manual-$(date +%Y%m%d-%H%M%S) \
  -t 677343720858.dkr.ecr.us-east-1.amazonaws.com/financiar:latest .

# Push
docker push 677343720858.dkr.ecr.us-east-1.amazonaws.com/financiar --all-tags
```

### Step 2: Trigger ECS Redeployment

```bash
aws ecs update-service \
  --cluster financiar \
  --service FinanciarStack-FinanciarService17E2212F-iqJEim2EGNKx \
  --force-new-deployment \
  --region us-east-1
```

### Step 3: Monitor Deployment

```bash
# Watch until stable
aws ecs wait services-stable \
  --cluster financiar \
  --services FinanciarStack-FinanciarService17E2212F-iqJEim2EGNKx \
  --region us-east-1

# Or check status manually
aws ecs describe-services \
  --cluster financiar \
  --services FinanciarStack-FinanciarService17E2212F-iqJEim2EGNKx \
  --region us-east-1 \
  --query 'services[0].deployments'
```

---

## 7. Database Migrations

### How Migrations Work

Migrations run **automatically on container startup**, before the application server starts. The Docker CMD is:

```
node scripts/run-migration.cjs migrate && node dist/index.cjs
```

The migration runner (`scripts/run-migration.cjs`):
- Reads `DATABASE_URL` from the environment
- Executes all SQL files in the `migrations/` directory
- Splits statements on Drizzle's `--> statement-breakpoint` delimiter (or semicolons for plain SQL)
- Is **idempotent** -- re-running is safe; `already exists` and `duplicate key` errors are silently skipped
- Logs progress and a summary of succeeded/skipped/failed statements

### Generating New Migrations

```bash
# After modifying shared/schema.ts:
npx drizzle-kit generate

# This creates a new SQL file in migrations/
# Commit the migration file along with the schema change
```

### Running Migrations Locally

```bash
# Option 1: Via drizzle-kit (pushes schema directly, no SQL files)
npx drizzle-kit push

# Option 2: Via the migration runner (same as production)
DATABASE_URL=postgresql://user:pass@localhost:5432/financiar \
  node scripts/run-migration.cjs migrate
```

### Running Migrations Against Production

If you need to run migrations without redeploying:

```bash
# Use an ECS Exec session or a bastion host with access to the RDS instance
# The DATABASE_URL must point to the production RDS endpoint

DATABASE_URL="postgresql://financiar_admin:<password>@<rds-endpoint>:5432/financiar" \
  node scripts/run-migration.cjs migrate
```

**Warning:** Never run destructive migrations (DROP TABLE, DROP COLUMN) without a backup. The RDS instance has automated backups with 7-day retention.

---

## 8. Monitoring & Health Checks

### Health Check Endpoint

- **URL:** `GET /api/health`
- **Port:** 5000
- Used by the Docker HEALTHCHECK, ECS container health check, and ALB target group health check

### Health Check Configuration

| Layer | Interval | Timeout | Healthy Threshold | Unhealthy Threshold |
|-------|----------|---------|-------------------|---------------------|
| Docker | 30s | 3s | -- | 3 retries (start period: 10s) |
| ECS Container | 30s | 5s | -- | 3 retries (start period: 30s) |
| ALB Target Group | 30s | 5s | 2 | 3 |

### CloudWatch Logs

- **Log Group:** `/ecs/financiar`
- **Retention:** 30 days
- **Stream Prefix:** `financiar`

View logs:

```bash
# Tail logs
aws logs tail /ecs/financiar --follow --region us-east-1

# Search for errors
aws logs filter-log-events \
  --log-group-name /ecs/financiar \
  --filter-pattern "ERROR" \
  --region us-east-1
```

### Container Insights

ECS Container Insights is enabled on the cluster, providing CPU, memory, and network metrics in CloudWatch.

### Auto-Scaling

- **Min:** 1 task
- **Max:** 4 tasks
- **Scale-out trigger:** CPU utilization > 70%
- **Scale-out cooldown:** 60 seconds
- **Scale-in cooldown:** 300 seconds

---

## 9. Rollback Procedures

### Automatic Rollback

The ECS service has **circuit breaker with rollback** enabled. If a new deployment fails health checks, ECS automatically rolls back to the previous stable deployment.

### Manual Rollback to a Previous Image

```bash
# 1. List recent images in ECR
aws ecr describe-images \
  --repository-name financiar \
  --region us-east-1 \
  --query 'imageDetails | sort_by(@, &imagePushedAt) | reverse(@) | [0:10].{Tag: imageTags[0], Pushed: imagePushedAt}' \
  --output table

# 2. Tag the desired image as "latest"
GOOD_TAG=<commit-sha-of-known-good-deploy>
MANIFEST=$(aws ecr batch-get-image \
  --repository-name financiar \
  --image-ids imageTag=$GOOD_TAG \
  --region us-east-1 \
  --query 'images[0].imageManifest' --output text)

aws ecr put-image \
  --repository-name financiar \
  --image-tag latest \
  --image-manifest "$MANIFEST" \
  --region us-east-1

# 3. Force a new deployment
aws ecs update-service \
  --cluster financiar \
  --service FinanciarStack-FinanciarService17E2212F-iqJEim2EGNKx \
  --force-new-deployment \
  --region us-east-1
```

### Database Rollback

RDS automated backups are retained for 7 days. To restore:

```bash
# Restore to a point in time (creates a NEW instance)
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier <rds-instance-id> \
  --target-db-instance-identifier financiar-restored \
  --restore-time <ISO-8601-timestamp> \
  --region us-east-1
```

After restoring, update the `DATABASE_URL` in Secrets Manager to point to the new instance, then force a new ECS deployment.

---

## 10. Troubleshooting

### Container Fails to Start

**Symptom:** ECS tasks keep starting and stopping.

```bash
# Check stopped task reason
aws ecs describe-tasks \
  --cluster financiar \
  --tasks $(aws ecs list-tasks --cluster financiar --desired-status STOPPED --query 'taskArns[0]' --output text --region us-east-1) \
  --region us-east-1 \
  --query 'tasks[0].{reason: stoppedReason, container: containers[0].{exitCode: exitCode, reason: reason}}'
```

Common causes:
- **Exit code 1 on migration:** `DATABASE_URL` is missing or incorrect in Secrets Manager. Verify the secret value.
- **Exit code 137:** Out of memory. The task is allocated 1024 MB; check for memory leaks or increase `memoryLimitMiB` in the CDK stack.

### Health Checks Failing

**Symptom:** ALB returns 502/503 or tasks are marked unhealthy.

- Confirm the app is listening on port 5000 (check logs for "Server running on port 5000").
- The health endpoint is `GET /api/health` -- verify it returns 200 locally first.
- Check security groups: the ALB security group must allow inbound 80/443, and the ECS service security group must allow inbound 5000 from the ALB security group.

### Cannot Connect to RDS

**Symptom:** `ECONNREFUSED` or `timeout` errors in logs.

- ECS tasks run in **private subnets**; RDS is also in private subnets. They communicate via security group rules.
- Verify the DB security group allows inbound 5432 from the ECS service security group (this is configured in CDK but verify with `aws ec2 describe-security-groups`).
- Confirm the `DATABASE_URL` in Secrets Manager uses the correct RDS endpoint, port, username, password, and database name.

### Migration Fails on Deploy

**Symptom:** Container exits before starting the server.

- Check CloudWatch logs for the migration output. The runner prints `FAILED (stmt N)` for non-idempotent failures.
- If a migration has a destructive statement that fails, you may need to run it manually (via a bastion host or ECS Exec) and then redeploy.

### Docker Build Fails

**Symptom:** CI/CD pipeline fails at the build step.

- Ensure all `VITE_*` secrets are set in GitHub Actions secrets.
- The build uses `npm ci --ignore-scripts` -- if a dependency requires native compilation, add a postinstall step or switch to `npm ci`.

### ECS Service Stuck at 0 Tasks

After the initial CDK deploy, `desiredCount` is 0. Either:
- Push a Docker image to ECR and manually set desired count to 1 (see Section 3, Post-CDK Setup).
- After the first CI/CD run, the `update-service --force-new-deployment` will start tasks, but only if `desiredCount >= 1`.

### Secrets Not Updating

ECS caches secrets at task launch. If you update a value in Secrets Manager, you must **force a new deployment** for running tasks to pick up the change:

```bash
aws ecs update-service \
  --cluster financiar \
  --service FinanciarStack-FinanciarService17E2212F-iqJEim2EGNKx \
  --force-new-deployment \
  --region us-east-1
```
