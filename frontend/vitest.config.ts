import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      include: ['src/utils/**/*.ts', 'src/hooks/useErrorHandler.ts'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/__mocks__/**', 'node_modules'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
