import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Repo name for GitHub Pages project-site base path (https://<user>.github.io/<repo>/).
// Override with VITE_BASE_PATH if the repo is ever renamed.
const base = process.env.VITE_BASE_PATH ?? '/witchs-watchlist/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // generateSW (the default) has workbox-build write raw `import ... from '<abs-path>'`
      // strings into sw.js. This repo's folder name contains an apostrophe, which breaks
      // out of that string and fails the build. injectManifest instead bundles our own
      // src/sw.ts through Rollup, which quotes paths correctly, so it sidesteps the bug.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      includeAssets: ['icons/icon.svg', 'favicon.ico'],
      manifest: {
        // id must resolve within scope (it's resolved relative to the manifest
        // URL, not start_url) — leaving it as '/' pointed outside '/witchs-watchlist/'
        // and made Chromium browsers reject the full "install as app" flow,
        // silently falling back to a plain browser-tab shortcut instead.
        id: base,
        name: "The Witch's Watchlist",
        short_name: 'Watchlist',
        description: 'A personal anime tracker',
        theme_color: '#0f0a1a',
        background_color: '#0f0a1a',
        display: 'standalone',
        orientation: 'any',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
