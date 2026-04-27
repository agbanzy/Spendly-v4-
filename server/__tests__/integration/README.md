# Integration tests (testcontainers Postgres)

These tests boot a real Postgres via `@testcontainers/postgresql`, run
the project's migrations against it, and exercise the storage layer
against actual SQL semantics. They cover the failure modes mocks can't:
race conditions on `UPDATE ... WHERE status='pending' RETURNING`,
foreign-key cascade behaviour, JSONB query semantics.

Tracked under audit finding **AUD-PR-009 rest** (full route-level
integration tests), shipping incrementally. Each integration test file
should target a high-risk surface — atomic claim helpers, debit /
compensate flows, multi-tenant scoping — not exhaustive coverage of
every storage method.

## Running locally

```bash
npm run test:integration
```

Requires a running Docker daemon. The first run pulls the
`postgres:16-alpine` image (~50MB); subsequent runs reuse it.

### Troubleshooting: malformed `~/.docker/config.json`

`testcontainers` reads the user's Docker auth config to fetch private
images. If the JSON in `~/.docker/config.json` is malformed (missing
`}`, dangling commas, etc.) the test boot crashes with:

```
SyntaxError: Expected ',' or '}' after property value in JSON at position N
 ❯ parseDockerConfig node_modules/testcontainers/...
```

Fix: open `~/.docker/config.json`, run it through `jq .` or any JSON
validator, repair the syntax. The Postgres image used here is public
on Docker Hub, so an empty `{}` is a fine fallback.

Per test file:
- Cold start: ~5–10s (container boot + migrations)
- Warm test execution: as fast as unit tests once container is up

## Running in CI

The default `npm test` job in `.github/workflows/deploy.yml` does NOT
run integration tests — they require Docker-in-Docker which adds
runtime cost on every PR. To enable:

1. Add a separate workflow file `.github/workflows/integration.yml`
   that runs `npm run test:integration` on a self-hosted runner or
   GitHub-hosted ubuntu-latest (which has Docker pre-installed).
2. Either run on a schedule (nightly) or as a separate PR check that
   doesn't block merge but flags regressions.

The GitHub-hosted ubuntu-latest runner has Docker available out of
the box — `services: postgres:` is one path, but for testcontainers
the daemon socket access works without extra config.

## Conventions

### File naming
- `*.int.test.ts` — integration test files. The vitest config glob
  `server/__tests__/integration/**/*.int.test.ts` only picks these up.
  Unit/contract tests in `server/__tests__/lib/*.test.ts` are
  unaffected.

### Lifecycle
- One container per file (vitest `fileParallelism: false`).
- Use `beforeAll` to boot the container + apply migrations.
- Use `afterAll` to stop the container.
- Use `beforeEach` to reset DB state via `TRUNCATE` (cheaper than
  rebooting the container).

### Migrations
- The setup helper applies `migrations/*.sql` in order, mirroring the
  production `scripts/run-migration.cjs` runner. `migrations-deferred/`
  is intentionally skipped (the runner skips it too).

## Current contents

- **`atomic-claim.int.test.ts`** — proves the `UPDATE ... WHERE
  status='pending' RETURNING` claim-pattern is race-safe under real
  concurrent transactions. Covers `claimPayoutForProcessing`
  (LU-DD-5) and `claimPayrollEntryForProcessing` (AUD-PR-006).
