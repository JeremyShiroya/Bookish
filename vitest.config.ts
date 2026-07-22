import { defineVitestConfig } from '@nuxt/test-utils/config'
import { configDefaults } from 'vitest/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    exclude: [...configDefaults.exclude, '**/.claude/worktrees/**'],
    // The 'nuxt' environment bootstraps a real Nuxt app in a beforeAll hook.
    // That legitimately takes longer than vitest's 10s default on a loaded
    // machine or a cold cache, and when it overruns the whole file reports as
    // a failure with no assertion ever running — which reads like a broken
    // test suite rather than a slow one. Only the setup hook is affected;
    // individual test timeouts are untouched.
    hookTimeout: 60000,
  }
})
