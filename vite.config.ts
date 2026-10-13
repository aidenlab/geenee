import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'

// One build for the Worker (wrangler.toml) and the Workspace page (index.html),
// which the Worker serves as a static asset. CLOUDFLARE_ENV picks the
// environment of wrangler.toml that is built, and so deployed.
export default defineConfig({
  plugins: [cloudflare()],
})
