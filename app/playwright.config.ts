import { defineConfig, devices } from '@playwright/test'

/**
 * One test, on a real browser engine, proving the thing that matters most:
 * data written on one page load is still there on the next. Everything else is
 * covered by the unit and component suites; this is the only check that
 * exercises a real IndexedDB, a real service worker and a real reload.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/kusuo/',
    trace: 'on-first-retry',
  },
  projects: [
    // iPhone-sized WebKit: the closest an automated run gets to the device this
    // app is actually used on.
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/kusuo/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
