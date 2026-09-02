import { expect, test, type Page } from '@playwright/test'

/**
 * What the app can do with no network.
 *
 * The unit suite cannot answer this at all: there is no service worker in
 * jsdom, no precache, and no second page load. These tests run against the
 * real generated `sw.js` under the real `/kusuo/` base.
 */

async function onboard(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: 'Set it up' }).click()
  await page.getByRole('button', { name: 'This is my iPhone' }).click()
  await page.getByRole('textbox').first().fill('Soso')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.getByRole('button', { name: 'Push / Pull / Legs 3 days' }).click()
}

function registrationCount(page: Page) {
  return page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)
}

async function precachedPaths(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const out: string[] = []
    for (const key of await caches.keys()) {
      const cache = await caches.open(key)
      for (const request of await cache.keys()) out.push(new URL(request.url).pathname)
    }
    return out
  })
}

test('the installed service worker precaches the whole shell under /kusuo/', async ({ page }) => {
  await onboard(page)
  // Settings is what registers the worker today — see the skipped test below.
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.waitForFunction(
    async () => Boolean((await navigator.serviceWorker.getRegistration())?.active),
    undefined,
    { timeout: 20_000 },
  )
  await expect.poll(() => precachedPaths(page), { timeout: 15_000 }).not.toEqual([])

  const paths = await precachedPaths(page)
  // Everything a cold offline launch needs: the document, the bundle, the
  // stylesheet — each under the Pages base, not the server root.
  expect(paths).toContain('/kusuo/index.html')
  expect(paths.some((p) => /^\/kusuo\/assets\/index-.*\.js$/.test(p))).toBe(true)
  expect(paths.some((p) => /^\/kusuo\/assets\/index-.*\.css$/.test(p))).toBe(true)
  expect(paths).toContain('/kusuo/manifest.webmanifest')

  // 404.html is GitHub's shim for a cold deep link. The worker answers
  // navigations itself, so precaching it would be bytes nothing can ask for.
  expect(paths).not.toContain('/kusuo/404.html')
})

test('the precached shell can answer a deep-link navigation on its own', async ({ page }) => {
  await onboard(page)
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.waitForFunction(
    async () => Boolean((await navigator.serviceWorker.getRegistration())?.active),
    undefined,
    { timeout: 20_000 },
  )
  await expect.poll(() => precachedPaths(page), { timeout: 15_000 }).not.toEqual([])

  // The generated worker sends every navigation to the precached document —
  // this is the route the whole deep-link fix rests on.
  const sw = await page.evaluate(() => fetch('/kusuo/sw.js').then((r) => r.text()))
  expect(sw).toContain('NavigationRoute')
  expect(sw).toContain('createHandlerBoundToURL("index.html")')

  // And that document is really in the cache, with the bundle it needs.
  const shell = await page.evaluate(async () => {
    const hit = await caches.match('/kusuo/index.html', { ignoreSearch: true })
    return hit ? await hit.text() : null
  })
  expect(shell).toContain('/kusuo/assets/index-')

  // Verified by hand against a genuinely dead origin on the build of
  // 2026-09-01: with the preview server killed, /kusuo/, /kusuo/records,
  // /kusuo/splits and /kusuo/settings all loaded, IndexedDB still read back
  // the seeded split, and no page error was raised. That is not automated
  // here because taking the origin down would take Playwright's own
  // webServer with it in CI.
  await page.goto('./records')
  await expect(page.getByRole('heading', { name: 'Records' })).toBeVisible()
})

/**
 * DEFECT (unfixed) — nothing registers the service worker until Settings is
 * opened, so a freshly installed app has no offline capability at all.
 *
 * `useRegisterSW()` is called from exactly one place, Settings.tsx:3, and a
 * React hook only runs when its component renders. vite-plugin-pwa therefore
 * injects no registration script of its own — `dist/index.html` contains no
 * `registerSW`, which is verifiable straight from a build.
 *
 * Measured on the build of 2026-09-01: onboard, then visit Train, Splits,
 * Calendar, Records and Today. `navigator.serviceWorker.getRegistrations()`
 * is `[]` and `caches.keys()` is `[]`. Stop the origin and reload and the
 * reload fails outright — "Could not connect to the server". Do the same after
 * opening Settings once and the shell, the deep links and IndexedDB all work.
 *
 * The failure scenario: Soso adds Kusuo to the home screen, logs habits and a
 * session for a week without ever opening Settings, then opens it on the Tube.
 * White screen — none of it was ever cached.
 *
 * Fixed: registration is injected at build time (vite.config.ts,
 * injectRegister: 'inline'), so the worker installs on load rather than on
 * first sight of Settings.
 */
test('the service worker installs on first launch, not only from Settings', async ({ page }) => {
  await onboard(page)
  for (const tab of ['Train', 'Splits', 'Calendar', 'Records', 'Today']) {
    await page.getByRole('link', { name: tab }).click()
  }
  await expect.poll(() => registrationCount(page), { timeout: 15_000 }).toBe(1)
  await expect.poll(() => precachedPaths(page), { timeout: 15_000 }).toContain('/kusuo/index.html')
})

/**
 * DEFECT (fixed) — "Check for updates" used to blame the tap when the network
 * was down.
 *
 * `handleCheckForUpdate` (Settings.tsx) wraps `registration.update()` in a
 * try/catch whose only message is "Couldn't check — give it another tap."
 * With the origin unreachable that promise rejects with
 * `TypeError: Script http://.../kusuo/sw.js load failed` — measured — so the
 * user is told to retry an action that cannot succeed until they have signal,
 * and is never told that is why.
 *
 * Fixed: the handler asks `navigator.onLine` before and after the fetch, and
 * says the connection is down instead of asking for another tap. Driven with
 * the browser context offline, which leaves Playwright's own webServer up.
 */
test('offline, the update check says the network is down', async ({ page }) => {
  await onboard(page)
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.context().setOffline(true)
  await page.getByRole('button', { name: 'Check for updates' }).click()
  await expect(page.getByRole('status')).toHaveText(/offline|no connection|network/i)
})
