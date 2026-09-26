# Kusuo

A personal growth app — habits, progress, reflection — built as an installable Progressive Web App.

Kusuo is local-first. All data lives on the device in IndexedDB. There is no server, no account, and no network dependency; the app works fully offline.

## Status

Shipped. Live at https://sosoisworking.github.io/kusuo/

Every push to `main` is deployed to GitHub Pages by `../.github/workflows/deploy.yml`, but only after the typecheck, lint, unit tests and end-to-end tests pass.

## Running it locally

Requires Node.js; CI uses Node 22. From this folder:

```bash
npm ci
npm run dev
```

The app is served under `/kusuo/`, matching the GitHub Pages path.

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm test` | Unit and component tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright). First run needs `npx playwright install webkit` |
| `npm run lint` | oxlint |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run preview` | Serve the production build |

## Documentation

- `PRODUCT.md` — what the app is for, who it is for, and what it deliberately leaves out.
- `docs/SPEC.md` — the specification, written from the code. Where another document disagrees with it, it wins.
- `docs/DESIGN_PROMPT.md` — the original build brief. Partially superseded; its own header says which parts still stand.
- `docs/legacy/` — product planning from earlier sessions. Valid as **product and data-model specification**. Its technical guidance is **obsolete**: it describes a native Android/Kotlin/Room app that was never carried forward. Read "Room" as "local database" and "Activity" as "screen"; ignore all Gradle, Kotlin, and APK instructions.

## Key decisions

- **Platform** — installable PWA on GitHub Pages, added to the iPhone home screen. Not a native app.
- **Data** — local-only, in IndexedDB. No backend, no account, no telemetry.
- **Devices** — the iPhone is the only device where data is entered. The Mac is read-only, for review. This means there is no sync merge and no conflict resolution anywhere in the codebase.
- **Backup** — JSON export/import is a v1 requirement, not a later addition. Browser storage on iOS can be evicted, so an export is the only durable copy of the data.

## Data ownership

Everything entered stays on the device. Nothing is transmitted anywhere. Export produces a plain JSON file the user controls; that file is the backup and the only route onto another device.
