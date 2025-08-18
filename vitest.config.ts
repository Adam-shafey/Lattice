import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run tests sequentially to avoid database conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Increase timeout for database operations
    testTimeout: 10000,
    // Disable parallel execution
    threads: false,
    setupFiles: ['src/tests/setup.ts'],
  },
});
