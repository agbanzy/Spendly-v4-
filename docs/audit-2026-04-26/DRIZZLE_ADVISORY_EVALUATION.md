# Drizzle ORM Advisory Evaluation — GHSA-gpj5-g38j-94v9

**Date:** 2026-04-26
**Advisory:** [GHSA-gpj5-g38j-94v9](https://github.com/advisories/GHSA-gpj5-g38j-94v9)
**Title:** Drizzle ORM has SQL injection via improperly escaped SQL identifiers
**Affected:** `drizzle-orm < 0.45.2`
**Project version:** `drizzle-orm@^0.39.3` (current)
**Fix:** Bump to `0.45.2+` (major-version migration)
**This evaluation's verdict:** **Not exploitable in this codebase. Defer the upgrade.**

---

## Threat model

The advisory describes a class of bug where Drizzle's SQL identifier-escape logic could be bypassed when an untrusted string is used as an SQL **identifier** (table name, column name, schema name, etc.) rather than a **value** (parameter bound via `$1`, `$2`, etc.).

The exploit only fires when:

1. User-controlled data flows into a function that produces a dynamic SQL identifier, AND
2. The receiving Drizzle helper renders that identifier without quoting (or with naive quoting).

Drizzle's typed query builder is safe by default — column references like `users.email` are statically known. The risk is concentrated in `sql.raw()`, `sql.identifier()`, and template-literal interpolations that funnel user input into an identifier slot.

---

## Codebase audit

### Methodology

Grepped every dynamic-SQL helper invocation:

```
grep -rn 'sql\.\(raw\|identifier\|placeholder\|append\|join\)' server/ shared/ scripts/
```

Result: **10 callsites total**, all `sql.raw(...)`. No usage of `sql.identifier`, `sql.placeholder`, or other dynamic-identifier helpers.

### The 10 callsites — data flow analysis

| # | File:line | Pattern | Source | Verdict |
|---|---|---|---|---|
| 1 | `server/storage.ts:992` | `sql.raw(field)` inside `atomicCreditBalance(field: 'local' \| 'usd' \| 'escrow', ...)` | TypeScript literal-union type — compiler enforces at every callsite | ✅ Safe |
| 2 | `server/storage.ts:1001` | Same pattern, retry path of `atomicCreditBalance` | Same type pin | ✅ Safe |
| 3 | `server/storage.ts:1012` | Same pattern, legacy fallback in `atomicCreditBalance` | Same type pin | ✅ Safe |
| 4 | `server/storage.ts:1023` | `sql.raw(field)` inside `atomicDebitBalance(field: 'local' \| 'usd' \| 'escrow', ...)` | Same type pin | ✅ Safe |
| 5 | `server/storage.ts:1032` | Same pattern, legacy fallback in `atomicDebitBalance` | Same type pin | ✅ Safe |
| 6 | `server/storage.ts:2451` | `sql.raw(balanceField)` inside `atomicPayoutDebit` | `balanceField: 'usd' \| 'local'` — explicit literal-union type derived from `params.currency.toUpperCase() === 'USD' ? 'usd' : 'local'` | ✅ Safe |
| 7 | `server/storage.ts:2478` | Same `balanceField` in same method | Same | ✅ Safe |
| 8 | `server/storage.ts:2518` | `sql.raw(balanceField)` inside `atomicPayoutCompensateOnFailure` | Same literal-union derivation | ✅ Safe |
| 9 | `server/storage.ts:2533` | Same `balanceField` in same method | Same | ✅ Safe |
| 10 | `server/storage.ts:2687` | `sql.raw(\`TRUNCATE TABLE "${table}" CASCADE\`)` inside `purgeDatabase` | `table` iterated from a hardcoded server-side `allTables` array (line 2673-2680). The route accepts a `tablesToPreserve` argument, but it is only used as a FILTER (`allTables.filter(t => !tablesToPreserve.includes(t))`) — it cannot inject new table names into the loop. | ✅ Safe |

### Where user input *does* reach SQL

It reaches the *value* side of parameterised queries. Drizzle's parameter binding (the `${value}` interpolation in `sql\`...\`` template tags) is escape-safe by default — it produces `$N` placeholders bound through the pg driver. User input flows into:

- `WHERE id = ${userId}` — bound parameter
- `WHERE email = LOWER(${email})` — bound parameter
- All `eq(table.col, userInput)` — bound parameter
- All `db.update(...).set({ field: userInput })` — bound via column accessor

None of these flow user input into an identifier slot.

---

## Conclusion

The advisory is **not directly exploitable** in this codebase. Every dynamic-identifier callsite uses either:

1. A TypeScript literal-union parameter (compile-time enforced — the only allowed values are server-defined strings), or
2. An iteration over a hardcoded server-controlled array.

A user attempting to exploit GHSA-gpj5-g38j-94v9 against this application would need to first land a separate bug that smuggles their payload past the type system — at which point they have a more direct exploitation path than the advisory provides.

## Recommendation

**Defer the upgrade to a planned dev-time PR.** The risks of an unforced major-version migration (Drizzle 0.39 → 0.45 is a meaningful API jump — changes to query builder return shapes, schema definition idioms, etc.) outweigh the residual risk of carrying an advisory that does not match our usage pattern.

A follow-up PR should:

- Pin the upgrade scope (just `drizzle-orm` + `drizzle-zod` + `drizzle-kit` to compatible versions)
- Run `npm run check` after each batch of API migrations
- Validate against testcontainers Postgres (AUD-BE-005)
- Smoke-test every atomic operation (`atomicBillPayment`, `atomicCardFunding`, `atomicWalletTransfer`, `atomicReversal`, `atomicPayoutDebit`, `atomicPayoutCompensateOnFailure`)

## Acceptance criteria for closing this evaluation

- [x] Every `sql.raw` / `sql.identifier` site enumerated
- [x] Each site's input source traced to either a literal-union type or a hardcoded array
- [x] No user input reaches an identifier slot
- [x] Document committed to `docs/audit-2026-04-26/`
- [ ] (Future) drizzle-orm bumped to 0.45+ in a dedicated PR

## See also

- [`AUDIT_2026_04_26.md`](AUDIT_2026_04_26.md) — Sprint 1+2 audit
- [`AUDIT_DEEP_DIVE_2026_04_26.md`](AUDIT_DEEP_DIVE_2026_04_26.md) — deep-dive
- [`AUDIT_BILLS_FORMS_2026_04_26.md`](AUDIT_BILLS_FORMS_2026_04_26.md) — bills + forms
