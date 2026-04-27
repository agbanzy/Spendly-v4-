import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'server/__tests__/**/*.test.ts',
      'shared/__tests__/**/*.test.ts',
      'client/src/__tests__/**/*.test.ts',
    ],
    // AUD-PR-009 — integration tests under server/__tests__/integration/
    // are gated to `npm run test:integration` (vitest.integration.config.ts)
    // so the default `npm test` stays Docker-free and fast.
    exclude: [
      'node_modules',
      'dist',
      'mobile',
      'server/__tests__/integration/**',
      '**/*.int.test.ts',
    ],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['server/**/*.ts', 'shared/**/*.ts', 'client/src/lib/**/*.ts'],
    },
  },
});
