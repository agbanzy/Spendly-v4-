# Payroll Module Audit — 2026-04-26

**Scope:** end-to-end review of the payroll feature — UI, API, storage, schema, tests.
**Auditor:** Claude (Sonnet 4.5)
**Severity scale:** CRITICAL / HIGH / MEDIUM / LOW.
**Verification posture:** every finding below was cross-checked by reading the source. The agent-mapping pass surfaced candidate findings; this document only retains those whose `file:line` citations were independently verified against the actual code.

---

## 1. Wiring map (verified)

| Surface | File | Notes |
|---|---|---|
| UI | `client/src/pages/payroll.tsx` | List, add/edit/delete, run-payroll, pay-individual, view-payslip, CSV/JSON export, Paystack bank-account verify |
| Mobile UI | `mobile/src/screens/PayrollScreen.tsx` | Mirrors web endpoints |
| Routes | `server/routes/payroll.routes.ts` (697 lines) | Mounted at `/api` in `server/routes/index.ts:98` |
| Storage | `server/storage.ts:1116–1145` | 5 methods: `getPayroll`, `getPayrollEntry`, `createPayrollEntry`, `updatePayrollEntry`, `deletePayrollEntry` |
| Schema | `shared/schema.ts:395–422` | `payroll_entries` table, nullable `companyId` |
| Tests | `server/__tests__/middleware/csrf.test.ts:161` | One CSRF test only — no behavioural coverage |

Endpoints (mounted at `/api/payroll*`):

| Verb | Path | Middleware stack | Purpose |
|---|---|---|---|
| GET | `/payroll` | `requireAuth + requireAdmin` | List entries scoped via `resolveUserCompany` |
| GET | `/payroll/tax-estimate` | `requireAuth` | Public-ish tax helper (NG/GH/KE/ZA/etc.) |
| GET | `/payroll/:id` | `requireAuth + requireAdmin` | Single entry — has `verifyCompanyAccess` guard |
| POST | `/payroll` | `requireAuth + requireAdmin` | Create entry; netPay re-computed server-side |
| PATCH | `/payroll/:id` | `requireAuth + requireAdmin` | Update — **no company guard** |
| DELETE | `/payroll/:id` | `requireAuth + requireAdmin` | Delete — **no company guard** |
| POST | `/payroll/process` | `financialLimiter + requireAuth + requireAdmin + requirePin` | Bulk run — initiates real Stripe / Paystack transfers |
| POST | `/payroll/:id/pay` | `requireAuth + requireAdmin + requirePin` | Single-entry payout |
| POST | `/payroll/batch-payout` | `requireAuth + requireAdmin + requirePin` | Batch payout creator |

---

## 2. Findings

### AUD-PR-001 — `POST /payroll/process` initiates payouts for **every company in the system**

**Severity:** CRITICAL — multi-tenant funds leak.

**File:line:** `server/routes/payroll.routes.ts:299`

```ts
router.post("/payroll/process", financialLimiter, requireAuth, requireAdmin, requirePin, async (req, res) => {
  try {
    const entries = await storage.getPayroll();         // ← no companyId argument
    const pendingEntries = entries.filter((e: any) => e.status === "pending" ...);
    ...
    for (const entry of pendingEntries) { /* initiate Stripe / Paystack transfer */ }
```

`storage.getPayroll(companyId?)` (`server/storage.ts:1116`) returns **all rows from all companies** when `companyId` is omitted. The route then loops the filtered set and calls `paystackClient.initiateTransfer` / `stripe.payouts.create` for each — meaning a Company A admin running "Run payroll" triggers real bank transfers for Company B, C, D's employees, debiting whichever Stripe / Paystack account is in scope at the provider level.

**Verification:** read `payroll.routes.ts:299` and `storage.ts:1116–1124` directly. The `if (companyId) { ... } default-no-where` branch is plain SQL.

**Impact:** unauthorized money movement across tenants on every "Run payroll" click.

**Fix:**
```ts
const company = await resolveUserCompany(req);
if (!company?.companyId) return res.status(403).json({ error: "Company context required" });
const entries = await storage.getPayroll(company.companyId);
```

---

### AUD-PR-002 — `POST /payroll/:id/pay` does not verify the entry belongs to the caller's company

**Severity:** CRITICAL — IDOR → unauthorized cross-tenant payout.

**File:line:** `server/routes/payroll.routes.ts:459–625`

```ts
router.post("/payroll/:id/pay", requireAuth, requireAdmin, requirePin, async (req, res) => {
  const entry = await storage.getPayrollEntry(param(req.params.id));   // ← no scope check
  if (!entry) return res.status(404).json({ error: "Payroll entry not found" });
  if (entry.status !== "pending") return res.status(400).json(...);
  // ... goes on to initiate real payment via Stripe / Paystack
```

`storage.getPayrollEntry(id)` (`server/storage.ts:1127`) is a bare `WHERE id = ?` lookup. No comparison of `entry.companyId` to the caller's resolved company. An admin in Tenant A who guesses or harvests an `id` from any other tenant can call this endpoint and the server happily initiates a real bank transfer.

**Fix:**
```ts
const company = await resolveUserCompany(req);
if (!company?.companyId || !await verifyCompanyAccess(entry.companyId, company.companyId)) {
  return res.status(403).json({ error: "Access denied" });
}
```

---

### AUD-PR-003 — `POST /payroll/batch-payout` accepts client-supplied `payrollIds` without company validation

**Severity:** CRITICAL — IDOR → bulk unauthorized cross-tenant payout.

**File:line:** `server/routes/payroll.routes.ts:634–690`

```ts
router.post("/payroll/batch-payout", requireAuth, requireAdmin, requirePin, async (req, res) => {
  const { payrollIds } = parsed.data;
  for (const payrollId of payrollIds) {
    const entry = await storage.getPayrollEntry(payrollId);    // ← no scope check
    if (!entry || entry.status === 'paid') continue;
    // ... db.transaction → createPayout + updatePayrollEntry to 'processing'
  }
```

Same root cause as AUD-PR-002 but in array form: the client posts up to 50 IDs (`batchPayoutSchema.max(50)`), and each ID is fetched via the unscoped `getPayrollEntry` lookup. The DB transaction at line 660 is good for **atomicity per row** but does nothing for tenant isolation.

**Fix:** filter the input through a scoped query before processing:
```ts
const entries = await storage.getPayrollByIds(payrollIds, company.companyId);
// only entries where companyId matches caller proceed
```
(adds a new storage helper that ANDs `companyId` into the `WHERE id IN (...)` clause).

---

### AUD-PR-004 — `PATCH /payroll/:id` has no company guard

**Severity:** HIGH — IDOR → tenant data tampering.

**File:line:** `server/routes/payroll.routes.ts:269–283`

```ts
router.patch("/payroll/:id", requireAuth, requireAdmin, async (req, res) => {
  const result = payrollUpdateSchema.safeParse(req.body);
  ...
  const entry = await storage.updatePayrollEntry(param(req.params.id), result.data);
  if (!entry) return res.status(404).json(...);
  res.json(entry);
});
```

Same shape as AUD-PR-002 — fetch-by-id and update-by-id with no `companyId` clause. Admin in Tenant A can alter Tenant B's salary, deductions, account number, etc.

The `updatePayrollEntry` storage method (`server/storage.ts:1137`) is `UPDATE ... WHERE id = ?` only.

**Fix:** read the entry first, `verifyCompanyAccess`, then update — or extend the storage method to take a required `companyId` and AND it into the `WHERE`.

---

### AUD-PR-005 — `DELETE /payroll/:id` has no company guard

**Severity:** HIGH — IDOR → tenant data destruction.

**File:line:** `server/routes/payroll.routes.ts:285–295`

```ts
router.delete("/payroll/:id", requireAuth, requireAdmin, async (req, res) => {
  const deleted = await storage.deletePayrollEntry(param(req.params.id));
  ...
});
```

Same root cause. `storage.deletePayrollEntry(id)` (`server/storage.ts:1142`) is `DELETE ... WHERE id = ?`. Cross-tenant destruction of payroll history with no audit trail (the route does not write to `audit_logs` either — see AUD-PR-008).

**Fix:** identical to AUD-PR-004 — read-then-verify-then-delete, or scope-via-storage.

---

### AUD-PR-006 — Bulk processing loop has no atomicity → orphaned-transaction risk

**Severity:** HIGH — financial-state divergence.

**File:line:** `server/routes/payroll.routes.ts:320–432` (the body of the `for (const entry of pendingEntries)` loop in `/payroll/process`)

The loop initiates real Stripe / Paystack transfers and creates a row in `transactions` per entry, but the whole batch is **not** wrapped in a DB transaction, and there's no compensation path if a provider call succeeds and the subsequent local write fails. Each iteration is best-effort; if the process is killed mid-loop (ECS task replaced, OOM, deploy), some entries are paid + recorded, some are paid but not recorded, some are not paid at all. The status-filter idempotency guard at line 302–304 (`status === "pending" && !"processing|completed|paid"`) helps on retry, but it relies on the local row being updated — which is exactly what fails when the process dies between provider-call and DB-write.

The single-row `/payroll/:id/pay` (line 459) and `/payroll/batch-payout` (line 634) variants also have this gap — `/batch-payout` wraps `createPayout + updatePayrollEntry` in a DB transaction (line 660) which is good for those two writes, but the provider call (the actual money movement) is **outside** that transaction in the code path that follows from `/payroll/:id/pay`.

**Fix path:** apply the **claim → debit → external → compensate** pattern that `payouts.routes.ts` adopted in the LU-DD-5 audit work (PR #5):
1. `claimPayrollForProcessing` — atomic DB UPDATE that flips `pending` → `processing` and returns the row only if the claim succeeded (so concurrent retries are safe)
2. Initiate provider transfer
3. On success → atomic DB UPDATE to `'paid'` + record transaction
4. On failure → atomic DB UPDATE to `'failed'` + audit-log compensation event

Schema-level idempotency: add a `provider_reference` column with a UNIQUE index so a retried transfer can't be double-recorded.

---

### AUD-PR-007 — `payroll_entries.companyId` is nullable; row creation falls through to `null` if company resolution fails

**Severity:** MEDIUM — silent multi-tenant data corruption.

**File:line:** `shared/schema.ts:395–422`, `server/routes/payroll.routes.ts:255`

```ts
// schema
companyId: text("company_id").references(() => companies.id, { onDelete: 'set null' }),
// route — line 255
companyId: company?.companyId,
```

If `resolveUserCompany(req)` returns `null` (e.g. a malformed user record, a rebooted Cognito-only session before company resolution lands), the entry is created with `companyId = null`. Once that row exists, every subsequent `/payroll` GET that filters by company misses it (orphaned), and `/payroll/process` is the only call site that sees it again — and that's exactly the unscoped path in AUD-PR-001, where the entry will be processed on the **next** admin's bulk-run regardless of which tenant they belong to.

**Fix:**
1. Migration: backfill nulls to a sentinel and add `NOT NULL` constraint.
2. Route: fail-closed — `if (!company?.companyId) return 403`.
3. Optional: add a partial unique index on `(companyId, employeeId, payDate)` to catch duplicate-entry bugs at insert.

---

### AUD-PR-008 — No audit-log writes for any payroll action

**Severity:** MEDIUM — compliance gap.

**Search:** `grep -n 'audit' server/routes/payroll.routes.ts` returns zero matches; no `auditLogger.log` / `storage.createAuditLog` calls anywhere in the file.

Payroll runs are exactly the kind of money-moving action that SOC 2 / NDPA / PCI auditors expect to see in a tamper-evident audit trail with: actor (who clicked Run), action, target (which entry / employee), prior state, new state, request correlation ID, IP, user-agent, timestamp.

The codebase has a working audit layer (used in `team.routes.ts`, `admin.routes.ts`, etc.). Payroll just doesn't call it.

**Fix:** wrap each state-changing route (POST / PATCH / DELETE / process / pay / batch-payout) with an audit-log emission at the success boundary — actor `req.user.uid`, action `'payroll.run' | 'payroll.pay' | 'payroll.update' | 'payroll.delete'`, before/after for sensitive fields.

---

### AUD-PR-009 — No behavioural test coverage on payroll routes

**Severity:** MEDIUM — regression risk on a money-moving surface.

**Search:** `grep -r 'payroll' server/__tests__/ shared/__tests__/` returns one CSRF test (`csrf.test.ts:161`) and zero functional tests. There are no tests for:
- company-scoped reads (would have caught AUD-PR-001)
- IDOR on `/payroll/:id/pay` (would have caught AUD-PR-002)
- batch-payout cross-tenant ID injection (AUD-PR-003)
- negative netPay rejection (the AUD-DD-FORM-021 fix at line 228 has no regression test)
- atomic claim/debit/compensate (AUD-PR-006)

For a route module that initiates real bank transfers, that's an unacceptable gap.

**Fix:** add at minimum the following tests, in `server/__tests__/routes/payroll.routes.test.ts`:
1. Cross-tenant `/payroll/:id/pay` returns 403 with mismatched companyId (regression for AUD-PR-002)
2. `/payroll/process` only processes the caller's company entries (regression for AUD-PR-001)
3. `/payroll/batch-payout` with 1 owned + 1 cross-tenant ID processes only the owned one (regression for AUD-PR-003)
4. PATCH / DELETE return 403 on cross-tenant id (regression for AUD-PR-004 / 005)
5. POST `/payroll` rejects `salary=100, deductions=200` with 400 (regression for AUD-DD-FORM-021)
6. Idempotency: posting the same `/payroll/process` twice in <1s only initiates one transfer per entry (claim-pattern check)

---

### AUD-PR-010 — Stripe payout uses raw `bank_account` token creation, bypassing the connected-accounts model

**Severity:** MEDIUM — compliance + reliability concern.

**File:line:** `server/routes/payroll.routes.ts:518–541`

```ts
const bankToken = await stripe.tokens.create({
  bank_account: {
    country: countryCode,
    currency: currency.toLowerCase(),
    account_holder_name: entry.employeeName,
    account_holder_type: 'individual',
    routing_number: ...,
    account_number: (defaultDest as any).accountNumber,
  } as any,
});
const payout = await stripe.payouts.create({
  amount: Math.round(netPayAmount * 100),
  ...
  destination: bankToken.id,
});
```

This pattern is the **legacy** Stripe payout flow — it requires the platform's own Stripe balance to fund the payout, and the destination is a one-off `bank_account` token. Two practical problems:

1. **PCI scope creep.** Bank account numbers + routing numbers transit our server. The Stripe-recommended path is Stripe Connect (Express / Custom accounts) where the employee onboards via Stripe-hosted forms and we only ever hold an `acct_*` ID — keeping us in PCI SAQ-A scope rather than higher.

2. **Reconciliation pain.** The legacy path mixes platform-balance debits with employee payouts in the same Stripe ledger; investigating "did this employee get paid" requires correlating payout IDs with internal payroll IDs without the structured `transfer` events Connect provides.

This is also at odds with the Paystack path next to it (lines 493–514), which does use the recipient model.

**Fix:** migrate to Stripe Connect Express accounts for non-NG payroll. This is a non-trivial change but should be on the roadmap before scaling US/EU payroll volume.

---

### AUD-PR-011 — `entry.salary` used as a fallback amount for payouts

**Severity:** LOW — defensive-programming theatre with a real failure mode.

**File:line:** `server/routes/payroll.routes.ts:663`

```ts
const payout = await storage.createPayout({
  type: 'payroll',
  amount: entry.netPay || entry.salary,    // ← fallback to salary if netPay missing
  ...
});
```

`netPay` is required (`schema.ts:411`), so the `|| entry.salary` fallback should be unreachable. But if it ever hits — say during a partial migration or a manual SQL fix — the code silently pays the **gross** amount instead of the net, undercutting tax/deduction policy.

**Fix:** delete the fallback. If `netPay` is missing on an entry, fail closed with a 400 / 500 — never pay a different amount than the system computed.

---

### AUD-PR-012 — Tax-estimate brackets are hard-coded; no tax-period awareness

**Severity:** LOW — accuracy decay over time.

**File:line:** `server/routes/payroll.routes.ts:36–168`

The tax-estimate endpoint hard-codes 2024-era brackets for NG / GH / KE / ZA. Tax tables change (NG TAT 2024, KE Finance Act amendments, etc.). With no `effectiveAsOf` parameter and no datasource attribution, downstream consumers have no signal that the result is dated, and a payroll calculation in 2027 will silently use 2024 numbers.

**Fix:** lift the brackets into a versioned config table (`tax_brackets` with `country`, `effective_from`, `effective_to`, `tiers JSONB`) and add a `Last updated: YYYY-MM` line to the API response. Out of scope for the current sprint but worth a follow-up.

---

## 3. Severity roll-up

| Severity | Count | Findings |
|---|---|---|
| CRITICAL | 3 | AUD-PR-001, 002, 003 |
| HIGH | 3 | AUD-PR-004, 005, 006 |
| MEDIUM | 4 | AUD-PR-007, 008, 009, 010 |
| LOW | 2 | AUD-PR-011, 012 |

The three CRITICAL findings are the **same root cause** — missing `verifyCompanyAccess` between `getPayroll(Entry)` and any side-effect (read, payout, update, delete). One sweep across the route file fixes 1, 2, 3, 4, 5 simultaneously. AUD-PR-006 (atomicity) is a deeper refactor that mirrors the LU-DD-5 payouts work.

---

## 4. Recommended sequencing

**Sprint 1 — closes the bleeding (1 PR, ~1 day):**

1. AUD-PR-001 → 005: add a single helper `assertPayrollEntryInCompany(entryId, callerCompanyId)` that fetches + verifies in one shot, and call it from every state-changing route. Replace the unscoped `getPayroll()` call at line 299 with the scoped `getPayroll(company.companyId)`.
2. AUD-PR-007: fail-closed if `resolveUserCompany` returns null.
3. AUD-PR-009 (subset): add the cross-tenant 403 regression tests for the five routes touched above.

**Sprint 2 — hardens the money path (~2–3 days):**

4. AUD-PR-006: claim-pattern refactor for `/payroll/process` and `/payroll/:id/pay`, mirroring `payouts.routes.ts`.
5. AUD-PR-008: audit-log emission for every payroll mutation.
6. AUD-PR-009 (rest): full behavioural test coverage.
7. AUD-PR-011: drop the `entry.salary` fallback.

**Quarter — strategic:**

8. AUD-PR-010: Stripe Connect migration plan.
9. AUD-PR-012: versioned tax-bracket config + admin UI to update.

---

## 5. Cross-references

- `server/routes/payouts.routes.ts` claim-pattern (LU-DD-5 / PR #5) is the reference architecture for AUD-PR-006.
- `server/routes/team.routes.ts` last-admin guard pattern is the reference for AUD-PR-008 audit-log emission.
- `AUDIT_DEEP_DIVE_2026_04_26.md` — earlier multi-tenant findings on transactions / expenses share the same root cause as AUD-PR-001 → 005 (missing scoping).
- `LOGIC_UPGRADE_PROPOSALS.md` — LU-DD-5 (debit-first payouts) is the canonical write-up of the claim/debit/compensate pattern referenced in AUD-PR-006.
- `SCREEN_WIRING_MATRIX.md` — payroll row to be updated to reflect the issues above.

---

## 6. What I did NOT verify

- The mobile screen `mobile/src/screens/PayrollScreen.tsx` was reported by the mapping agent as mirroring the web endpoints. I did not read it line-by-line. If it directly calls `/payroll/process` or `/payroll/batch-payout`, the same critical findings apply on the mobile surface (same backend bug class). Worth a 5-minute follow-up read.
- The `server/routes.legacy.ts` references at lines 2972, 3148, 3557 were flagged by the mapping agent. The legacy file is unmounted (per the boot sequence in `server/index.ts`, only `server/routes/index.ts` is mounted), so legacy code does not affect runtime. Worth confirming with one `grep` and then deleting the legacy file as a follow-up cleanup task.
- The Paystack transfer recipient creation (line 495) does not appear to memoize recipients by employee — every payroll run re-creates the recipient. Paystack may dedup or may charge per-create. Out of scope here; flag for the payments team.
