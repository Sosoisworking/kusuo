import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// A short, sortable stamp of when this bundle was built. Shown in Settings so
// "Check for updates" can be trusted — an update button you cannot verify is
// worse than none.
const BUILD_ID = new Date().toISOString().slice(0, 16).replace('T', ' ')

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  base: '/kusuo/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      // Register on load, not on first sight of Settings.
      //
      // Settings owns the update prompt through `useRegisterSW`, and until now
      // it also owned the only call that put a service worker on the device at
      // all: an install whose owner never opened Settings had no offline app
      // and no cached shell, so every deep link paid a round trip to GitHub's
      // 404. For an app that has to work in airplane mode that is the wrong
      // default.
      //
      // 'inline' rather than 'script', because 'script' emits a registerSW.js
      // and a second request for four lines. What it injects is a bare
      // `navigator.serviceWorker.register` on the load event — it never
      // messages the worker, so it cannot skip waiting behind the prompt's
      // back. Registering the same script twice is idempotent, so Settings'
      // own registration still resolves to this one and still hears `waiting`.
      injectRegister: 'inline',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Kusuo',
        short_name: 'Kusuo',
        description: 'A quiet, local-first habit tracker.',
        start_url: '/kusuo/',
        scope: '/kusuo/',
        display: 'standalone',
        background_color: '#161826',
        theme_color: '#161826',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // 404.html is GitHub's answer for a URL the SW is not in control of.
        // Once the SW is installed it serves index.html for every navigation,
        // so a precached copy of the shim could never be reached — it would be
        // bytes on the phone that nothing can ever ask for.
        globIgnores: ['404.html'],
        // Stated rather than left to the default, because the whole deep-link
        // fix rests on it: an installed app must answer /kusuo/splits from the
        // precache instead of going to the network and finding a 404.
        navigateFallback: 'index.html',
      },
    }),
  ],
})
