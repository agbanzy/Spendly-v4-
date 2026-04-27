# Deploy to DigitalOcean App Platform

This document covers the DO App Platform deployment that runs in
parallel with the existing AWS ECS Fargate stack
(`infrastructure/lib/financiar-stack.ts`). The two deployments share
nothing at the runtime layer — different containers, different DBs,
different Postgres instances. They share **build artifacts** (same
`Dockerfile`) and **external dependencies** (same Cognito user pool,
same Stripe / Paystack accounts, same SES / SNS).

Switching primary traffic between AWS and DO is a DNS-layer decision
made outside this repo. Until the cutover happens, both deployments
run; AWS is primary and DO is the secondary / preview / failover
target.

## Files

| File | What it does |
|---|---|
| `.do/app.yaml` | App Platform spec — services, DB, env vars, health check, routes |
| `.github/workflows/deploy-do.yml` | CI workflow that builds → pushes → updates the DO app |
| `Dockerfile` | Same multi-stage Docker build used by AWS deploy; produces dist/index.cjs + dist/public/ |
| `server/routes/health.routes.ts` | `/api/health` endpoint that DO probes for rolling-deploy success |

## 1. First-time setup

Once per DO account.

### 1.1 Authenticate doctl locally

```bash
doctl auth init        # paste the personal access token from cloud.digitalocean.com/account/api/tokens
doctl account get      # confirm; should print info@mytestbuddy.app
doctl registry get     # confirm registry exists; should print docufy / fra1
```

### 1.2 Set GitHub Actions secrets

Go to `https://github.com/agbanzy/Spendly-v4-/settings/secrets/actions` and add:

| Secret | Value |
|---|---|
| `DIGITALOCEAN_ACCESS_TOKEN` | DO personal access token with full `apps:*`, `registry:*`, `database:*` scopes |
| `VITE_COGNITO_USER_POOL_ID` | From AWS Cognito console → User pools → spendly-prod |
| `VITE_COGNITO_CLIENT_ID` | App client ID under that user pool |
| `VITE_COGNITO_DOMAIN` | Cognito hosted-UI domain (eg. `auth.financiar.io`) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` from Stripe dashboard |
| `VITE_PAYSTACK_PUBLIC_KEY` | `pk_live_...` from Paystack dashboard |

These are read at **build time** by the GitHub workflow and passed to `docker build --build-arg` so Vite bakes them into the client bundle. Server-side secrets (below) live in the DO console instead.

### 1.3 First deploy

The workflow's "Create or update DO App" step is idempotent — if the app named `financiar` doesn't exist, it creates from `.do/app.yaml`; otherwise it updates.

```bash
# Trigger via workflow_dispatch:
gh workflow run deploy-do.yml -f app_name=financiar -f ref=main

# OR push to the release branch:
git push origin main:do-prod
```

Watch the run at `https://github.com/agbanzy/Spendly-v4-/actions/workflows/deploy-do.yml`. First deploy takes ~10 minutes (image build + push + app create + Postgres provision).

When it finishes, the workflow's last step prints the app's `DefaultIngress` URL — that's where the deployed app lives.

## 2. Server-side secrets (set once in the DO console)

**Do NOT commit these to the repo or pass via workflow.** Set under DO console → Apps → financiar → Settings → App-Level Environment Variables → Encrypted.

| Env var | Source | Notes |
|---|---|---|
| `SESSION_SECRET` | Generate with `openssl rand -hex 32` | Express session cookie signing |
| `STRIPE_SECRET_KEY` | Stripe dashboard | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook endpoint config | `whsec_...` |
| `PAYSTACK_SECRET_KEY` | Paystack dashboard | `sk_live_...` |
| `AWS_ACCESS_KEY_ID` | IAM user with SES + SNS + Cognito read scopes | Cross-cloud calls — DO app uses these to send mail / SMS / verify Cognito JWTs |
| `AWS_SECRET_ACCESS_KEY` | Pair with the above | |
| `COGNITO_USER_POOL_ID` | AWS Cognito console | Same value as `VITE_COGNITO_USER_POOL_ID` but used server-side for JWT verification |
| `COGNITO_CLIENT_ID` | AWS Cognito console | Same value, server-side use |
| `COGNITO_REGION` | `us-east-1` (default) | |

`DATABASE_URL` is **autowired** by DO from the managed Postgres instance defined in `.do/app.yaml` — do not set it manually. The runtime env will have it injected automatically.

## 3. Differences from the AWS deploy

| Concern | AWS path | DO path |
|---|---|---|
| **Compute** | ECS Fargate task on the financiar cluster | App Platform service (basic-xxs → basic-xs) |
| **Postgres** | RDS Postgres 16 in private subnet | Managed Postgres 16, same major version |
| **Migrations** | Run on container startup via `scripts/run-migration.cjs migrate` | Same — `Dockerfile` CMD runs the same migration step |
| **Health check** | ALB target group polls `/api/health` | App Platform polls `/api/health` |
| **TLS** | ACM cert on the ALB | DO-managed Let's Encrypt on `*.ondigitalocean.app` (custom domains via DNS) |
| **Logs** | CloudWatch | DO Logs (in console; export to Papertrail / Datadog optional) |
| **Backups** | RDS automated daily snapshots | DO managed Postgres automated daily backups |
| **Image registry** | ECR (financiar repo) | DO Container Registry `registry.digitalocean.com/docufy/financiar` |

The two paths CAN co-exist long-term — e.g. AWS for the US/EU customer cohort and DO for an Africa-region cohort closer to the Paystack edges.

## 4. Cutover plan (when ready to switch primary)

1. Deploy to DO (this doc) and confirm `/api/health` returns 200 + `database: ok` from the DO ingress URL.
2. Run a small set of synthetic transactions through the DO app to validate Stripe / Paystack / Cognito connectivity.
3. Update the app's domain in DO console → Settings → Domains: add `app.financiar.io` and verify ownership.
4. **DNS**: at the registrar, lower the TTL on the existing AWS-pointing record to 60s; wait for the existing TTL to drain.
5. Switch the DNS A/ALIAS record to point at the DO ingress.
6. Watch CloudWatch on AWS + DO Logs simultaneously for 30 minutes; rollback by flipping the DNS back if anything looks wrong.
7. Once 24 hours of green DO traffic, scale the AWS ECS service to zero (do not delete; keep as standby).

## 5. Rollback

The DO app spec is the only file in this repo that touches the DO deployment. To rollback the deployed code:

```bash
# Find the previous deployment ID:
doctl apps list-deployments <APP_ID> --format ID,Cause,UpdatedAt | head -5

# Roll back to the previous deployment (DO supports in-place rollback):
doctl apps create-deployment <APP_ID> --force-rebuild=false
```

For a more invasive rollback, redeploy the previous git SHA via the workflow:

```bash
gh workflow run deploy-do.yml -f ref=<previous-sha>
```

## 6. Cost notes

- App Platform `basic-xxs`: ~$5/mo
- Managed Postgres dev tier: ~$15/mo
- Container Registry: included up to 5GB
- Bandwidth: 100GB free per app, then $0.01/GB

For the full Innoedge fleet pattern, expect ~$25/mo per app (xxs + dev DB), scaling to ~$50/mo (xs + basic DB) at first paid customers.

## 7. Cross-references

- `.github/workflows/deploy.yml` — AWS ECS deployment (primary, unchanged)
- `infrastructure/lib/financiar-stack.ts` — AWS CDK stack (unchanged)
- `STRIPE_CONNECT_MIGRATION_PLAN.md` — Stripe Connect work; the DO deploy and the Stripe Connect work are independent and can ship in either order
