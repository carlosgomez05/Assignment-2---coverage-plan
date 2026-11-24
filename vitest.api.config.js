import { defineConfig } from 'vitest/config';

// API tests run against a RUNNING server: set API_BASE_URL (default http://localhost:3000).
// Files run one at a time because tests share one in-memory server and some
// (availability, settings) temporarily change shared state, restoring it afterwards.
export default defineConfig({
  test: {
    include: ['tests/api/**/*.test.js'],
    fileParallelism: false,
    testTimeout: 15000,
    reporters: ['default', 'junit'],
    outputFile: { junit: 'test-results/api-junit.xml' },
  },
});
