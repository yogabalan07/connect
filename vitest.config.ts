import { defineConfig } from 'vitest/config';

/**
 * Vitest runs in a plain node environment: the Phase 1 suites cover pure
 * routing/access decisions, the deny-by-default privacy filter and the mock
 * auth adapter, none of which need a DOM. React component tests (jsdom) are
 * intentionally deferred to a later phase.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
