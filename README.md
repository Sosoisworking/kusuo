# Kusuo

Kusuo is a local-first personal growth app — a few daily habits and a set-by-set training log — installed to an iPhone home screen as a Progressive Web App.

**Status:** shipped. Live at https://sosoisworking.github.io/kusuo/

## Stack

React 19, TypeScript 6, Vite 8, Tailwind CSS 4, React Router 8, and Dexie 4 over IndexedDB for storage. `vite-plugin-pwa` provides the service worker that makes it installable and offline. Tested with Vitest 4, Testing Library and Playwright; linted with oxlint.

## How it ships

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Each stage runs only if the one before it passed:

1. **Verify** — install dependencies, typecheck, lint, run the unit tests, then run the end-to-end tests.
2. **Build** — typecheck again and produce the production bundle.
3. **Deploy** — publish the bundle to GitHub Pages.

## Tests

- **30 unit and component test files** under `app/src`, run by Vitest in jsdom.
- **4 Playwright end-to-end suites** under `app/e2e`, run in WebKit at iPhone 13 size — the closest an automated run gets to the phone the app is used on.

## What it leaves out

[`app/PRODUCT.md`](app/PRODUCT.md#why-these-are-absent) sets out what the app deliberately leaves out, and why.

## Running it locally

Requires Node.js; CI uses Node 22.

```bash
cd app
npm ci
npm run dev
```

The app is served under `/kusuo/`, matching the GitHub Pages path. `npm test` runs the unit tests and `npm run test:e2e` the end-to-end suites; the first end-to-end run needs `npx playwright install webkit`. See [`app/README.md`](app/README.md) for the full list of commands.
