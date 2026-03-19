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
    exclude: ['node_modules', 'dist', 'mobile'],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['server/**/*.ts', 'shared/**/*.ts', 'client/src/lib/**/*.ts'],
    },
  },
});
