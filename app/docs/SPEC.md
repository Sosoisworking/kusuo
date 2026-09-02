# Kusuo — Specification

**The single source of truth for this project.** Written 30 August 2026 from a direct read of the code, after three conflicting specs had accumulated in the repo. Where any other document disagrees with this one, this one wins.

Superseded documents are in `docs/decisions/superseded/`, kept for their reasoning, not as instructions.

---

## What Kusuo is

A personal-growth app for one person: **Soso**. Habits and strength training in one place, with honest history and no gamification.

It is a PWA installed to the iPhone home screen. All data is local. There are no accounts, no server, and nothing is transmitted anywhere.

**One user.** Not two. See `docs/decisions/2026-08-30-couples-deferred.md` for the couples direction that was designed, decided against on the evidence, and parked.

## Current state — built and working

Sixteen commits, slices 0 through 11 plus the training data model (`902eeff`), all on `main` and deployed.

**Screens** (15): Onboarding, Today, Train, Session, Exercise detail, Splits, Split editor, Directory, Calendar, Records, Habit detail, Habit form, Goals, Reflection, Settings. Progress was retired once Calendar and Records absorbed what it showed; `/progress` redirects to Today.

**Goals** carry a title, an optional description and an optional target date. Reaching one (`completeGoal`) is distinct from putting it away (`archiveGoal`): only a goal actually reached appears in Records. Reflections are read back on the Calendar under the day they were written — a chosen day answers three questions in tabs, what you lifted, what you wrote and what you are working towards — and are listed in Records.

**Data** — Dexie/IndexedDB, database `kusuo`, schema at **version 9**. `src/db/tables.ts` is the one place that knows which tables exist: reset, backup and every test's setup ask it rather than keeping their own lists, so a table added to the schema joins all three by construction.

| Table | Shape |
|---|---|
| `habits` | mutable entity — name, description, category, frequencyType `daily`\|`weekly`, frequencyValue, isActive, timestamps |
| `habitEvents` | **append-only** — habitId, localDate, action `complete`\|`uncomplete`, timestamp, deviceId |
| `goals` | mutable entity |
| `reflections` | **append-only** — localDate, text, timestamp |
| `exercises` | name, category `push`\|`pull`\|`legs`\|`abs`\|`cardio`, muscleGroup, equipment, isCustom, optional `circuit` |
| `splits` | name, days `SplitDay[]`, seededFrom, isActive |
| `sessionEvents` | **append-only** — localDate, splitDayId, exerciseId, setIndex, weightKg, reps, rpe, action `log`\|`void`, deviceId. `localDate` is indexed and load-bearing: the calendar, the week strip and the training-habit tick are calendar-day questions, and re-deriving a day from a UTC instant is wrong across DST and travel. Do not remove it — `REDESIGN-PROMPT.md` omits it, and that omission is the error |
| `sessionMarks` | **append-only** — session complete/uncomplete per day |
| `settings` | deviceId PK, deviceRole `writer`\|`reader`, units, weekStart, theme, defaultSets, trainingHabitId, lastBackupAt. This row describes the phone, not the record: a backup never carries it, an import never replaces it, and logging out deletes it alone |
| `bodyweight` | **append-only** — localDate, weightKg, timestamp, deviceId |

State is **derived by replaying events**, last-event-wins. Never stored as a flag. `src/db/clock.ts` guarantees strictly ordered timestamps so replay is deterministic.

**Logic implemented:** `derive.ts` (completion by replay), `streaks.ts` (daily and weekly; `weeklyStreak` takes a `weekStart` and every call site now passes it, so the setting is live — `dailyStreak` takes none, because a daily run does not care where the week begins), `sessions.ts` (set replay, volume, training dates), `records.ts` (Epley 1RM, per-exercise records, best volume, best streak, best month), `reflection.ts`, `backup.ts` (JSON export/import at schema **version 5**, all-or-nothing in one transaction, refusing a file from a newer build, carrying the record's own preferences but never this device's identity, and asking every table — not only habit events — whether this device holds work newer than the file).

**Training already exists at the data and logic layer** — exercises, splits, seeded templates, set-by-set session events, derived records. Finishing a session writes a real `HabitEvent` against `settings.trainingHabitId`, so training ticks its habit once rather than in two places.

**Tests:** 453 across 30 files — CRUD, migrations, backup round-trip and hardening, streaks, records, session replay, and component and route tests for every screen. Thirteen Playwright paths run on WebKit at iPhone 13 size, covering what the component suite cannot: a real IndexedDB, a real service worker, real reloads, offline, and a real pointer drag.

**Palette in the code today:** **Nocturne**, shipped in slice I. `--color-bg #161826`, `--color-surface #232532`, `--color-text #e9e9ed`, `--color-accent #9184d9`, plus the neutral and accent ramps, in `src/styles/tokens.css`. The warm terracotta set is gone.

There is **no completion colour**. Nocturne carries no green and no red; a ticked habit is the accent arriving — `--color-complete-fill` (accent-800), `--color-complete-ring` (accent), `--color-complete-mark` (accent-200) — with the name stepped back to `--color-text-done` and struck through. The accent ring with no fill marks the habit that has a session queued.

Light theme is derived from the same OKLCH ramps rather than invented: ground `--color-neutral-100`, ink `--color-neutral-900`, accent `--color-accent-700` (the first step clearing 4.5:1 on a light ground). Its muted step is the **70%** mix, not 55% — the same percentage does not survive both grounds.

## What is in flight

A redesign, specified in `docs/REDESIGN-PROMPT.md`: six-tab navigation (Today, Train, Splits, Calendar, Records, Settings), the training module surfaced properly in the UI, and a move to the **Nocturne** palette — a deep indigo `#161826` ground with a blurple accent ramp (`--color-accent #9184d9`).

This is a **UI and navigation change**. The data model and logic underneath it are already built and do not change.

> **Note on the reference design.** `Kusuo Redesign.dc.html` is at the repository root — 274 KB, 30 phone frames. Its twenty custom properties were **not** inlined; they lived in `_ds/nocturne-3b49528c-ab2a-4dc7-aaad-a66924b76555/styles.css`, which was missing.
>
> **Resolved 31 August 2026.** That stylesheet was read out of the Claude Design project and its `:root` block copied to `docs/nocturne-tokens.css` — every token the canvas references. The remaining 213 lines of the source file are component classes for the design canvas's own deck and slide components; Kusuo builds its own components against the tokens, so they were deliberately not copied.
>
> `docs/nocturne-tokens-prompt.md` was the fallback for regenerating a palette. It is no longer needed and should not be used — the real values are now on disk.
>
> Do not reconstruct missing screens from inference and present them as the agreed design.

### Nocturne accessibility constraint — must be honoured

Full working in `docs/decisions/2026-08-31-nocturne-contrast-corrected.md`. The 30 August decision it supersedes was computed against the canvas frame colour rather than the real `--color-bg`, and its `--color-text-muted` fix must not be implemented.

`color-mix(in srgb, var(--color-text) 45%, transparent)` over the real ground `#161826` resolves to `#757680` — **3.91:1**. That is below the 4.5:1 WCAG AA threshold for normal-size text.

**The fix: use the 55% mix for small muted text** — `#8a8b93`, 5.19:1. The 50% mix clears 4.5:1 exactly, with no headroom; 55% is what the design system's own canvas already uses. **Do not add a `--color-text-muted` solid token** — the superseded decision called for one only because it was working against the wrong ground.

The 45% mix stays, but only for what it is genuinely valid for: hairlines, icon strokes, disabled states, and text at 24px or above. **It must not carry labels, meta text, or inactive tab labels** — those are small text and need 4.5:1.

`--color-accent` `#9184d9` measures **5.45:1** on the ground, so it passes AA as body text and needs no large-text exemption.

### The split is a weekly schedule

Decided 31 August 2026, replacing the cycle it shipped with.

`logic/nextSession.ts:dayForDate` maps a date to a split day: the split's first
day falls on the first day of the week, and today's date decides today's
session. A split shorter than seven days repeats inside the week, so a 3-day
push/pull/legs runs Mon-Tue-Wed and again Thu-Fri-Sat. The `weekStart` setting
decides which weekday is column zero.

**A missed session is missed.** It is not carried forward and it does not shift
everything after it — Wednesday shows Wednesday's work whether or not Tuesday
happened. Rest days are days in the schedule, so the Batman split rests on
Wednesday and Sunday.

## Rules that do not bend

1. **No gamification.** No trophies, badges, XP, levels, or targets. Records are facts, stated plainly.
2. **No composite scores.** No discipline score, no growth score.
3. **No rest timer, no notifications, no reminders.** Deliberate, repeatedly.
4. **No accounts, no server, no telemetry, no AI.** Local-first via IndexedDB. Export is the only copy that leaves the device. The onboarding screen promises this in as many words — breaking it breaks a promise already made to the user.
5. **Event-sourced and UUID-keyed** throughout, so a future multi-device merge stays a set union.
6. **Voice is factual.** No exclamation marks. Copy on a bad week is plain, never punitive and never falsely encouraging.
7. **44×44pt minimum tap targets**, safe-area aware, `100dvh` not `100vh`.
8. **Five-second open.** Today's habits and the next action visible immediately, never behind navigation.
9. **iPhone is the only writer.** `settings.deviceRole` already encodes this. No write UI on desktop — absent, not disabled.
10. **Every colour, size, radius and shadow from a `var(--*)` token.** No literals in components.

## Deployment

- Repo `https://github.com/Sosoisworking/kusuo`, public, branch `main`
- Live at `https://sosoisworking.github.io/kusuo/`
- Vite `base` and React Router `basename` are both `/kusuo/`
- GitHub Actions deploys on push to `main`

## Known gaps

- **No component or route tests.** All 15 test files are db/logic. The UI is unverified by anything but eye.
- The Nocturne tokens are now on disk (`docs/nocturne-tokens.css`); slice I ports them into `src/styles/tokens.css`.
- `app/PRODUCT.md` is Impeccable's own schema file, owned by that tool. It is consistent with this spec. Do not hand-edit it.
