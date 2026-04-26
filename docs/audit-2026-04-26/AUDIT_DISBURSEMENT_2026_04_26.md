# Disbursement / Real Cash-Out Audit — 2026-04-26

**Scope:** the request → approval → disbursement chain for real money leaving the platform via Stripe (Connect transfers, bank-token payouts) and Paystack (transfers).
**Auditor:** Claude (Sonnet 4.5).
**Verification posture:** every `file:line` citation in this document was independently re-read against source. Findings the agent-mapping pass surfaced but I could not confirm by hand are flagged "unverified" or omitted.

---

## 1. Wiring map (verified)

```
client/src/pages/admin-payouts.tsx     — list + "process" button
client/src/pages/expenses.tsx          — "approve and pay" creates payout (recipient=employee)
client/src/pages/payroll.tsx           — bulk + per-row pay (separate audit, AUDIT_PAYROLL_2026_04_26.md)
       │
       ▼
server/routes/payouts.routes.ts        — 1054 lines, 9 endpoints
       │
       ▼ (request)        ▼ (approve)      ▼ (process)        ▼ (webhook)
       POST /payouts      POST /:id/approve POST /:id/process  webhookHandlers.ts
                          + dual-approval                        paystackWebhook.ts
       │                  │                │                    │
       ▼                  ▼                ▼                    ▼
       storage.createPayout  storage.updatePayout  storage.claimPayoutForProcessing
                                                  storage.atomicPayoutDebit
                                                  paymentService.initiateTransfer
                                                  storage.atomicPayoutCompensateOnFailure
```

| Endpoint | Middleware | What it does | Where money is touched |
|---|---|---|---|
| `POST /api/payouts` | **`requireAuth` only** | Creates a `pending` payout row | None at this stage |
| `POST /api/payouts/:id/approve` | `requireAuth + requireAdmin + requirePin` | Sets status `approved` (or `pending_second_approval` if amount ≥ `dualApprovalThreshold`) | None — approve does **not** debit |
| `POST /api/payouts/:id/process` | `requireAuth + requireAdmin + requirePin` | Claim → debit `company_balances` → external transfer → compensate-on-failure | Debit happens here |
| `POST /api/payouts/batch` | `requireAuth + requireAdmin + requirePin` | Same flow per-row, max 50 | Per-row debit |
| `POST /api/payouts/:id/cancel` | `requireAuth + requireAdmin` | Sets status `cancelled`, **credits recipient wallet if status was 'approved'** | Wallet credit (see AUD-DB-002) |
| `POST /api/payouts/:id/reject` | `requireAuth + requireAdmin` | Sets status `rejected` | None |
| `POST /api/payout-destinations` | `requireAuth` | Saves bank/Paystack/Stripe-Connect destination | None |
| Webhook `transfer.failed` (both providers) | Signature-verified | Compensating credit via `creditWallet` | Reverses processed transfers |

---

## 2. Findings

### AUD-DB-001 — `POST /api/payouts` is wide open: no admin gate, no PIN, no Zod, no companyId scoping

**Severity:** CRITICAL — fraud / queue poisoning / cross-tenant orphan creation.

**File:line:** `server/routes/payouts.routes.ts:273–324`

```ts
router.post("/payouts", requireAuth, async (req, res) => {
  try {
    const {
      type, amount, currency, recipientType, recipientId, recipientName,
      destinationId, relatedEntityType, relatedEntityId, initiatedBy
    } = req.body;
    ...
    const payout = await storage.createPayout({
      type,
      amount: amount.toString(),                         // ← unvalidated
      currency: currency || 'USD',
      status: 'pending',
      recipientType,                                     // ← unvalidated
      recipientId,                                       // ← unvalidated
      recipientName,
      destinationId,
      provider,
      relatedEntityType,
      relatedEntityId,
      initiatedBy: (req as any).user?.cognitoSub || initiatedBy,  // ← client fallback
    });
    res.status(201).json(payout);
```

What this lets any authenticated user do:
1. Post `amount: 4999, recipientType: 'employee', recipientId: <my_user_id>` — a `pending` row appears in the admin queue.
2. No `requireAdmin` → an **employee** (not just an admin) can create unlimited fraudulent payout requests.
3. No Zod validation → `amount` is whatever the client sends; the `.toString()` cast at line 306 will crash if `amount` is undefined, but anything truthy passes — including negative numbers, non-numeric strings (which become `"NaN"`), and exponential notation (`"1e9"`).
4. No `resolveUserCompany` / `verifyCompanyAccess` → the row is created **without `companyId`** (the code does not pass one). At `/process` time, line 509 catches this (`if (!payout.companyId) return 400`), so orphan rows can't be debited from `company_balances`. **But** they can still be **approved** (line 327 doesn't check companyId either) and **cancelled** (line 911 doesn't), which triggers AUD-DB-002.
5. `initiatedBy` falls back to the client-supplied `initiatedBy` field if `req.user?.cognitoSub` is somehow falsy. Audit-trail attribution can be forged in any flow that has both Cognito-sub absent and a body-supplied initiator (low-confidence — `requireAuth` should always populate the sub, but the code allows the trust-fall regardless).

**Verification:** read `payouts.routes.ts:273–324` directly. Confirmed no Zod schema, no admin/PIN middleware, no scoping.

**Impact:** queue-flooding + exploitation chain via AUD-DB-002 below. By itself this is HIGH; combined with AUD-DB-002 it's the precondition for unbounded money creation.

**Fix:**
```ts
const createPayoutSchema = z.object({
  type: z.enum(['expense_reimbursement', 'payroll', 'vendor_payment']),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  recipientType: z.enum(['employee', 'vendor', 'self']),
  recipientId: z.string().min(1),
  recipientName: z.string().min(1).max(120),
  destinationId: z.string().optional(),
  relatedEntityType: z.enum(['expense', 'payroll', 'invoice']).optional(),
  relatedEntityId: z.string().optional(),
});

router.post("/payouts", requireAuth, requireAdmin, async (req, res) => {
  const result = createPayoutSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ ... });

  const company = await resolveUserCompany(req);
  if (!company?.companyId) return res.status(403).json({ error: "Company context required" });

  const payout = await storage.createPayout({
    ...result.data,
    companyId: company.companyId,                         // ← server-issued
    initiatedBy: (req as any).user?.cognitoSub,           // ← never client
    status: 'pending',
  });
});
```

Note: this fix removes the body-supplied `initiatedBy` fallback entirely. Audit-trail integrity > backwards compat.

---

### AUD-DB-002 — `/api/payouts/:id/cancel` credits the recipient's wallet at status `approved`, but approve does **not** debit the company. Net result: ex-nihilo money creation.

**Severity:** CRITICAL — direct money-creation exploit.

**File:line:** `server/routes/payouts.routes.ts:911–1006`

```ts
router.post("/payouts/:id/cancel", requireAuth, requireAdmin, async (req, res) => {
  ...
  // If the payout was approved, the balance may have been debited — refund it
  let balanceRefunded = false;
  if (payout.status === 'approved' && payout.recipientType === 'employee' && payout.recipientId) {
    try {
      const recipientWallet = await storage.getWalletByUserId(payout.recipientId, payout.currency);
      if (recipientWallet) {
        await storage.creditWallet(
          recipientWallet.id,
          parseFloat(payout.amount),
          'payout_cancellation_refund',
          `Refund for cancelled payout: ${payout.id}`,
          ...
        );
        balanceRefunded = true;
      }
    } catch (refundErr: any) { ... }
  }
```

The comment is wrong. Reading `/payouts/:id/approve` (line 327–456) confirms it only updates `payouts.status` — it does **not** call `atomicPayoutDebit`. The debit happens **only** in `/payouts/:id/process` (line 535). At status `'approved'`, no debit has occurred yet. Crediting `recipientWallet` therefore creates money the company never paid out.

**Exploit chain (any admin):**
1. `POST /api/payouts` with `recipientType: 'employee', recipientId: <my_user_id>, amount: 4999, currency: 'USD'` → status `pending`. (Even an employee can do this — see AUD-DB-001 — but the cleanest chain uses an admin who can also approve.)
2. `POST /api/payouts/:id/approve` → status `approved`. Single-admin approval allowed because `4999 < dualApprovalThreshold (default 5000)`. Maker-checker self-approval check at line 348 only fires above threshold.
3. `POST /api/payouts/:id/cancel` → `recipientWallet.balance += 4999`. Status `cancelled`. Audit log written. Looks like a normal cancellation.
4. Withdraw the wallet through the wallet/withdraw flow. Real cash leaves the company's banking provider.

Repeat. There is no per-day limit on this path (see AUD-DB-007), no per-user limit, no detection in the audit log (cancel logs fire as expected because nothing in the system thinks it's wrong).

**Verification:** confirmed by reading `/approve` (line 327–456) and `/process` (line 478–697) — the only call to `atomicPayoutDebit` is at line 535 inside `/process`. `/approve` updates status only.

**Fix — narrow:** delete the wallet-credit branch entirely. A cancelled payout that was never processed has no debit to undo. If a payout is in flight (status `processing` or `paid`), cancel is already disallowed by the `cancellableStatuses` check (line 923). The `creditWallet` block is dead-code-with-side-effects.

**Fix — correct:** if the team wants cancel to also undo a debit (e.g. if a future change moves the debit earlier into `/approve`), the cancel handler must check whether the local debit-transaction row exists and call `atomicPayoutCompensateOnFailure(transactionId, companyId, amount, currency, reason)` against `company_balances` — not credit a recipient wallet. The recipient wallet should never receive money for a payout that did not leave the company's account.

---

### AUD-DB-003 — `/api/payouts/:id/cancel` and `/api/payouts/:id/reject` lack `requirePin`

**Severity:** HIGH — admin actions touching balances should be PIN-gated.

**File:line:** `server/routes/payouts.routes.ts:911`, `1010`

```ts
router.post("/payouts/:id/cancel", requireAuth, requireAdmin, async (req, res) => { ... });
router.post("/payouts/:id/reject", requireAuth, requireAdmin, async (req, res) => { ... });
```

The middleware stack on `/approve` and `/process` is `requireAuth + requireAdmin + requirePin`. The same financial-state-change endpoints downstream (`cancel`, `reject`) drop the PIN. A stolen / replayed admin session that lasts long enough to call `/approve` (PIN-gated) usually also has the PIN cached for the session window; but the broader threat model is: admin walks away from a logged-in laptop, an attacker triggers `/cancel` on a high-value queued payout. PIN should be a per-action gate on every endpoint that mutates payout state.

**Fix:** add `requirePin` to both routes. One line each.

---

### AUD-DB-004 — `stripe.payouts.create` is called without an idempotency key

**Severity:** HIGH — duplicate-transfer risk on retry.

**File:line:** `server/paymentService.ts:293–309`

```ts
const payout = await stripe.payouts.create({
  amount: Money.toMinor(amount),
  currency: currency.toLowerCase(),
  method: 'standard',
  description: reason,
  ...(destinationBankAccountId ? { destination: destinationBankAccountId } : {}),
  metadata: { ... },
});  // ← no second-arg options object → no idempotencyKey
```

Compare to `paymentIntents.create` at line 121, which uses `idempotencyKey: \`pi-${userEmail}-${currency}-${amount}-${Math.floor(Date.now() / 60000)}\``. The payouts variant — which is the surface that actually moves money out of the platform's Stripe balance — has none.

Real failure mode: the `await` at line 293 hits a transient TLS reset or 502 from Stripe's edge. Our code's `try/catch` (line 583 in payouts.routes.ts) interprets that as "transfer failed", runs `atomicPayoutCompensateOnFailure`, and marks the payout `failed`. But Stripe may have already created the payout server-side. Webhook arrives later → we may double-process, or we leave the user's Stripe payouts list with a paid item that our DB thinks is `failed`.

**Fix:** pass a stable idempotency key derived from our own payout ID:
```ts
const payout = await stripe.payouts.create({ ... }, { idempotencyKey: `payout-${ourPayoutId}` });
```
The payout ID is unique-by-construction (`storage.createPayout` is the only producer), making this a perfect idempotency token — far better than time-windowed keys.

---

### AUD-DB-005 — Paystack `initiateTransfer` has no idempotency parameter

**Severity:** HIGH — duplicate-transfer risk on retry (Paystack equivalent of AUD-DB-004).

**File:line:** `server/paystackClient.ts:346–354`, `server/paymentService.ts:173–181`

```ts
async initiateTransfer(amount: number, recipientCode: string, reason: string) {
  const amountInKobo = Math.round(amount * 100);
  return paystackRequest('/transfer', 'POST', {
    source: 'balance',
    amount: amountInKobo,
    recipient: recipientCode,
    reason,
  });  // ← no `reference` field
},
```

Paystack's `/transfer` endpoint accepts a `reference` string field; passing the same `reference` for a retry returns the original transfer object instead of creating a new one. Our implementation passes neither `reference` nor any other dedup hint. Same failure mode as AUD-DB-004 — network blip mid-call leaves us uncertain whether the transfer was created, our code path runs the compensating credit, and a successful transfer arrives via webhook later.

**Fix:** thread our payout ID through as `reference`:
```ts
async initiateTransfer(amount: number, recipientCode: string, reason: string, reference?: string) {
  const amountInKobo = Math.round(amount * 100);
  return paystackRequest('/transfer', 'POST', {
    source: 'balance',
    amount: amountInKobo,
    recipient: recipientCode,
    reason,
    ...(reference ? { reference } : {}),
  });
},
// caller in paymentService.ts:
await paystackClient.initiateTransfer(amount, recipientCode, reason, `payout-${ourPayoutId}`);
```

---

### AUD-DB-006 — Stripe Connect transfer idempotency key uses a 1-minute time window

**Severity:** MEDIUM — narrow retry window can produce duplicate transfers.

**File:line:** `server/paymentService.ts:219–227`

```ts
const transferIdempotencyKey = `txfr-${recipientDetails.stripeAccountId}-${amount}-${Math.floor(Date.now() / 60000)}`;
const transfer = await stripe.transfers.create({ ... }, { idempotencyKey: transferIdempotencyKey });
```

A retry that happens > 60 seconds after the first attempt produces a different key → Stripe creates a second transfer. 60 seconds is well within the timeout/retry window of common SDKs and load-balancer edges. Even using a 1-hour window would be a poor band-aid because the real fix is to **drop time entirely** and use a unique business identifier.

**Fix:** use `payout-${ourPayoutId}` as the key — same as the recommendation in AUD-DB-004. Plumb the payout ID through `paymentService.initiateTransfer` if it isn't already available there.

---

### AUD-DB-007 — No daily payout limit; the `getDailyTransferTotal` enforcement is on `/api/payment/transfer` only

**Severity:** HIGH — a successful AUD-DB-002 exploit has no rate ceiling.

**File:line:** `server/routes/payments.routes.ts:375` (where the limit IS enforced) versus `server/routes/payouts.routes.ts` (no calls anywhere).

```ts
// payments.routes.ts:375 — wallet/balance transfer flow
const dailyTotal = await storage.getDailyTransferTotal(userId, txCompany?.companyId);
// ... compare to settings.dailyTransferLimit, reject if exceeded
```

Search across `server/routes/payouts.routes.ts` returns zero `getDailyTransferTotal`, `dailyLimit`, `transferLimit`, or any per-period cap. The 50-payout cap on `/payouts/batch` (line 701) is the only volume limit on the entire surface, and it's per-request, not per-day.

Combined with AUD-DB-002, the exploit chain has no upper bound — an admin could generate, approve, cancel hundreds of fraudulent payouts in an hour and our system would never throttle.

**Fix:** wire `getDailyTransferTotal` (or a new `getDailyPayoutTotal`) into `/process`, `/batch`, and ideally the cancel-with-credit branch (which AUD-DB-002 recommends removing). Hard ceiling per company.

---

### AUD-DB-008 — `POST /api/payouts` no-companyId path means orphan rows in the queue

**Severity:** MEDIUM — operational + audit.

**File:line:** `server/routes/payouts.routes.ts:303–317`

The create path doesn't pass `companyId` to `storage.createPayout`. The `payouts.companyId` column is nullable. Result: rows with `null` companyId pile up and have to be hand-cleaned.

`/process` does fail-closed on missing companyId at line 509–510 (good), so these orphans can't move money. But:
- They can be `/approve`'d (line 327 doesn't check companyId)
- They can be `/cancel`'d → triggers AUD-DB-002's wallet credit
- They show up in any admin's queue regardless of tenant

**Fix:** part of the AUD-DB-001 fix. Server-issue `companyId` from `resolveUserCompany`; reject if absent.

---

### AUD-DB-009 — Maker-checker only triggers above `dualApprovalThreshold` (default 5000)

**Severity:** MEDIUM — single-admin self-approval below threshold.

**File:line:** `server/routes/payouts.routes.ts:343–354`

```ts
const dualApprovalThreshold = parseFloat((settings as any)?.dualApprovalThreshold?.toString() || '5000');

if (amount >= dualApprovalThreshold) {
  if (payout.initiatedBy === userId) {
    return res.status(403).json({ error: "High-value payouts require approval from a different admin (maker-checker policy)" });
  }
  // ... two-admin flow
}

// Below threshold: single approval — initiator can be approver
const updatedPayout = await storage.updatePayout(payout.id, {
  status: 'approved',
  approvedBy: userId,
});
```

Below threshold, `payout.initiatedBy === userId` is **not** checked. A single admin can create + approve their own payout below 5000. This is the precondition that makes the AUD-DB-002 exploit a one-person attack instead of a two-person collusion.

**Fix:** apply the maker-checker (initiator ≠ approver) at all amounts, not just above threshold. The dual-approval *requirement* can stay above-threshold; the *initiator-can't-approve-self* invariant is independent of amount and should be universal.

---

### AUD-DB-010 — Cancel-refund branch only handles employees; vendor/self payouts that did get debited have no compensation path on the cancel surface

**Severity:** LOW (but rises to HIGH if the team ever moves debit earlier into `/approve` without updating cancel)

**File:line:** `server/routes/payouts.routes.ts:935`

```ts
if (payout.status === 'approved' && payout.recipientType === 'employee' && payout.recipientId) {
  // credits employee wallet
}
```

Vendor / self / `recipientType === undefined` payouts never reach this branch. Today this is *coincidentally* safe because of AUD-DB-002 (the branch shouldn't exist at all), but if AUD-DB-002 is fixed by extending it to debit at approve time (rather than removing it), this path will silently drop vendor refunds.

**Fix:** along with the AUD-DB-002 fix (remove the wallet-credit branch entirely), also leave a TODO referencing `atomicPayoutCompensateOnFailure` for the case where future changes move the debit earlier.

---

### AUD-DB-011 — `paymentService.initiateTransfer` does not receive the payout ID for idempotency / observability

**Severity:** LOW — refactor needed for AUD-DB-004 / 005 / 006 fixes.

**File:line:** `server/paymentService.ts:146` signature, `server/routes/payouts.routes.ts:571–582` call site

```ts
// paymentService.ts:146
async initiateTransfer(amount: number, recipientDetails: any, countryCode: string, reason: string, metadata?: Record<string, unknown>)

// payouts.routes.ts:571
transferResult = await paymentService.initiateTransfer(
  parseFloat(payout.amount),
  { ... },
  countryCode,
  `Payout: ${payout.type} - ${payout.id}`
  // ← no metadata passed → idempotency-key recommendations above can't access payout.id
);
```

The signature has a `metadata` slot but the route doesn't use it. As a result, the idempotency-key fixes in AUD-DB-004 / 005 / 006 require either threading `payout.id` through, or moving the idempotency-key construction up into the route handler. Either is fine; pick one.

**Fix:** thread `metadata: { payoutId: payout.id, companyId: payout.companyId, userId }` into every `initiateTransfer` call site, then use `metadata.payoutId` to build idempotency keys inside `paymentService`. This also benefits the `indexProviderIntent` calls (lines 183, 231, 313) — they currently pass `metadata` from the parameter, so passing a real one populates the `payment_intent_index` rows with proper companyId/userId for webhook resolution.

---

## 3. Severity roll-up

| Severity | Count | Findings |
|---|---|---|
| CRITICAL | 2 | AUD-DB-001 (open create endpoint), AUD-DB-002 (cancel money-creation) |
| HIGH | 3 | AUD-DB-003 (no PIN on cancel/reject), AUD-DB-004 (Stripe payout no idem), AUD-DB-005 (Paystack no idem), AUD-DB-007 (no daily limit) |
| MEDIUM | 3 | AUD-DB-006 (1-min idem window), AUD-DB-008 (orphan queue rows), AUD-DB-009 (maker-checker below threshold) |
| LOW | 2 | AUD-DB-010 (vendor refund gap), AUD-DB-011 (metadata threading) |

The two CRITICAL findings are linked: **AUD-DB-001** is the way an attacker (or a careless admin) gets a `pending` payout into the queue with arbitrary `recipientId` and `amount`; **AUD-DB-002** is the way that pending payout gets converted into spendable wallet credit without a corresponding company debit. Either one, alone, is bad. Together, they form a one-admin money-creation primitive bounded only by the (missing) daily limit.

---

## 4. Recommended sequencing

**Sprint 1 (1–2 days, single PR closes the bleeding):**

1. **AUD-DB-002** — delete the `if (payout.status === 'approved' && ...) { creditWallet(...) }` block in `/cancel`. Add a defense-in-depth assertion that `cancellableStatuses` excludes any state where the company has been debited (which is already true; just document it).
2. **AUD-DB-001** — add Zod validation, `requireAdmin`, `resolveUserCompany`, server-issued `companyId`, drop the body `initiatedBy` fallback. Reject negative / NaN amounts.
3. **AUD-DB-003** — add `requirePin` to `/cancel` and `/reject`.
4. **AUD-DB-009** — apply initiator-cannot-approve-self at all amounts.
5. Add tests:
   - cancel of a status='approved' payout does **not** credit the recipient wallet (regression for AUD-DB-002)
   - non-admin POST `/api/payouts` returns 403 (regression for AUD-DB-001)
   - admin posting `{ amount: -100 }` returns 400
   - `/approve` from the same user as `initiatedBy` returns 403 even below threshold

**Sprint 2 (2–3 days, separate PR — idempotency + limits):**

6. **AUD-DB-004 / 005 / 006 / 011** — thread `payoutId` into `paymentService.initiateTransfer`, replace all idempotency keys with `payout-${id}`, add `reference` to Paystack call.
7. **AUD-DB-007** — wire `getDailyTransferTotal` (or new `getDailyPayoutTotal`) into `/process` and `/batch`. Hard ceiling per company.
8. Tests:
   - retry of `/process` more than 60s after a Stripe Connect transfer does not produce a duplicate transfer
   - exceeding `dailyPayoutLimit` returns 429 with the standard rate-limit shape

**Quarter:**

9. **AUD-DB-008** — migration to add `NOT NULL` on `payouts.companyId`, after a backfill pass and the AUD-DB-001 fix has been live long enough that no more nulls are being written.
10. **AUD-DB-010** — same code path as AUD-DB-002 fix; coverage extended to non-employee recipients with the documented compensation pattern (only relevant if approve-debit is reintroduced; otherwise leave as TODO).

---

## 5. What I did NOT verify

- The mobile app's payout creation surface (`mobile/src/screens/...`) — agent did not surface a specific screen, and I didn't search myself. If mobile calls `POST /api/payouts` directly the same AUD-DB-001 risk applies.
- The expense-reimbursement path that calls `POST /api/payouts` server-side in `expenses.routes.ts` (the `/expenses/:id/approve-and-pay` route I touched in PR #14). It probably **does** server-issue `companyId`, but I didn't read it again in this pass — worth a 5-minute confirmation that the AUD-DB-001 fix doesn't break that internal caller.
- Webhook resolution under the new `payment_intent_index` (LU-DD-2). The agent reported it works correctly via `resolveCompanyForWebhook`. I did not re-verify the Paystack path's mismatch handling under cross-tenant intent IDs; covered separately in `AUDIT_DEEP_DIVE_2026_04_26.md` §11.

---

## 6. Cross-references

- **AUDIT_PAYROLL_2026_04_26.md** — payroll module audit; same bug class (AUD-PR-001 / 002 / 003 are missing `verifyCompanyAccess`, structurally similar to AUD-DB-001's missing scoping).
- **LOGIC_UPGRADE_PROPOSALS.md / LU-DD-5** — the debit-first refactor that `/process` correctly adopts. Cancel + reject are the next surfaces that need the same hardening.
- **server/routes/payouts.routes.ts:478–697** (`/process`) — reference architecture for atomic claim → debit → external → compensate. Cancel should NOT be performing wallet credits; the only legitimate compensation path is `atomicPayoutCompensateOnFailure` against `company_balances`, which is already wired into `/process`'s failure branch.

---

## 7. One-paragraph executive summary

The disbursement surface has the right *bones* — `/process` does claim-then-debit-then-external-then-compensate, webhooks credit wallets back on failure, dual-approval kicks in above threshold. But the **request endpoint is wide open** (any user, any amount, any recipient, no Zod, no scoping), and the **cancel endpoint silently credits employee wallets when the company has not actually been debited**, on the mistaken comment-belief that approval implies debit. Together those two findings are a one-admin money-creation primitive with no daily-limit ceiling. Fix is small (one PR closes the two CRITICAL findings plus the three HIGH/MEDIUM controls around them) and the test cases are mechanical.
