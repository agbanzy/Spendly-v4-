# Country × Persona × Role Audit — 2026-05-17

**Scope:** cross-cutting audit of the 24 supported countries (17 Stripe + 7 Paystack per `shared/constants.ts:SUPPORTED_COUNTRIES`), 6 roles (`shared/schema.ts:UserRole` — OWNER / ADMIN / MANAGER / EDITOR / EMPLOYEE / VIEWER), 9 permissions (`shared/schema.ts:Permission`), and the 9 user personas the system distinguishes (super-admin, company-owner, company-admin, manager, editor, employee, viewer, vendor, public-payee).

**Lenses:** Architect, Security, Product, Adversary (per the `code-audit` skill, opt-in subset).

**Method:** two parallel Explore agents covered the four lenses; every CRITICAL / HIGH finding was independently re-read against source before being retained. Findings the agents surfaced but I could not verify are flagged "UNVERIFIED — needs human pass". Findings I was able to disprove are listed in §6 with the disproving evidence.

**Status of the deploy at audit time:** live at `https://financiar-tz8qc.ondigitalocean.app/api/health` (200, db ok). Cognito disabled at boot per the DO-only direction; protected endpoints return 401 (not 500 — middleware is loaded). Postgres on dev tier (ephemeral). The findings below are independent of those deployment-state choices.

---

## 1. Scope inventory (the surfaces this audit covers)

### Countries (24)

| Provider | Countries |
|---|---|
| **Stripe** (17) | US, CA, GB, DE, FR, ES, IT, NL, BE, AT, CH, SE, NO, DK, FI, IE, PT, AU |
| **Paystack** (7) | NG, GH, ZA, KE, EG, RW, CI |

Sole router: `shared/constants.ts:222 getPaymentProvider(countryCode)`. Defaults to `'stripe'` for unknown countries (logged via `AUD-DD-CTRY-003` per `server/paymentService.ts` — PR #16).

### Roles (6)

`OWNER` > `ADMIN` > `MANAGER` > `EDITOR` > `EMPLOYEE` > `VIEWER` (`shared/schema.ts:7–14`).

### Permissions (9)

`VIEW_TREASURY`, `MANAGE_TREASURY`, `CREATE_EXPENSE`, `APPROVE_EXPENSE`, `SETTLE_PAYMENT`, `MANAGE_CARDS`, `MANAGE_TEAM`, `VIEW_REPORTS`, `MANAGE_SETTINGS` (`shared/schema.ts:17–28`).

### Personas (9)

- **Super-admin** — `/admin/*` routes, session in `sessionStorage.adminUser`, gated by `AdminRoute` + `requireAdmin` middleware
- **Company owner** — `companyMembers.role = OWNER`, full control over one tenant
- **Company admin** — `companyMembers.role = ADMIN`, money-moving + team management
- **Manager** — operational approvals, no team management
- **Editor** — creates expenses, drafts invoices
- **Employee** — submits expenses, views own payslips
- **Viewer** — read-only on company surfaces they're invited to
- **Vendor** — not a logged-in user; receives payouts via `payoutDestinations` records
- **Public payee** — anonymous, pays an invoice via `/pay-invoice/:id`, no account

---

## 2. Persona × Permission matrix (current state from `getPermissionsForRole`)

| Permission | OWNER | ADMIN | MANAGER | EDITOR | EMPLOYEE | VIEWER |
|---|---|---|---|---|---|---|
| `VIEW_TREASURY` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `MANAGE_TREASURY` | ✓ | ✓ | — | — | — | — |
| `CREATE_EXPENSE` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `APPROVE_EXPENSE` | ✓ | ✓ | ✓ | — | — | — |
| `SETTLE_PAYMENT` | ✓ | ✓ | — | — | — | — |
| `MANAGE_CARDS` | ✓ | ✓ | — | — | — | — |
| `MANAGE_TEAM` | ✓ | ✓ | — | — | — | — |
| `VIEW_REPORTS` | ✓ | ✓ | ✓ | ✓ | — | — |
| `MANAGE_SETTINGS` | ✓ | ✓ | — | — | — | — |

Derived from `server/routes/team.routes.ts:getPermissionsForRole`. **OWNER and ADMIN are functionally identical at the permission level** — the only differentiator is whether the route layer specifically checks for `OWNER` (e.g., last-admin-guard) or treats `ADMIN_ROLES = {OWNER, ADMIN}` as a single bucket (the more common pattern in `server/middleware/auth.ts:34`).

---

## 3. Findings — Architect lens

### A-F-01: Six of 24 countries have tax brackets seeded; the rest fall through

**Severity:** HIGH **Persona:** company-admin, payroll manager **Countries affected:** 18 of 24 (CA, DE, FR, ES, IT, NL, BE, AT, CH, SE, NO, DK, FI, IE, PT, AU, EG, RW, CI)
**Files:** `migrations/0014_tax_brackets.sql`, `server/routes/payroll.routes.ts:36–168` (the legacy hardcoded switch is still there as fallback)
**Verified:** YES — the migration only seeds NG, GH, KE, ZA, US, GB.

**Problem:** PR #29 (AUD-PR-012) shipped a versioned `tax_brackets` table with country × effective-window slices and replaced the hardcoded `switch (countryCode)` with a generic engine. The seed migration loaded brackets for 6 countries. The other 18 countries either:
- Fall through to the legacy hardcoded switch's `default: tax = salary * 0.20` (20% flat — wrong for every jurisdiction)
- Or, if the new engine is called first, return zero tax (worse — looks like a working result)

**Impact:** Payroll tax estimates are wrong for 75% of supported countries. NG / GH / KE / ZA / US / GB users get accurate 2024-era brackets; CA / EU / AU / EG / RW / CI users get either a 20% flat or zero. Either is a compliance liability if any tenant actually relies on the number.

**Recommended fix:** seed brackets for the remaining 18 in a follow-up migration (`0015_tax_brackets_round2.sql`). Source: each country's tax authority (HMRC for GB done; KRA for KE done; need ARC for CA, BMF for DE, etc.). Quarter-scope work — not a single-sprint fix because validating brackets per country requires legal review.

### A-F-02: Multiple call sites duplicate country-routing logic outside `shared/constants.ts`

**Severity:** MEDIUM **Persona:** future maintainer
**Files:** `server/paymentService.ts:275–330` (inline `if (countryCode === 'US' || 'CA')` for ACH; `if (countryCode === 'GB')` for BACS; etc.), `shared/constants.ts:PREFERRED_BANKS` (only populated for NG and GH)
**Verified:** YES — confirmed by grep of `if (country` / `if (countryCode` across server/.

**Problem:** Country attributes are scattered: bank-detail format selection is inline in `paymentService.ts`, preferred-banks is only NG/GH in `constants.ts`, utility-provider lists are static per-country, KYC document type is in `PRIMARY_ID_BY_COUNTRY`. Adding a new country requires editing 4+ files.

**Recommended fix:** consolidate to a single `CountryProfile` object per country in `shared/constants.ts` with named fields (`bankDetailFormat`, `preferredBanks`, `utilityProviders`, `primaryId`, `taxBracketsKey`). Typed accessors expose them. Out-of-registry country fails loudly. M-effort refactor.

### A-F-03: `users` table is legacy but still queried by `requireAdmin` fallback

**Severity:** MEDIUM **Persona:** super-admin
**Files:** `server/middleware/auth.ts:339–346` (legacy path), `shared/schema.ts:228 @deprecated users table`
**Verified:** YES.

**Problem:** `requireAdmin` has two paths. When the `admin_per_company` feature flag is on, it reads `companyMembers.role`. When off, it falls back to `users.role` — but `users` is marked `@deprecated` in schema.ts and the comment says "auth moved to Cognito; user data lives in `userProfiles`". So the fallback queries a table the schema discourages new writes to.

If the flag is off in production (see §5 A-F-04 below for verification gap), the entire admin auth path goes through a deprecated table. Drift between `users` and `userProfiles` would corrupt admin checks silently.

**Recommended fix:** confirm `admin_per_company` is on in production (see A-F-04), then delete the legacy `users.role` fallback in `requireAdmin`. Drop `users` table in a deferred migration like the team_members drop.

---

## 4. Findings — Security lens

### S-F-01 (CRITICAL): `POST /team` lets any ADMIN grant OWNER role without hierarchy check

**Severity:** CRITICAL **Persona:** any ADMIN of any company **Countries:** all
**Files:** `server/routes/team.routes.ts:48–80`
**Verified:** YES — I read the route directly. `requireAdmin` gates entry (caller must be OWNER or ADMIN). The `role` from the request body is accepted without comparing it to the caller's role.

```ts
// server/routes/team.routes.ts:48–66
router.post("/team", requireAuth, requireAdmin, async (req, res) => {
  const result = teamMemberSchema.safeParse(req.body);
  ...
  const { name, email, role, department } = result.data;
  ...
  const assignedRole = role || 'EMPLOYEE';

  const member = await storage.createTeamMember({
    ...
    role: assignedRole as any,  // ← never validated against caller's role
```

**Attack chain:** an ADMIN of Tenant X opens `/team` → "Invite member" form → submits `email: their-second-account@example.com, role: 'OWNER'`. The new OWNER membership is created. They log in as the second account, kick out the original OWNER (last-admin guard at line 202–207 only blocks if it would leave zero admins, not zero OWNERs), and take over the tenant.

**Impact:** any ADMIN can promote anyone (themselves via a second account, or a collaborator) to OWNER. OWNERs can change billing, delete the company, see every record, change settings. Cross-tenant impact zero (the ADMIN can only escalate within their own tenant), but within-tenant impact is total.

**Recommended fix:** in `POST /team` and the PATCH equivalent, compare the requested role against the caller's role and refuse if `requested > caller`. The ordering is the same as listed in §1 (OWNER > ADMIN > MANAGER > EDITOR > EMPLOYEE > VIEWER). One-line guard:

```ts
const roleRank = { OWNER: 6, ADMIN: 5, MANAGER: 4, EDITOR: 3, EMPLOYEE: 2, VIEWER: 1 };
const callerRank = roleRank[callerRole as keyof typeof roleRank] ?? 0;
if ((roleRank[assignedRole as keyof typeof roleRank] ?? 0) > callerRank) {
  return res.status(403).json({ error: "Cannot assign a role higher than your own" });
}
```

**Effort:** S. Add the guard, add 2 regression tests (ADMIN→OWNER blocked, ADMIN→MANAGER allowed).

### S-F-02 (HIGH): `GET /invoices/:id` skips company verification when `company` resolution is nullable

**Severity:** HIGH (CRITICAL if there are any callers with no company context, MEDIUM otherwise) **Persona:** any authenticated user **Countries:** all
**Files:** `server/routes/invoices.routes.ts:436–460`
**Verified:** YES — I read the route.

```ts
// server/routes/invoices.routes.ts:436–445
router.get("/invoices/:id", requireAuth, async (req, res) => {
  const company = await resolveUserCompany(req);
  const invoice = await storage.getInvoice(param(req.params.id));
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  if (company && !await verifyCompanyAccess(invoice.companyId, company.companyId)) {
    return res.status(403).json({ error: "Access denied" });
  }
```

The `if (company && ...)` skip means: when `resolveUserCompany` returns null (no company context — e.g., user signed in but never joined a company; or admin acting outside a company), the access check is bypassed entirely. The same pattern was the AUD-PR-002 finding I shipped a fix for in payroll (PR #22) — that fix changed `if (company && ...)` to `if (!company?.companyId) return 403`. The invoices route still has the buggy old shape.

**Impact:** any authenticated request with no company context (or a request that can suppress company context — e.g. by clearing the `X-Company-Id` header) can read any invoice across all tenants by guessing UUIDs. UUIDs are 122-bit random so guessing is infeasible at random, but: an attacker who already knows an invoice ID from a leaked email/PDF can read its full record cross-tenant.

**Verified absent:** invoice IDs are `gen_random_uuid()` (`shared/schema.ts:480`), so the agent's "sequential enumeration" framing is wrong. The risk is targeted ID leakage, not bulk enumeration.

**Recommended fix:** mirror the payroll Sprint-1 pattern. Fail-closed:
```ts
const company = await resolveUserCompany(req);
if (!company?.companyId) return res.status(403).json({ error: "Company context required" });
const invoice = await storage.getInvoiceInCompany(param(req.params.id), company.companyId);
if (!invoice) return res.status(404).json({ error: "Invoice not found" });
```
Same shape needed for `GET /payments/:id`, `GET /transfers/:id`, and `DELETE /invoices/:id`. **Effort:** S per route; M total to sweep all id-fetch routes.

### S-F-03 (HIGH, UNVERIFIED): `requireAdmin` legacy path is global-role, not company-scoped

**Severity:** HIGH (CRITICAL if `admin_per_company` feature flag is off in production)
**Files:** `server/middleware/auth.ts:307–346`
**Verified:** YES that the two paths exist; UNVERIFIED what the prod flag value is.

```ts
// server/middleware/auth.ts:307–346 (simplified)
const perCompany = await isFeatureFlagOn('admin_per_company');
if (perCompany) {
  const active = await resolveActiveCompanyRole(...);
  if (!ADMIN_ROLES.has(active.role)) return 403;
} else {
  // legacy path
  if (adminUser && ADMIN_ROLES.has(adminUser.role)) { ... }
}
```

In the legacy path, the check is `ADMIN_ROLES.has(adminUser.role)` against the global `users.role`. There's no company scoping — so a user marked global ADMIN can pass `requireAdmin` for any tenant's endpoints (then route-level `verifyCompanyAccess` would catch reads / writes that are properly scoped; but routes that aren't scoped, like S-F-02 above, become cross-tenant exploitable).

**To verify in production:** `psql ... -c "SELECT name, value FROM system_settings WHERE name='admin_per_company';"`. If the row is missing or value is `false`, the legacy path is active and S-F-03 is **CRITICAL**.

**Recommended fix:** confirm `admin_per_company=true` in production (or force-on in code), then delete the legacy branch. Same migration as A-F-03 above.

### S-F-04 (HIGH): `GET / PATCH /settings` falls back to the legacy singleton when no company context resolves

**Severity:** HIGH **Persona:** any user without a company; also any attacker who can suppress company context
**Files:** `server/routes/settings.routes.ts:13–30, 32–68`
**Verified:** YES — file contains explicit "Fallback to legacy singleton for users without a company" and "Company not found, fall back to singleton" comments.

**Problem:** when `companyId` is missing or invalid, the route returns / mutates a global singleton settings row. Two bad things:
1. **Read leak:** an attacker without a company sees the platform's default settings (notification preferences, currency, locale defaults) — small leak, no PII.
2. **Write impact:** if `PATCH /settings` falls through to the singleton, anyone authenticated can mutate the platform-wide defaults for all future users without a company (e.g., set the default currency to an invalid code, breaking onboarding for everyone).

**Recommended fix:** remove the singleton fallback entirely. For onboarding (user has no company yet), the onboarding flow should create a draft company first, not depend on a global singleton. **Effort:** M (touches onboarding state machine).

### S-F-05 (MEDIUM): Bank-detail PII (account numbers, routing, IBAN, sort code, BSB) stored in plaintext

**Severity:** MEDIUM **Persona:** any party with DB access (incl. backup snapshots, read replicas)
**Files:** `shared/schema.ts:payoutDestinations` (`accountNumber`, `routingNumber`, `bankCode`, `swiftCode`, `accountName` as `text`)
**Verified:** YES — schema shows plain `text` columns, no encryption hooks at the storage layer.

**Problem:** payment-recipient bank details across all 24 supported countries land in `payout_destinations` as plain text. The Stripe Connect Phase 1 work (PR #36) addresses this prospectively for tenants who opt into Connect (then we hold only `acct_*` IDs) but the legacy path keeps storing the raw numbers. A DB breach exposes the full banking-credentials map for every recipient.

**Impact:** depends on what an attacker does with stolen account numbers — most countries have account-number-only attacks limited (TransferWise / ACH require the sender's bank also), but combined with name + email also in the row (`accountName`, employee `email` via FK joins), social engineering opens up. SOC 2 / PCI auditors will flag this.

**Recommended fix:** application-level field-level encryption on `accountNumber`, `routingNumber`, `iban`, `sortCode`, `bsbNumber`. AES-256-GCM with KMS-managed keys. Decrypt only at the moment of provider call (no logs, no API response containing decrypted value). **Effort:** L (migration to wrap existing rows + key management setup).

### S-F-06 (LOW, UNVERIFIED): Public `GET /public/invoices/:id` lacks rate limiting

**Severity:** LOW (because UUIDs prevent enumeration; HIGH would require sequential IDs)
**Files:** `server/routes/invoices.routes.ts:95–161`
**Verified:** UNVERIFIED — agent reported no rate limit; I didn't inspect the middleware chain to confirm.

**Problem:** if the route has no per-IP rate limit, a known-invoice-ID can be hammered for chargeback enumeration or DoS. Pure enumeration is infeasible (122-bit UUIDs), so the actual exploit surface is small. But the route does expose company name, amount, currency, payment-method config in the response, which is genuinely useful intel for the targeted-invoice attacker.

**Recommended fix:** add 10 req/min per IP rate limit + log all public-invoice fetches. **Effort:** S.

---

## 5. Findings — Product lens

### P-F-01 (MEDIUM): Currency formatting hardcodes `en-US` locale across all 24 countries

**Severity:** MEDIUM **Persona:** every user **Countries:** every non-US country
**Files:** `shared/constants.ts:formatCurrencyAmount` (UNVERIFIED location; agent reported lines 101–105); call sites across `client/src/pages/dashboard.tsx`, `invoices.tsx`, etc.

**Problem:** an NG user sees `₦1,000.00` formatted with US thousands separator (comma) and US decimal (period). A DE user sees `€1,000.00` instead of `1.000,00 €`. The Stripe-region EU countries (DE, FR, ES, IT, NL, BE, AT) all have different conventions that go untranslated.

**Impact:** UX polish primarily; small risk of misreading. Material for trust at investor-demo time.

**Recommended fix:** pass `locale` derived from `companies.country` or `users.country` through to `Intl.NumberFormat(locale, ...)`. **Effort:** S–M (refactor + i18n test pass).

### P-F-02 (MEDIUM): No `PermissionDeniedState` component — Viewer's attempts at admin routes return raw 403 toasts

**Severity:** MEDIUM **Persona:** VIEWER, EMPLOYEE
**Files:** UNVERIFIED — agent reported the absence; I did not confirm

**Problem:** when a Viewer attempts `/admin/payouts`, the route renders the page, the `requirePermission` middleware fires server-side and returns 403, the client's TanStack Query catches the error, and a generic toast displays. There's no contextual "You don't have permission — ask your owner for `MANAGE_TREASURY` access" message.

**Recommended fix:** add a `<PermissionDeniedState>` component that shows the required permission + a clean CTA. Wire it via an error boundary at the admin page level. **Effort:** S.

### P-F-03 (LOW): KYC document labels don't explain what each ID is per country

**Severity:** LOW **Persona:** new user during onboarding **Countries:** all
**Files:** `shared/constants.ts:PRIMARY_ID_BY_COUNTRY`, `client/src/pages/onboarding.tsx`

**Problem:** the onboarding form asks for "BVN" if NG, "SSN" if US, "NIN" if GB, etc. — but doesn't explain "this is your Bank Verification Number issued by the CBN" for a confused new user. Increases drop-off.

**Recommended fix:** extend `PRIMARY_ID_BY_COUNTRY` to `{ id, label, description, exampleFormat }` per country. Display description + format hint under the input. **Effort:** S.

---

## 6. Findings — Adversary lens (attack chains)

### AD-F-01: Primary chain — Self-promoting ADMIN takes over a tenant in <10 minutes

**Severity:** CRITICAL — bounded only by the in-tenant scope **Persona attacker starts as:** ADMIN of Tenant X **Country:** any
**Files:** `server/routes/team.routes.ts:48–80, 195–210`

**Step 1.** Attacker, currently ADMIN of Tenant X, opens `/team` in the web app. Clicks "Invite member".
**Step 2.** Submits form `email: attacker-second-account@example.com, role: 'OWNER', department: 'Finance'`. The route — guarded only by `requireAdmin` — accepts the request because `requireAdmin` passes any caller in `ADMIN_ROLES = {OWNER, ADMIN}`, and the role parameter is not validated against the caller's role.
**Step 3.** Attacker accepts the invite (via the email or directly via `/invite?token=...`), now logged in as OWNER of Tenant X.
**Step 4.** Goes to `/team`, finds the legitimate OWNER. The PATCH endpoint at line 195 has a last-admin guard (`wasAdminLevel` check at line 150) that prevents demoting if it would leave zero admins, but it doesn't prevent demoting one OWNER while another OWNER exists. Demotes the legitimate OWNER to VIEWER.
**Step 5.** Attacker now controls billing, settings, all payout destinations, all data. Cross-tenant blast radius is zero; in-tenant is total.

**Defense gap:** S-F-01 fix (universal role-hierarchy check on POST/PATCH team) closes the entire chain at step 2.

### AD-F-02: Secondary chains (briefer)

- **Targeted invoice exfiltration** — attacker who phishes one invoice link (any tenant) can replay the ID against `GET /invoices/:id` while logged in to any unrelated tenant whose user has no company context (S-F-02 + the `if (company && ...)` skip). UUIDs prevent bulk; one-by-one is feasible.
- **Cross-tenant admin route hit** — if `admin_per_company` is off in production (S-F-03 unverified), a user with `users.role = 'ADMIN'` from a previous tenant can pass `requireAdmin` for routes that don't independently verify company. The route-level `verifyCompanyAccess` on most modules limits the data leakage, but routes without it (e.g. `/admin/audit-logs` if not company-scoped — needs separate check) are exposed.
- **Singleton settings vandalism** — any authenticated user without a company can `PATCH /settings` with no `companyId` header → hits S-F-04 fallback → mutates the global singleton row. Could change platform-wide default currency to break onboarding for everyone.
- **Cognito-bypassed admin** — since Cognito is currently disabled at boot in DO, the `requireAdmin` middleware in dev-bypass mode is permissive. **In production this is a deliberate operator choice** (we documented it as a warning, not a vulnerability — the Cognito wiring is the next operator task). Listed here so it stays visible.
- **Public payee chargeback** — public-payee anonymous users on `/pay-invoice/:id` can pay with a refundable card then issue chargeback. This is a payment-processor concern more than a code concern; mitigation is the Stripe / Paystack dispute flow + 3DS, not our code.

---

## 7. Synthesis — Top 5 issues ranked by (Severity × Likelihood × Inverse-Effort)

| # | Finding | Severity | Likelihood | Effort | Why prioritise |
|---|---|---|---|---|---|
| 1 | **S-F-01** ADMIN can grant OWNER role | CRIT | High | S | One-line fix, closes AD-F-01 entirely. Take-the-pen item. |
| 2 | **S-F-02** Invoice IDOR via nullable company | HIGH | Med | S | Mirrors a Sprint-1 fix pattern already in payroll; mechanical. |
| 3 | **S-F-03** Confirm `admin_per_company` is on in prod | CRIT (if off) | Unknown | XS | Just a query. If on, no work. If off, set it and remove legacy path. |
| 4 | **S-F-04** Remove singleton settings fallback | HIGH | Med | M | Touches onboarding state machine; not mechanical but well-scoped. |
| 5 | **A-F-01** Seed tax brackets for remaining 18 countries | HIGH | High (any tenant outside the 6) | L | Each country's brackets need legal review; quarter-scope but worth budgeting. |

**Recommended sequencing**

- **This week:** items 1, 2, 3. All single-PR scope. The S-F-01 fix alone closes the most severe attack chain in this audit.
- **Next sprint:** item 4 (singleton fallback removal + onboarding refactor).
- **Quarter:** item 5 (tax bracket seed for 18 countries) and S-F-05 (field-level bank-detail encryption — non-trivial but is the right SOC-2 hardening).
- **Documentation:** A-F-03 (legacy `users` table) gets deleted via deferred migration in line with the existing `migrations-deferred/` pattern, gated on operator action after S-F-03 is confirmed.

---

## 8. What's **not** broken (negative findings — important for audit trail)

- **`POST /payouts/:id/process`** — payroll Sprint-1 fix (PR #22) properly scoped `getPayrollEntryInCompany`; the same shape applies to payouts. ✓
- **`POST /payouts` create** — Sprint-1 disbursement fix (PR #23) added `requireAdmin + requirePin + Zod + server-issued companyId + initiatedBy`. The money-creation primitive from AUDIT_DISBURSEMENT_2026_04_26.md AUD-DB-002 is closed. ✓
- **Stripe idempotency keys** — Sprint-2 (PR #25) made all Stripe + Paystack money-out calls idempotent on `payout-${payoutId}`. Retries no longer duplicate transfers. ✓
- **Stripe Connect activation gate** — PR #36 + #38 wire the per-company `useStripeConnect` flag. Defaults off; operator-controllable. ✓
- **Invoice IDs are random UUIDs** — `shared/schema.ts:480 gen_random_uuid()`. The agent's "sequential enumeration" framing is wrong; 122-bit entropy makes bulk enumeration infeasible. Only targeted-ID-leak applies (S-F-02). ✓
- **Webhook tenant resolution** — LU-DD-2 (`paymentIntentIndex` + `resolveCompanyForWebhook`) is in place across Stripe + Paystack handlers, with `account.updated` newly wired in PR #36. Webhooks no longer trust client-supplied `metadata.companyId`. ✓
- **TLS to DB** — `server/db.ts` `buildSslConfig` + `DATABASE_CA_CERT` binding is the right shape for both AWS RDS (default trust bundle) and DO Managed Postgres (CA-pinned). Dev-database fallback `DATABASE_TRUST_SELF_SIGNED` is explicit and gated. ✓

---

## 9. What this audit did **not** cover (out of scope or unverified)

- **Mobile app surface** (`mobile/`) — same RBAC concerns presumably apply; not inspected here.
- **CodeRabbit comments on the 21 merged PRs** — not re-read for residual issues.
- **F-26 from the Adversary agent** (payroll bank-account redirect via `PATCH /payroll/account`) — **dismissed**: that route doesn't exist; the agent hallucinated it. Real payroll bank-detail updates go through `payout_destinations` which has its own (correctly-gated) route.
- **F-01 / F-11 from the Security agent** (sequential invoice ID enumeration) — **dismissed**: invoices use UUIDv4, not sequential. The valid concern is captured as S-F-06 (no rate limit on the public endpoint), not as enumeration.
- **F-13** KYC enforcement on high-value transactions — UNVERIFIED, surfaced as a follow-up: there's no `requireKyc` middleware anywhere in the codebase. Whether high-value transfers should require KYC verification per country is a product + compliance decision. Flagged for a separate audit pass.
- **F-19 / F-20** `admin_per_company` rollout state and bank-detail encryption — partially covered in §4 (S-F-03, S-F-05). Production-state verification is a single SQL query that I left to the operator.
- **Country × specific permission deep-dive** — this audit covered the surfaces. A per-country / per-route compliance matrix (NDPA for NG, GDPR for EU, POPIA for ZA, CCPA for US, etc.) is a separate compliance project.

---

## 10. One-paragraph executive summary

The 24-country / 6-role / 9-persona surface is **architecturally sound but has three mechanical gaps that compound into a real in-tenant takeover chain.** The most severe — an ADMIN can grant OWNER role via `POST /team` without hierarchy check (S-F-01) — is a one-line fix that closes the audit's primary attack chain (AD-F-01) end-to-end. The next two priorities are the same pattern: a nullable-company-context bypass on `GET /invoices/:id` (S-F-02, mirrors the payroll Sprint-1 fix already shipped) and confirming the `admin_per_company` feature flag is on in production (S-F-03 — single SQL query). The 24-country tax-bracket gap (A-F-01, 18 countries with no seeded brackets) is the only finding that requires real legal-review work; everything else is mechanical and shippable inside a sprint. Nothing in this audit invalidates the audit work already shipped in PRs #20–#39; it just surfaces the next layer.
