import { defineConfig } from 'vitest/config';

// AUD-PR-009 — opt-in integration-test runner.
//
// Default `npm test` (vitest.config.ts is implicit) runs unit / contract
// tests only — fast, no Docker required. This config gates an
// integration suite that boots a real Postgres via @testcontainers,
// runs the project's migrations against it, and exercises the storage
// layer against actual SQL semantics. Slower (5–15s container boot)
// but catches the class of bugs unit-level mocks can't:
//
//   - Race conditions on UPDATE ... WHERE status='pending' RETURNING
//     (claim-pattern correctness — AUD-PR-006, AUD-DD-PAY-002)
//   - Foreign-key cascade behaviour (LU-DD-3 team_members → company_members)
//   - JSONB query semantics (tax_brackets, dailyPayoutLimits)
//
// Run via: `npm run test:integration`
// Requires: a running Docker daemon. CI integration is opt-in (see
// `server/__tests__/integration/README.md`).
export default defineConfig({
  test: {
    include: ['server/__tests__/integration/**/*.int.test.ts'],
    // Container startup is slow; 60s per-test timeout covers the worst
    // case (cold image pull + migration runs).
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Sequential execution — testcontainers boot is expensive; one
    // container per file is the default model.
    fileParallelism: false,
    pool: 'forks',
  },
});
