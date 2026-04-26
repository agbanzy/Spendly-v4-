# Spendly v4 (Financiar) — Logic Upgrade Proposals

**Date:** 2026-04-26
**Author:** Claude (Opus 4.7) under Godwin Agbane's direction
**Companion to:** [`AUDIT_2026_04_26.md`](AUDIT_2026_04_26.md)
**Format:** Each proposal is implementation-ready — problem statement → current behaviour with file:line → proposed design → schema migration SQL → TypeScript skeleton → test strategy → rollout plan → effort estimate → dependencies. **No source code is edited in this pass.**

> Migration SQL in this document is provided as DDL only and intended for review. Run via the project's standard migration flow (`migrations/` + `scripts/run-migration.cjs migrate`) after PR review. No SQL is executed by this audit.

---

## Index

| ID | Title | Severity addressed | Effort |
|---|---|---|---|
| [LU-001](#lu-001-wallet--transaction-bridge) | Wallet → Transaction bridge | AUD-BE-002 (CRIT) | 2 days |
| [LU-002](#lu-002-scheduler-leader-election) | Scheduler leader election (Postgres advisory locks) | AUD-BE-001 (CRIT) | 1 day |
| [LU-003](#lu-003-pino-ify-the-scheduler) | Move scheduler off `console.log` | AUD-BE-004 (HIGH) | 0.5 day |
| [LU-004](#lu-004-soft-delete-on-financial-tables) | Soft-delete on financial tables | AUD-BE-014 (MED) | 1-2 days |
| [LU-005](#lu-005-cardtransactions-currency-column) | `cardTransactions.currency` column | AUD-BE-007 (HIGH) | 0.5 day |
| [LU-006](#lu-006-mobile-hardening) | Mobile hardening bundle (jailbreak, cert pinning, encrypted storage) | AUD-MO-001/2/3 (HIGH) | 3-5 days |
| [LU-007](#lu-007-ci-test-gate) | CI/CD test gate | AUD-IN-001 (CRIT) | 0.5 day |
| [LU-008](#lu-008-database-purge-hardening) | Harden the database-purge endpoint | AUD-BE-003 (CRIT) | 1 day |
| [LU-009](#lu-009-shared-zod-schemas-on-client) | Reuse `shared/` Zod schemas on the client | AUD-FE-005 (HIGH) | 2-3 days |
| [LU-010](#lu-010-auth-cookie-modernization) | Move Cognito tokens to httpOnly cookies | AUD-FE-001 (HIGH) | 3-4 days |
| [LU-011](#lu-011-storage-layer-domain-split) | Storage god-object → domain services | AUD-BE-018 (MED) | 5-7 days |
| [LU-012](#lu-012-multi-nat-multi-env-cdk) | Multi-NAT + multi-environment CDK | AUD-IN-002/3/4 (HIGH) | 2-3 days |
| [LU-013](#lu-013-observability) | OpenTelemetry → Honeycomb + auto PII redaction | AUD-OB-001/2 (MED) | 2-3 days |
| [LU-014](#lu-014-payment-reconciliation-job) | Daily payment reconciliation (local ledger ↔ provider) | AUD-BE-016 (MED) | 1-2 days |

---

## LU-001 — Wallet → Transaction bridge

### Problem

The four atomic wallet operations (`atomicBillPayment`, `atomicCardFunding`, `atomicWalletTransfer`, `atomicReversal`) write only the internal `wallet_transactions` ledger. The user-facing `client/src/pages/transactions.tsx` reads from `transactions` only. Result: bill payments, card fundings, wallet transfers, and reversals never appear in the user's transaction history.

### Current behaviour

[server/storage.ts:1484-1773](../../server/storage.ts) — each atomic op `INSERT`s into `wallet_transactions` and updates `wallets`/`bills`/`virtual_cards` accordingly. No `INSERT INTO transactions` happens. The schema *does* have the bridge columns: `transactions.walletTransactionId` ([shared/schema.ts:261](../../shared/schema.ts)) and `transactions.companyId` ([shared/schema.ts:262](../../shared/schema.ts)).

### Proposed design

**Option A (recommended): Write to both ledgers.** Inside each atomic op's `db.transaction(async (tx) => {...})` block, after the `wallet_transactions` insert, also `INSERT INTO transactions (...)` with `walletTransactionId = walletTxResult[0].id`, `companyId = wallet.companyId` (resolved via a join), and the appropriate `type`/`status`. The two writes are in the same Postgres transaction, so atomicity is preserved.

**Option B (long-term): Single ledger.** Deprecate `transactions` in favour of `wallet_transactions` as the single source of truth. Migrate the Transactions page to read from `wallet_transactions`. This is structurally cleaner but a larger migration.

Option A is recommended for this sprint because it is non-destructive and immediately unblocks user-visible history. Option B can follow once the bridge has been stable for a quarter.

### Schema migration

No new columns needed (`walletTransactionId` and `companyId` already exist on `transactions`). One backfill migration to populate `transactions` rows for existing `wallet_transactions` that have no corresponding `transactions` entry:

```sql
-- migrations/0008_backfill_transactions_from_wallet.sql

INSERT INTO transactions (
    id, type, amount, fee, status, date, description, currency,
    user_id, reference, wallet_transaction_id, company_id
)
SELECT
    gen_random_uuid()::text,
    CASE wt.type
        WHEN 'bill_payment'      THEN 'Bill'
        WHEN 'card_funding'      THEN 'Funding'
        WHEN 'wallet_transfer'   THEN 'Transfer'
        WHEN 'wallet_transfer_in' THEN 'Transfer'
        WHEN 'reversal'          THEN 'Refund'
        ELSE 'Other'
    END                                                 AS type,
    wt.amount,
    '0'                                                 AS fee,
    wt.status,
    SUBSTRING(wt.created_at, 1, 10)                     AS date,
    wt.description,
    wt.currency,
    NULL                                                AS user_id,
    wt.reference,
    wt.id                                               AS wallet_transaction_id,
    w.company_id                                        AS company_id
FROM wallet_transactions wt
JOIN wallets w ON w.id = wt.wallet_id
LEFT JOIN transactions t ON t.wallet_transaction_id = wt.id
WHERE t.id IS NULL;
-- Index already exists: transactions_wallet_transaction_id_idx (verify) — add if missing:
-- CREATE INDEX IF NOT EXISTS transactions_wallet_transaction_id_idx
--   ON transactions (wallet_transaction_id);
```

### TypeScript skeleton

Helper to add to `server/storage.ts` (or, better, the new `server/services/transaction-service.ts` from [LU-011](#lu-011-storage-layer-domain-split)):

```ts
type AtomicTxBridgeInput = {
  walletTransactionId: string;
  companyId: string | null;
  walletTxType: 'bill_payment' | 'card_funding' | 'wallet_transfer' | 'wallet_transfer_in' | 'reversal';
  amount: string;            // already toFixed(2)
  currency: string;
  status: string;            // 'completed' | 'pending' | 'failed' | 'reversed'
  description: string;
  reference: string | null;
  date: string;              // ISO date YYYY-MM-DD
};

const WALLET_TX_TO_TXN_TYPE: Record<AtomicTxBridgeInput['walletTxType'], string> = {
  bill_payment:       'Bill',
  card_funding:       'Funding',
  wallet_transfer:    'Transfer',
  wallet_transfer_in: 'Transfer',
  reversal:           'Refund',
};

async function bridgeWalletToTransaction(
  tx: DBTransaction,                 // the in-flight Drizzle transaction
  input: AtomicTxBridgeInput,
): Promise<Transaction> {
  const result = await tx.insert(transactions).values({
    type:                 WALLET_TX_TO_TXN_TYPE[input.walletTxType],
    amount:               input.amount,
    fee:                  '0',
    status:               input.status,
    date:                 input.date,
    description:          input.description,
    currency:             input.currency,
    userId:               null,
    reference:            input.reference,
    walletTransactionId:  input.walletTransactionId,
    companyId:            input.companyId,
  } as any).returning();
  return result[0];
}
```

Each atomic op then calls `bridgeWalletToTransaction(tx, ...)` immediately after the wallet-transaction insert.

### Test strategy

- Unit: mock the Drizzle transaction; assert that `bridgeWalletToTransaction` is called once per atomic op with the right type mapping.
- Integration (testcontainers Postgres — see [LU-013](#lu-013-observability) and AUD-BE-005): run each atomic op end-to-end; assert that exactly one `transactions` row exists with the correct `walletTransactionId` after the call.
- Backfill: run the backfill migration on a snapshot of staging; assert `count(*) FROM transactions = count(*) FROM wallet_transactions` for completed types.

### Rollout plan

1. Land the helper + atomic-op edits behind a feature flag `BRIDGE_WALLET_TO_TRANSACTIONS=true` (default off in prod).
2. Deploy. Run the backfill migration manually after a database snapshot.
3. Flip the flag on. Monitor `transactions` row insert rate via the new APM (or pg_stat).
4. After 7 days clean, remove the flag.

### Effort

2 engineer-days including integration tests.

### Dependencies

- Recommended (not required): [LU-011](#lu-011-storage-layer-domain-split) so the bridge lives in `transaction-service.ts` rather than enlarging the god-object.

---

## LU-002 — Scheduler leader election

### Problem

[server/recurringScheduler.ts:275-284](../../server/recurringScheduler.ts) starts an interval that runs `processRecurringBills`, `processRecurringPayroll`, and `processScheduledPayments` every hour. With ECS auto-scaling configured for 1–4 tasks ([infrastructure/lib/financiar-stack.ts:202-211](../../infrastructure/lib/financiar-stack.ts)), every running task executes the scheduler — leading to duplicate bills and payroll entries, and double-firing of scheduled payouts.

### Current behaviour

```ts
// server/recurringScheduler.ts:275
export function startRecurringScheduler(intervalMs: number = 3600000) {
  if (schedulerInterval) clearInterval(schedulerInterval);
  runRecurringScheduler().catch(console.error);
  schedulerInterval = setInterval(() => {
    runRecurringScheduler().catch(console.error);
  }, intervalMs);
}
```

No coordination between instances.

### Proposed design

Wrap each tick in a Postgres transaction-scoped advisory lock. `pg_try_advisory_xact_lock(N)` returns `true` if the lock is acquired; `false` if another instance holds it. Held locks are released automatically when the transaction commits or rolls back.

Use a single integer key (e.g. hashed identifier of the scheduler's logical owner, like `hashtext('financiar.recurring-scheduler')::int`) so all instances contend for the same lock.

### Schema migration

None required — `pg_try_advisory_xact_lock` is a built-in. Optionally create a SQL helper:

```sql
-- migrations/0009_scheduler_advisory_lock.sql
CREATE OR REPLACE FUNCTION try_acquire_scheduler_lock(name text)
RETURNS boolean AS $$
BEGIN
  RETURN pg_try_advisory_xact_lock(hashtext(name)::int);
END;
$$ LANGUAGE plpgsql VOLATILE;
```

### TypeScript skeleton

```ts
// server/recurringScheduler.ts (replacement)
import { logger } from './lib/logger';
import { db } from './db';
import { sql } from 'drizzle-orm';

async function withSchedulerLock<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
  return await db.transaction(async (tx) => {
    const result = await tx.execute(
      sql`SELECT pg_try_advisory_xact_lock(hashtext(${name})::int) AS acquired`
    );
    const acquired = (result.rows[0] as any)?.acquired === true;
    if (!acquired) {
      logger.debug({ schedulerName: name }, 'Scheduler lock not acquired — another instance is running');
      return null;
    }
    return await fn();
  });
}

export async function runRecurringScheduler() {
  const start = Date.now();
  await withSchedulerLock('financiar.recurring-scheduler', async () => {
    logger.info('Starting recurring scheduler tick');
    await processRecurringBills();
    await processRecurringPayroll();
    await processScheduledPayments();
    logger.info({ durationMs: Date.now() - start }, 'Scheduler tick complete');
  });
}
```

The `console.log/console.error` calls are replaced with `logger.*` per [LU-003](#lu-003-pino-ify-the-scheduler).

### Test strategy

- Unit: stub `db.transaction` to first return `acquired: false` then `acquired: true`; assert that `processRecurringBills` runs only once across two ticks.
- Integration: spin up two app instances pointed at the same testcontainers Postgres; trigger `runRecurringScheduler()` simultaneously; assert that exactly one tick processes bills.

### Rollout plan

Risk-free. Land in one PR; deploy. The advisory lock has zero cost on a single-instance deployment (always acquired).

### Effort

1 day including integration test setup.

### Dependencies

[LU-003](#lu-003-pino-ify-the-scheduler) is recommended companion (same file).

---

## LU-003 — Pino-ify the scheduler

### Problem

[server/recurringScheduler.ts](../../server/recurringScheduler.ts) uses `console.log` and `console.error` (lines 31, 70, 71, 126, 128, 157, 184, 197, 230, 242, 252, 258, 266, 270, 279, 290) instead of the project's pino logger. Operations cannot correlate scheduler runs with request logs in CloudWatch / Datadog.

### Proposed design

Replace each `console.*` with the equivalent `logger.*` from [server/lib/logger.ts](../../server/lib/logger.ts). Use structured fields rather than concatenated strings so log queries like `module:scheduler AND severity>=warn` work.

### TypeScript skeleton

```ts
// At top of file
import { logger as baseLogger } from './lib/logger';
const logger = baseLogger.child({ module: 'recurring-scheduler' });

// Replace `console.error('[Scheduler] Failed to fetch bills:', error.message)` with:
logger.error({ err: error }, 'Failed to fetch bills');

// Replace `console.log('[Scheduler] Created recurring bill: ${bill.name} due ${nextDueDate}')` with:
logger.info({ billName: bill.name, dueDate: nextDueDate }, 'Created recurring bill');
```

### Test strategy

Code-review only; no behavioural change.

### Rollout plan

Single PR. Deploy. Sanity-check CloudWatch log group `/ecs/financiar` for the new structured fields.

### Effort

0.5 day.

### Dependencies

None.

---

## LU-004 — Soft-delete on financial tables

### Problem

`transactions`, `wallet_transactions`, `invoices`, `expenses` are physically deleted today (cascade or direct DELETE). Hard delete on a financial record destroys audit trail and is at odds with regulatory record-keeping requirements (Nigerian NDPR Article 2.13, GDPR Article 5(1)(e), PCI DSS 10.7).

### Proposed design

Add `deleted_at` (nullable text ISO timestamp) to the four tables. Convert all delete paths to update `deleted_at = now()`. All read queries filter `WHERE deleted_at IS NULL`. The data-retention scheduler ([server/lib/data-retention.ts](../../server/lib/data-retention.ts)) hard-deletes only after the configured retention period has elapsed.

### Schema migration

```sql
-- migrations/0010_soft_delete_on_financial_tables.sql
ALTER TABLE transactions       ADD COLUMN IF NOT EXISTS deleted_at text;
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS deleted_at text;
ALTER TABLE invoices            ADD COLUMN IF NOT EXISTS deleted_at text;
ALTER TABLE expenses            ADD COLUMN IF NOT EXISTS deleted_at text;

CREATE INDEX IF NOT EXISTS transactions_active_idx
  ON transactions (company_id, date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS wallet_transactions_active_idx
  ON wallet_transactions (wallet_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS invoices_active_idx
  ON invoices (company_id, due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS expenses_active_idx
  ON expenses (company_id, date) WHERE deleted_at IS NULL;
```

### TypeScript skeleton

Drizzle schema additions (in [shared/schema.ts](../../shared/schema.ts)):

```ts
// Inside each affected pgTable definition, add:
deletedAt: text("deleted_at"),
```

Storage helper:

```ts
// server/lib/soft-delete.ts
import { eq, and, isNull, type SQL } from 'drizzle-orm';

export async function softDeleteById<T extends { id: any; deletedAt: any }>(
  table: T,
  id: string,
): Promise<boolean> {
  const result = await db.update(table)
    .set({ deletedAt: new Date().toISOString() } as any)
    .where(and(eq(table.id, id), isNull(table.deletedAt)))
    .returning();
  return result.length > 0;
}

export function activeOnly<T extends { deletedAt: any }>(table: T): SQL {
  return isNull(table.deletedAt);
}
```

All `getX` queries gain `.where(activeOnly(table))`.

### Test strategy

- Soft-delete an expense; assert it disappears from list endpoints.
- Soft-delete twice; assert the second call is a no-op (returns false).
- Verify the data-retention scheduler hard-deletes rows older than the policy window.

### Rollout plan

Land migration. Land code (queries filter `deletedAt IS NULL`). Deploy. Verify dashboards and reports still match. Then update `data-retention.ts` to hard-delete only soft-deleted rows past retention.

### Effort

1-2 days.

### Dependencies

None blocking; aligns well with [LU-001](#lu-001-wallet--transaction-bridge).

---

## LU-005 — `cardTransactions.currency` column

### Problem

[shared/schema.ts (cardTransactions)](../../shared/schema.ts) has `amount` but no `currency`. International card spend in non-card currencies is ambiguous in reporting.

### Schema migration

```sql
-- migrations/0011_card_transactions_currency.sql
ALTER TABLE card_transactions
  ADD COLUMN IF NOT EXISTS currency text;

-- Backfill from the parent virtual_cards.currency
UPDATE card_transactions ct
SET currency = vc.currency
FROM virtual_cards vc
WHERE ct.card_id = vc.id
  AND ct.currency IS NULL;

ALTER TABLE card_transactions
  ALTER COLUMN currency SET NOT NULL;

ALTER TABLE card_transactions
  ALTER COLUMN currency SET DEFAULT 'USD';

CREATE INDEX IF NOT EXISTS card_transactions_currency_idx
  ON card_transactions (currency);
```

### Drizzle update

```ts
// shared/schema.ts cardTransactions
currency: text("currency").notNull().default('USD'),
```

### Test strategy

Backfill on staging, verify `count(*) WHERE currency IS NULL = 0` post-migration.

### Effort

0.5 day.

---

## LU-006 — Mobile hardening bundle

Three sub-proposals shipped together as one mobile release.

### LU-006a — Jailbreak / root detection

Install `react-native-jail-monkey`. On `App.tsx` startup, check `JailMonkey.trustFall()`. If true, render a blocking screen rather than the app.

```ts
// mobile/App.tsx (additions)
import JailMonkey from 'jail-monkey';

const isCompromisedDevice = JailMonkey.trustFall();
if (isCompromisedDevice) {
  return <CompromisedDeviceScreen />;
}
```

### LU-006b — Certificate pinning

Use the Expo config-plugin pattern with platform-specific OkHttp / NSURLSession pinners. Pin the public key of `app.thefinanciar.com`'s certificate. Provide two pins (current cert + next renewal cert) so rotation does not brick the app.

```js
// mobile/app.config.js (additions)
plugins: [
  [
    'expo-build-properties',
    {
      android: {
        networkSecurityConfig: {
          domains: ['app.thefinanciar.com'],
          pins: [
            'sha256/PRIMARY_CERT_HASH=',
            'sha256/BACKUP_CERT_HASH=',
          ],
        },
      },
      ios: {
        nsAppTransportSecurity: {
          NSPinnedDomains: {
            'app.thefinanciar.com': {
              NSPinnedCAIdentities: [
                { 'SPKI-SHA256-BASE64': 'PRIMARY_CERT_HASH=' },
                { 'SPKI-SHA256-BASE64': 'BACKUP_CERT_HASH=' },
              ],
            },
          },
        },
      },
    },
  ],
],
```

(Cert hashes are placeholders — extract from production cert via `openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl enc -base64`.)

### LU-006c — Encrypted local storage

Move TanStack Query's persister from `AsyncStorage` to `expo-secure-store`-backed storage for sensitive caches. Keep non-sensitive UI state in AsyncStorage.

```ts
// mobile/src/lib/secure-persister.ts
import * as SecureStore from 'expo-secure-store';
import type { Persister } from '@tanstack/react-query-persist-client';

export const securePersister: Persister = {
  persistClient: async (client) => {
    await SecureStore.setItemAsync('rq-cache', JSON.stringify(client));
  },
  restoreClient: async () => {
    const v = await SecureStore.getItemAsync('rq-cache');
    return v ? JSON.parse(v) : undefined;
  },
  removeClient: async () => {
    await SecureStore.deleteItemAsync('rq-cache');
  },
};
```

Note: SecureStore on Android has a 2 KB per-item limit; for larger caches, encrypt with a SecureStore-held key and store ciphertext in AsyncStorage.

### Test strategy

- Jailbreak: install on rooted Android emulator (Magisk); confirm blocking screen.
- Cert pinning: try Charles/mitmproxy with a custom CA; confirm requests fail.
- Storage: inspect Android `/data/data/com.financiar.app/`; confirm cache files are not plaintext.

### Rollout plan

Ship as `1.1.0` to Play Store internal track. Soak for 48h. Promote to production track.

### Effort

3-5 days total.

### Dependencies

None blocking.

---

## LU-007 — CI test gate

### Problem

[.github/workflows/deploy.yml](../../.github/workflows/deploy.yml) runs no tests, no typecheck, no scan before pushing to ECR.

### Proposed design

Insert a gating job before the deploy job. Use the same `actions/setup-node` + `npm ci` cache to keep total CI time under 5 minutes.

### YAML diff (sketch)

```yaml
# .github/workflows/deploy.yml (revised)

jobs:
  ci:
    name: Lint, Typecheck, Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run check          # tsc
      - run: npm test               # vitest run (server + shared + client unit tests)
      # E2E only on main pushes (skip on PR for speed) — Playwright takes longer
      - if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: npx playwright install --with-deps chromium
      - if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: npx playwright test --reporter=line

  security:
    name: Security scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          ignore-unfixed: true
          severity: HIGH,CRITICAL
          exit-code: 1

  deploy:
    needs: [ci, security]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    # ... existing deploy steps unchanged
```

### Test strategy

Open a PR with a deliberately-failing test. Verify the deploy job does not run. Revert.

### Effort

0.5 day.

### Dependencies

- Pair with a small policy: failing CI is a release blocker.

---

## LU-008 — Database-purge endpoint hardening

### Problem

[server/routes/admin.routes.ts:223-250](../../server/routes/admin.routes.ts) accepts `POST /api/admin/purge-database` with `{ confirmPurge: 'CONFIRM_PURGE' }` from any admin, no second factor, no time delay, no out-of-band confirmation. Audit log records `userId: 'system'` rather than the calling admin.

### Proposed design

Three layers of mitigation, ordered from cheap to durable:

1. **Capture the actual admin ID** in the audit log immediately (`req.user.cognitoSub`).
2. **Require the transaction PIN** (`requirePin` middleware).
3. **Two-admin out-of-band confirmation:** the first admin's request creates a "purge intent" row in a new `pending_destructive_actions` table with a 30-minute expiry; a second admin (different `cognitoSub`) must approve via a separate endpoint. Both events are emailed/SMS'd to all admins.
4. **Production feature-flag default-off:** controlled via `systemSettings.allow_purge_endpoint`. Default false in prod; the flag itself is changeable only via direct DB intervention.

### Schema migration

```sql
-- migrations/0012_pending_destructive_actions.sql
CREATE TABLE IF NOT EXISTS pending_destructive_actions (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  action        text NOT NULL,                          -- 'purge_database', etc.
  initiated_by  text NOT NULL,                          -- cognitoSub of admin 1
  initiated_at  text NOT NULL DEFAULT now()::text,
  expires_at    text NOT NULL,                          -- now() + interval '30 min'
  approved_by   text,                                   -- cognitoSub of admin 2
  approved_at   text,
  executed_at   text,
  payload       jsonb NOT NULL,
  CONSTRAINT pending_destructive_actions_distinct_admins
    CHECK (approved_by IS NULL OR approved_by != initiated_by)
);

CREATE INDEX pending_destructive_actions_action_status_idx
  ON pending_destructive_actions (action, executed_at, expires_at);

INSERT INTO system_settings (key, value, description)
VALUES ('allow_purge_endpoint', 'false', 'Allow the database purge endpoint. Must be true in addition to two-admin approval.')
ON CONFLICT (key) DO NOTHING;
```

### TypeScript skeleton

```ts
// server/routes/admin.routes.ts (revised, abbreviated)

router.post("/admin/purge-database/initiate",
  requireAuth, requireAdmin, requirePin,
  async (req, res) => {
    const flagOn = (await storage.getSystemSetting('allow_purge_endpoint'))?.value === 'true';
    if (!flagOn) return res.status(403).json({ error: 'Purge endpoint disabled' });

    const intent = await storage.createPendingDestructiveAction({
      action:       'purge_database',
      initiatedBy:  req.user!.cognitoSub,
      expiresAt:    new Date(Date.now() + 30 * 60_000).toISOString(),
      payload:      req.body,
    });

    await storage.createAuditLog({
      action:     'purge_database_initiated',
      userId:     req.user!.cognitoSub,
      details:    { intentId: intent.id },
      // ... rest
    } as any);

    await notifyAllAdminsOutOfBand({
      subject: 'CRITICAL: database purge initiated',
      body: `Admin ${req.user!.email} initiated a full database purge. Approval required by a second admin within 30 minutes. Intent ID: ${intent.id}`,
    });

    res.json({ intentId: intent.id, expiresAt: intent.expiresAt });
  },
);

router.post("/admin/purge-database/approve/:intentId",
  requireAuth, requireAdmin, requirePin,
  async (req, res) => {
    const intent = await storage.getPendingDestructiveAction(req.params.intentId);
    if (!intent || intent.executedAt) return res.status(404).json({ error: 'Intent not found or already executed' });
    if (intent.expiresAt < new Date().toISOString()) return res.status(410).json({ error: 'Intent expired' });
    if (intent.initiatedBy === req.user!.cognitoSub) return res.status(403).json({ error: 'Two distinct admins required' });

    // Execute
    const result = await storage.purgeDatabase(intent.payload.tablesToPreserve);

    await storage.markPendingDestructiveActionApproved(intent.id, {
      approvedBy: req.user!.cognitoSub,
      approvedAt: new Date().toISOString(),
      executedAt: new Date().toISOString(),
    });

    await storage.createAuditLog({
      action:    'purge_database_executed',
      userId:    req.user!.cognitoSub,
      details:   { intentId: intent.id, initiatedBy: intent.initiatedBy, purgedTables: result.purgedTables },
    } as any);

    res.json(result);
  },
);

// Deprecate the old endpoint by returning 410:
router.post("/admin/purge-database",
  requireAuth, requireAdmin,
  async (_req, res) => res.status(410).json({
    error: 'This endpoint has been replaced by /admin/purge-database/initiate + /approve',
  }),
);
```

### Test strategy

- Two admins flow: initiate by admin A → approve by admin B → assert DB purged, audit log shows both identities.
- Same-admin attempt: initiate by admin A → approve by admin A → assert 403.
- Expired intent: initiate, sleep test-clock 31 minutes, approve → assert 410.
- Flag off: initiate when flag off → assert 403.

### Rollout plan

1. Land migration + endpoints + flag (default false).
2. Deploy.
3. Frontend: replace the purge UI with the two-step flow.
4. Operations runbook documents how to set the flag, who to call, and the safety steps (snapshot first).
5. (Optional) hold-back gate: only the engineering on-call can set the flag.

### Effort

1 day.

### Dependencies

`notifyAllAdminsOutOfBand` helper — uses existing email + SMS infrastructure.

---

## LU-009 — Shared Zod schemas on the client

### Problem

Server-side validation schemas exist in [shared/schema.ts](../../shared/schema.ts) via `drizzle-zod`'s `createInsertSchema`. The client re-implements validation by hand (regex + length checks), creating drift risk.

### Proposed design

For each form, replace manual validation with `zodResolver` from `@hookform/resolvers/zod` plus the corresponding shared schema (refined where the form needs stricter rules).

### TypeScript skeleton

```ts
// shared/schema.ts (already exports many schemas via createInsertSchema)
export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true, createdAt: true, updatedAt: true,
}).extend({
  // Client wants stricter rules than the DB enforces
  description: z.string().min(3).max(500),
  amount:      z.coerce.number().positive(),
});

// client/src/pages/expenses.tsx (skeleton)
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertExpenseSchema } from '@shared/schema';
import type { z } from 'zod';

type ExpenseFormValues = z.infer<typeof insertExpenseSchema>;

const form = useForm<ExpenseFormValues>({
  resolver: zodResolver(insertExpenseSchema),
  defaultValues: { description: '', amount: 0, currency: company.currency },
});
```

The same pattern lifts to login, signup, fund-wallet, send-money, bill-pay, vendor-create.

### Test strategy

Add a vitest test per form that checks `insertXSchema.parse({ ...invalid })` throws and `parse({ ...valid })` returns the parsed object.

### Rollout plan

One PR per form, in dependency order: signup → login → expense → bill → fund-wallet → transfer.

### Effort

2-3 days for the major forms.

### Dependencies

None.

---

## LU-010 — Auth cookie modernization

### Problem

Cognito tokens (id, access, refresh) live in `localStorage`. Any XSS hole = full account takeover. Mitigations like CSP help but do not eliminate this class of risk.

### Proposed design

Move tokens to httpOnly Secure SameSite=Strict cookies. The browser cannot read the cookie via JavaScript (XSS-safe). The client uses fetch's `credentials: 'include'` and the server reads the cookie inside `requireAuth`.

Implementation detail: Cognito's hosted-UI authorization-code grant is what supports server-side cookie issuance. The client code-exchange path needs to be moved server-side. A lightweight token-bridge endpoint at `/api/auth/exchange` accepts the Cognito authz code, exchanges it server-side for tokens, and returns the user profile while setting cookies.

### TypeScript skeleton

```ts
// server/routes/auth.routes.ts (new)
import { Router } from 'express';
import cookieParser from 'cookie-parser';

const router = Router();
router.use(cookieParser());

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  domain:   process.env.NODE_ENV === 'production' ? '.thefinanciar.com' : undefined,
  path:     '/',
};

router.post('/auth/exchange', async (req, res) => {
  const { code, redirectUri } = req.body;
  const tokens = await exchangeCognitoCode(code, redirectUri);   // server-side fetch
  res.cookie('fnr_id',      tokens.id_token,      { ...COOKIE_OPTS, maxAge: tokens.expires_in * 1000 });
  res.cookie('fnr_access',  tokens.access_token,  { ...COOKIE_OPTS, maxAge: tokens.expires_in * 1000 });
  res.cookie('fnr_refresh', tokens.refresh_token, { ...COOKIE_OPTS, maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.json({ user: await loadUserProfile(tokens.id_token) });
});

router.post('/auth/refresh', async (req, res) => {
  const refresh = req.cookies['fnr_refresh'];
  if (!refresh) return res.status(401).json({ error: 'No refresh token' });
  const tokens = await refreshCognitoTokens(refresh);
  res.cookie('fnr_id',     tokens.id_token,     { ...COOKIE_OPTS, maxAge: tokens.expires_in * 1000 });
  res.cookie('fnr_access', tokens.access_token, { ...COOKIE_OPTS, maxAge: tokens.expires_in * 1000 });
  res.json({ ok: true });
});

router.post('/auth/logout', (_req, res) => {
  res.clearCookie('fnr_id',      COOKIE_OPTS);
  res.clearCookie('fnr_access',  COOKIE_OPTS);
  res.clearCookie('fnr_refresh', COOKIE_OPTS);
  res.json({ ok: true });
});

export default router;
```

`server/middleware/auth.ts` reads the JWT from `req.cookies.fnr_id` instead of (or in addition to, during transition) the `Authorization` header.

### CSRF

Cookies + state-changing requests = CSRF risk. Keep the existing `X-Requested-With` pattern, plus a double-submit token pattern: server sets a non-httpOnly `fnr_csrf` cookie; client reads it and echoes in `X-CSRF-Token` header on every mutation. CSRF middleware checks they match.

### Mobile

Mobile cannot use cookies in the same way (RN fetch doesn't have native httpOnly cookie support cross-platform). Mobile keeps the bearer-token approach but uses Keychain/Keystore via [LU-006c](#lu-006-mobile-hardening) for storage.

### Test strategy

- E2E: login → cookies set with `HttpOnly; Secure; SameSite=Strict` flags.
- XSS regression: inject `<script>fetch('/api/me')</script>` via a stored field; assert request succeeds with cookie but no `Authorization: Bearer` header is present in the request.
- Logout: assert all three cookies are cleared.

### Rollout plan

Ship behind a feature flag `AUTH_COOKIE_MODE=true`. Migrate flow-by-flow (signup → login → OAuth callback). After 7 days clean, remove the localStorage path.

### Effort

3-4 days including frontend and CSRF rewiring.

### Dependencies

- CORS config in `server/index.ts` already includes `credentials: true`.

---

## LU-011 — Storage layer domain split

### Problem

`server/storage.ts` is 2,416 lines, ~230 methods, single class. Hard to test in isolation; high merge-conflict surface; obscures domain boundaries.

### Proposed design

Phased extraction:

1. **Phase 1**: Extract `transaction-service.ts` (transactions + walletTransactions + atomic ops). The bridge ([LU-001](#lu-001-wallet--transaction-bridge)) lives here from day one.
2. **Phase 2**: Extract `payment-service.ts` (payment intents, processed webhooks, payouts, payout destinations).
3. **Phase 3**: Extract `wallet-service.ts` (wallets, virtual cards, virtual accounts, card transactions).
4. **Phase 4**: Extract `compliance-service.ts` (KYC, audit logs, data retention, role permissions).
5. **Phase 5**: Extract `tenancy-service.ts` (companies, members, invitations, settings).
6. **Phase 6**: `storage.ts` becomes a thin facade re-exporting service methods (or removed entirely).

Each service is its own class with constructor-injected `db`, making testcontainers integration tests straightforward.

### Skeleton

```ts
// server/services/transaction-service.ts
import { db } from '../db';
import { transactions, walletTransactions, wallets } from '@shared/schema';
import { sql, eq } from 'drizzle-orm';

export class TransactionService {
  constructor(private readonly database = db) {}

  async atomicBillPayment(params: AtomicBillPaymentInput): Promise<AtomicBillPaymentResult> {
    return this.database.transaction(async (tx) => {
      // ... existing logic from storage.ts:1484-1548
    });
  }

  async atomicReversal(params: AtomicReversalInput): Promise<WalletTransaction> { /* ... */ }
  async atomicWalletTransfer(params: AtomicTransferInput): Promise<TransferResult> { /* ... */ }
  async atomicCardFunding(params: AtomicCardFundingInput): Promise<CardFundingResult> { /* ... */ }

  // Plus reads
  async getTransactions(opts: { companyId: string; limit?: number; offset?: number }): Promise<Transaction[]> { /* ... */ }
}

// server/services/index.ts
export const services = {
  transactions: new TransactionService(),
  payments:     new PaymentService(),
  wallets:      new WalletService(),
  // ...
};
```

### Test strategy

Per service: unit tests with mocked `database`, plus testcontainers integration tests for atomic ops and FOR UPDATE behaviour under contention.

### Rollout plan

Phase by phase, one PR per phase. Each phase is independently deployable (new service introduced, old `storage.ts` methods delegate to it, then call sites migrated, then `storage.ts` methods removed).

### Effort

5-7 days for all 6 phases. Phase 1 alone is 1.5 days and unblocks [LU-001](#lu-001-wallet--transaction-bridge).

### Dependencies

Pair with [LU-005 testcontainers](#lu-005-cardtransactions-currency-column) groundwork.

---

## LU-012 — Multi-NAT + multi-environment CDK

### Problem

[infrastructure/lib/financiar-stack.ts](../../infrastructure/lib/financiar-stack.ts) declares one stack class with `natGateways: 1`, `multiAz: false`, hardcoded `APP_URL`, hardcoded ECS env mapping. There is no `dev` or `staging` instance — production is the only environment.

### Proposed design

1. Promote the stack to take an `env` parameter and parameterize URLs, instance sizes, and HA settings.
2. Add `natGateways: 2`, `multiAz: true` for prod.
3. Instantiate three stacks from `infrastructure/bin/app.ts`.

### TypeScript skeleton

```ts
// infrastructure/lib/financiar-stack.ts
export type FinanciarEnv = 'dev' | 'staging' | 'prod';

export interface FinanciarStackProps extends cdk.StackProps {
  env: FinanciarEnv;
  appUrl: string;
  certificateArn?: string;
}

const ENV_DEFAULTS: Record<FinanciarEnv, {
  natGateways: number;
  multiAz: boolean;
  rdsInstanceClass: ec2.InstanceClass;
  rdsInstanceSize: ec2.InstanceSize;
  taskCpu: number;
  taskMem: number;
  minCapacity: number;
  maxCapacity: number;
}> = {
  dev:     { natGateways: 1, multiAz: false, rdsInstanceClass: ec2.InstanceClass.T3, rdsInstanceSize: ec2.InstanceSize.MICRO, taskCpu: 256,  taskMem: 512,  minCapacity: 1, maxCapacity: 1 },
  staging: { natGateways: 1, multiAz: false, rdsInstanceClass: ec2.InstanceClass.T3, rdsInstanceSize: ec2.InstanceSize.SMALL, taskCpu: 512,  taskMem: 1024, minCapacity: 1, maxCapacity: 2 },
  prod:    { natGateways: 2, multiAz: true,  rdsInstanceClass: ec2.InstanceClass.T3, rdsInstanceSize: ec2.InstanceSize.MEDIUM, taskCpu: 1024, taskMem: 2048, minCapacity: 2, maxCapacity: 6 },
};

export class FinanciarStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FinanciarStackProps) {
    super(scope, id, props);
    const cfg = ENV_DEFAULTS[props.env];

    const vpc = new ec2.Vpc(this, 'FinanciarVpc', {
      maxAzs: 2,
      natGateways: cfg.natGateways,
      // ...
    });

    const database = new rds.DatabaseInstance(this, 'FinanciarDb', {
      multiAz: cfg.multiAz,
      instanceType: ec2.InstanceType.of(cfg.rdsInstanceClass, cfg.rdsInstanceSize),
      // ...
    });

    container.addContainer('financiar', {
      environment: {
        APP_URL: props.appUrl,           // parameterized
        // ...
      },
    });

    // ... etc.
  }
}
```

```ts
// infrastructure/bin/app.ts
new FinanciarStack(app, 'FinanciarDevStack',     { env: 'dev',     appUrl: 'https://dev.thefinanciar.com',     env: { region: 'us-east-1' } });
new FinanciarStack(app, 'FinanciarStagingStack', { env: 'staging', appUrl: 'https://staging.thefinanciar.com', env: { region: 'us-east-1' } });
new FinanciarStack(app, 'FinanciarProdStack',    { env: 'prod',    appUrl: 'https://app.thefinanciar.com',     env: { region: 'us-east-1' }, certificateArn: process.env.PROD_CERT_ARN });
```

### Cost impact

- Multi-NAT: ~$32/mo extra in prod (one extra NAT gateway).
- Multi-AZ RDS: ~$15/mo extra at t3.micro; scales with instance size.
- Two extra environments: ~$60–120/mo for dev + staging if always-on. Use `desiredCount: 0` overnight via EventBridge schedule to reduce by ~70% if budget-constrained.

### Test strategy

- `cdk diff FinanciarProdStack` should show only the multi-NAT and multi-AZ changes against current state.
- `cdk synth` for all three stacks; verify no resource collisions.
- Spin up dev stack first; verify deploy.yml works against it.

### Rollout plan

1. Add the three-stack instantiation; deploy `FinanciarDevStack` first.
2. Update `deploy.yml` to take an environment matrix or one workflow per env.
3. Migrate prod by re-deploying with the new prod stack name (CDK migration with no resource recreation requires careful logical-ID preservation; alternative is a new stack and a maintenance window for the cutover).

### Effort

2-3 days; cutover window for prod can extend to 1 day of careful work.

### Dependencies

Requires three additional ACM certs (`dev.thefinanciar.com`, `staging.thefinanciar.com`).

---

## LU-013 — Observability

### Problem

No APM. PII redaction is partial.

### Proposed design

Add OpenTelemetry SDK; export traces and metrics to Honeycomb (recommended for fintech latency analysis) or Datadog. Wire pino → OTel logs.

### Skeleton

```ts
// server/lib/otel.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]:    'financiar-api',
    [ATTR_SERVICE_VERSION]: process.env.GIT_SHA ?? 'dev',
  }),
  traceExporter: new OTLPTraceExporter({
    url: 'https://api.honeycomb.io/v1/traces',
    headers: { 'x-honeycomb-team': process.env.HONEYCOMB_API_KEY! },
  }),
  instrumentations: [getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-fs': { enabled: false },   // noisy
  })],
});

sdk.start();
```

Wire `server/index.ts` to import `./lib/otel` first so auto-instrumentation hooks Express, pg, fetch, and Cognito SDK.

### PII auto-redaction

Wrap pino with a serializer that runs `maskPII` on string values across the message tree:

```ts
// server/lib/logger.ts (additions)
function maskPIIInObject(obj: any, depth = 0): any {
  if (depth > 5) return obj;                                   // safety
  if (typeof obj === 'string') return maskPII(obj);
  if (Array.isArray(obj))     return obj.map((v) => maskPIIInObject(v, depth + 1));
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, maskPIIInObject(v, depth + 1)]),
    );
  }
  return obj;
}

export const logger = pino({
  // ... existing config
  formatters: {
    log:  (object) => maskPIIInObject(object),
  },
});
```

### Test strategy

- Unit: `logger.info({ email: 'a@b.com' }, 'msg')` produces output where the email is `[EMAIL]`.
- Integration: open a trace in Honeycomb post-deploy; assert spans for `POST /api/expenses` show DB and external HTTP children.

### Effort

2-3 days.

### Dependencies

Honeycomb / Datadog account + API key (low cost, free tier covers early scale).

---

## LU-014 — Daily payment reconciliation

### Problem

If a webhook is missed (provider outage, network blip outside our retry envelope), local ledger drifts from provider ledger. Currently no automated check.

### Proposed design

Daily cron at 02:00 UTC pulls the previous day's events from Stripe (`stripe.events.list`) and Paystack (`/transaction/totals`, `/transaction/timeline`), compares to local `processed_webhooks` and `wallet_transactions(reference)`, and writes a diff report to `reconciliation_reports`. Discrepancies above a threshold page on-call.

### Schema migration

```sql
-- migrations/0013_reconciliation_reports.sql
CREATE TABLE IF NOT EXISTS reconciliation_reports (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_date        date NOT NULL,
  provider        text NOT NULL,                     -- 'stripe' | 'paystack'
  events_seen     integer NOT NULL,
  events_matched  integer NOT NULL,
  events_missing  integer NOT NULL,
  details         jsonb NOT NULL,
  created_at      text NOT NULL DEFAULT now()::text,
  CONSTRAINT recon_run_provider_unique UNIQUE (run_date, provider)
);
```

### Skeleton

```ts
// server/services/reconciliation-service.ts
export class ReconciliationService {
  async runDaily(date: string): Promise<void> {
    const stripeReport   = await this.reconcileStripe(date);
    const paystackReport = await this.reconcilePaystack(date);

    if (stripeReport.events_missing > 0 || paystackReport.events_missing > 0) {
      await pageOnCall({ title: 'Payment reconciliation diff', stripeReport, paystackReport });
    }
  }
  // ...
}
```

Wire to the recurring scheduler under [LU-002](#lu-002-scheduler-leader-election)'s advisory lock.

### Effort

1-2 days.

### Dependencies

Stripe + Paystack list-events API access (already have keys).

---

## Cross-proposal dependency graph

```
LU-007 (CI gate) ────────────────────────────────────────────────┐
                                                                 ▼
LU-002 (scheduler lock) ◀─── LU-003 (pino-ify) ◀── LU-013 (observability)
       │
       ▼
LU-014 (reconciliation)
                                                LU-001 (wallet bridge)
                                                       │
                                                       ▼
                                         LU-011 (storage split)
                                                       ▲
LU-005 (card currency) ──┐                             │
LU-004 (soft delete) ────┼──▶ LU-009 (Zod on client) ──┘
                         │
                         ▼
                LU-010 (auth cookies)
                         │
                         ▼
                LU-006 (mobile hardening)

LU-008 (purge hardening) — independent
LU-012 (multi-env CDK)   — independent
```

Recommended sprint mapping is in [`AUDIT_2026_04_26.md` § 9](AUDIT_2026_04_26.md#9-recommended-remediation-sequencing).

---

**See also:**

- [`AUDIT_2026_04_26.md`](AUDIT_2026_04_26.md) — full code audit (the 48 findings these proposals address)
- [`EXECUTIVE_SUMMARY.md`](EXECUTIVE_SUMMARY.md) — 1-page executive roll-up
- [`BRD_2026_04_26.md`](BRD_2026_04_26.md) — business context
- [`../../PRD.md`](../../PRD.md) — refreshed product spec
