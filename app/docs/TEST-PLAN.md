# Kusuo — Test Coverage Plan

Written 30 August 2026. Companion to `SPEC.md`.

## The stance

Kusuo has 15 test files and all of them cover `db/`, `lib/` and `logic/`. Nothing covers the UI. The obvious response — write component tests for the eight screens — is **the wrong first move**, and this plan deliberately does not do it.

Two reasons.

**The screens are about to be replaced.** The six-tab redesign in `REDESIGN-PROMPT.md` rewrites navigation and most of the UI. Component tests written against `Today.tsx` today are thrown away in a fortnight.

**Broken markup is not the real risk here.** Soso opens this app daily and will notice a button that does nothing within seconds. What he will *never* notice is a streak function that miscounts one week in nine, or a migration that drops a field, or an export that silently omits a table. This is an event-sourced app with derived state and no server: **the failure mode that matters is quiet data corruption in history he cannot audit.**

So the plan is ordered by consequence, not by coverage percentage. Tests that survive the redesign come first; tests coupled to markup come last, and get written as part of the redesign rather than before it.

## Priority order

| Tier | What | Why now | Effort |
|---|---|---|---|
| 0 | Infrastructure | Nothing below works without it | 1 evening |
| 1 | Data-integrity invariants | Silent corruption is the only unrecoverable failure | 2 evenings |
| 2 | Behaviour tests through routes | Survive the redesign; catch real regressions | 2 evenings |
| 3 | Accessibility and token guards | Prevents the Nocturne contrast bug recurring | 1 evening |
| 4 | End-to-end journeys | Proves the PWA actually works installed | 1 evening |
| 5 | Component tests | Written per redesign slice, not up front | ongoing |

---

## Tier 0 — Infrastructure

### Verify JSX actually transforms in tests

`vitest.config.ts` is standalone and does not include `@vitejs/plugin-react`. Component tests may still work through esbuild and `tsconfig`'s `jsx: react-jsx`, but this is unverified and is exactly the kind of thing that wastes an evening. **Confirm it before writing any component test**, and if it fails, merge the Vite config rather than duplicating it:

```ts
// vitest.config.ts
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.*', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
}))
```

### Add what is missing

```bash
npm i -D @vitest/coverage-v8 vitest-axe
```

Scripts:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage",
"test:e2e": "playwright test"
```

### A render helper

Every route test needs the router and a clean database. One helper, used everywhere:

```ts
// src/test/renderRoute.tsx
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import userEvent from '@testing-library/user-event'
import { db } from '../db/schema'

export async function resetDb() {
  await db.delete()
  await db.open()
}

export function renderRoute(ui: React.ReactNode, { route = '/' } = {}) {
  return {
    user: userEvent.setup(),
    ...render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>),
  }
}
```

Note `@testing-library/user-event` is not currently installed — add it. `fireEvent` is not an adequate substitute for testing a tap-driven interface.

---

## Tier 1 — Data-integrity invariants

The highest-value tests in this codebase. These are **properties that must hold for any input**, not examples.

### 1.1 Replay determinism

The core claim of the architecture is that state is a pure function of the event log. Assert it.

```ts
// src/logic/replay.invariants.test.ts
it('derives the same state regardless of event insertion order', async () => {
  const events = makeEvents(200)            // complete/uncomplete, random dates
  const a = await deriveAfterInserting(events)
  const b = await deriveAfterInserting(shuffle(events))
  expect(a).toEqual(b)                       // ordering is by timestamp, not insertion
})

it('never loses an event — count in equals count out', async () => { … })

it('last-event-wins holds for same-day complete/uncomplete pairs', async () => { … })
```

Generate the event sets programmatically. Two hundred randomised events find ordering bugs that six hand-written cases never will.

### 1.2 Monotonic clock

`src/db/clock.ts` guarantees ordered timestamps and the entire replay model rests on it. Test it directly: rapid successive calls are strictly increasing, and remain so across a simulated system-clock jump backwards. If this fails, everything above it silently breaks.

### 1.3 Migration, with real fixtures

`migration.test.ts` exists — extend it. Commit a **frozen JSON fixture of a v1 database** and a v2 one under `src/test/fixtures/`, and assert that opening at v3 preserves every habit, every event, and every settings field. Not synthesised at test time: a real captured shape. This is the test that catches the migration that quietly drops a column.

Add a new fixture at every schema version bump. The redesign will bump to v4.

### 1.4 Backup round-trip, fuzzed

`buildBackup → serializeBackup → parseBackup → importBackup` must be lossless for any database state. Generate 50 randomised databases — empty, one habit, archived habits, habits with unicode and 200-character names, thousands of events, voided sets — and assert deep equality after the round-trip.

Then the failure cases, which matter as much: truncated JSON, a wrong `schemaVersion`, a missing table, a future version. Each must throw `InvalidBackupError` and **leave the existing database untouched**. A half-applied import is the worst outcome in the app.

### 1.5 Streaks against a hand-checked table

Streaks are where habit apps are wrong and nobody notices. Build one table of cases with the expected answer worked out by hand, and drive it with `it.each`:

- daily: unbroken, one gap, gap at today, gap yesterday, completed then uncompleted
- weekly `4×/week`: 4 of 4, 3 of 4, 5 of 4, week boundary with `weekStart: 'monday'` and `'sunday'`
- a habit created mid-week
- an archived habit
- DST transition days — **use a real DST date**, this is a genuine source of off-by-one
- the day-rollover boundary: an event at 23:59 and one at 00:01

### 1.6 Records

Epley 1RM against known values. Ties in "heaviest set" resolve deterministically. Voided sets (`action: 'void'`) are excluded from every derived record — easy to get wrong, invisible when wrong.

---

## Tier 2 — Behaviour through routes

These assert *what the app does*, not what it renders. Query by accessible role and name, never by class or test id, so they survive the redesign.

Priority journeys:

1. **Tick a habit, reload, still ticked.** The core loop. Render Today, complete a habit, tear down, re-render from the same database, assert state persisted.
2. **Untick.** Complete then uncomplete, assert both the UI and that two events exist in the log — the second must not delete the first.
3. **Create a habit** through the form and assert it appears on Today with the right frequency.
4. **Archive a habit** — leaves Today, keeps its history on the detail screen.
5. **Log a training session** — sets recorded, and the `trainingHabitId` habit ticks exactly once. This bridge is the most likely place for a double-tick bug.
6. **Export then import into an empty database** — the app comes back identical.
7. **Onboarding** completes and sets `onboardingComplete`, and cannot be re-entered afterwards.

### Reader-role guard

`settings.deviceRole` is `'writer' | 'reader'`. Assert that under `'reader'` **no route renders a control that writes** — not disabled, absent. Currently unenforced by anything.

---

## Tier 3 — Accessibility and token guards

### Automated contrast, so the Nocturne bug cannot recur

The 45%-alpha finding in `decisions/2026-08-30-nocturne-contrast.md` was caught by hand. Encode it so it cannot come back:

```ts
// src/styles/tokens.contrast.test.ts
import { contrastRatio, mixOver } from '../test/color'

const BG = '#05050c'

it.each([
  ['--color-text',        '#eaeaf2', 4.5],
  ['--color-text-muted',  '#76767f', 4.5],   // solid, not a mix
  ['--color-accent',      '#9184d9', 3.0],   // interactive, non-text
])('%s meets its minimum on the ground', (_name, hex, min) => {
  expect(contrastRatio(hex, BG)).toBeGreaterThanOrEqual(min)
})

it('the 45% alpha step is not used for small text', () => {
  // documents the constraint: this value is valid only for ≥24px text and non-text UI
  expect(contrastRatio(mixOver('#eaeaf2', 0.45, BG), BG)).toBeLessThan(4.5)
})
```

Write `contrastRatio` from the WCAG formula — about fifteen lines, no dependency, and it becomes a permanent guard on every future palette change.

### Axe on every route

`vitest-axe` over each rendered route, asserting no violations. Catches missing labels, unlabelled icon buttons and heading-order breaks automatically, which is most of what goes wrong in a hand-built UI.

### Tap targets

The 44×44pt rule in `SPEC.md` is currently enforced by nothing. A test that walks rendered interactive elements and asserts computed minimum size is imperfect under jsdom — better handled in Playwright (Tier 4) where real layout exists.

---

## Tier 4 — End-to-end

Playwright is installed but has no config and no tests. Four journeys, run against the production build at iPhone viewport:

```ts
// playwright.config.ts — projects: [{ ...devices['iPhone 15'] }]
// webServer: { command: 'npm run build && npm run preview', port: 4173 }
```

1. **First run** — onboarding through to a populated Today screen.
2. **The daily loop** — open, tick every habit, hard reload, still ticked.
3. **Offline** — load, go offline via `context.setOffline(true)`, reload, app still works and data is intact. This is the whole promise of the PWA and nothing currently verifies it.
4. **Install metadata** — manifest served, service worker registers, icons resolve at the `/kusuo/` base path. The base-path failure mode is the one that has bitten this project before.

Add a real tap-target assertion here, where layout is genuine.

---

## Tier 5 — Component tests

**Write these as part of each redesign slice, never before it.**

Only two components today are durable enough to test now: `Button.tsx` and `TabNav.tsx` — variants, disabled state, active tab, keyboard focus visibility. Everything else waits for its redesigned form.

Rule for the redesign: a slice is not done until its screen has one behaviour test and one axe assertion. That keeps coverage growing with the UI instead of being retrofitted onto it later, which never happens.

---

## CI

Extend the existing GitHub Actions workflow. Unit tests and lint on every push; e2e too, since the suite is four tests and costs a minute.

```yaml
- run: npm ci
- run: npm run lint
- run: npm run test:coverage
- run: npx playwright install --with-deps chromium
- run: npm run test:e2e
```

## Targets

Coverage percentage is a poor goal and a worse gate. Use these instead, and treat them as floors:

| Area | Floor | Rationale |
|---|---|---|
| `src/logic/` | 95% | Pure functions, no excuse |
| `src/db/` | 90% | Migrations and backup are unrecoverable when wrong |
| `src/lib/` | 90% | Date and units maths |
| `src/components/`, `src/pages/` | no number | Judged by journeys covered, not lines |

The honest measure is the Tier 2 journey list. Every one green means the app works.

## Suggested order

1. Tier 0 — half an evening, unblocks everything
2. Tier 1.1 and 1.2 — replay determinism and the clock, the foundation everything rests on
3. Tier 1.4 — backup round-trip; makes every later mistake recoverable
4. Tier 2 journeys 1, 2 and 5 — the core loop and the training bridge
5. Tier 3 contrast test — before the Nocturne migration lands, not after
6. Tier 1.3, 1.5, 1.6 — migration fixtures, streaks, records
7. Tier 4 — e2e, once the redesign settles
8. Tier 5 — continuously, with each slice
