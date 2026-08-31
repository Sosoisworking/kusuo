import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // vite-plugin-pwa's virtual module only exists inside a Vite build.
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/pwa-register-stub.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    // jsdom defaults to an opaque origin, where localStorage is undefined.
    // The app stores its deviceId there, so tests need a real origin.
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
