import { defineConfig } from 'vitest/config'

// The Connector is tested through its fetch handler with stand-in Upstreams, so
// the tests need no Worker runtime. Kept apart from vite.config.ts, whose
// Cloudflare plugin is for the dev server and the build.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
})
