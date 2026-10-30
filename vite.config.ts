import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig, type Plugin } from 'vite'

// The page review (pages.html) reloads when a source changes, since the pages it
// shows come from the Worker, whose changes Vite tells no browser about.
const reloadPageReview: Plugin = {
  name: 'reload-page-review',
  apply: 'serve',
  hotUpdate({ file }) {
    if (file.includes('/src/')) this.environment.hot.send({ type: 'custom', event: 'geenee:source-changed' })
  },
}

// One build for the Worker (wrangler.toml) and the Workspace page (index.html),
// which the Worker serves as a static asset. CLOUDFLARE_ENV picks the
// environment of wrangler.toml that is built, and so deployed.
export default defineConfig({
  plugins: [cloudflare(), reloadPageReview],
})
