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

**Screens** (8): Onboarding, Today, Progress, Habit detail, Habit form (new/edit), Goals, Reflection, Settings.

**Data** — Dexie/IndexedDB, database `kusuo`, schema at **version 3**:

| Table | Shape |
|---|---|
| `habits` | mutable entity — name, description, category, frequencyType `daily`\|`weekly`, frequencyValue, isActive, timestamps |
| `habitEvents` | **append-only** — habitId, localDate, action `complete`\|`uncomplete`, timestamp, deviceId |
| `goals` | mutable entity |
| `reflections` | **append-only** — localDate, text, timestamp |
| `exercises` | name, category `push`\|`pull`\|`legs`\|`abs`, muscleGroup, equipment, isCustom |
| `splits` | name, days `SplitDay[]`, seededFrom, isActive |
| `sessionEvents` | **append-only** — localDate, splitDayId, exerciseId, setIndex, weightKg, reps, rpe, action `log`\|`void`, deviceId. `localDate` is indexed and load-bearing: the calendar, the week strip and the training-habit tick are calendar-day questions, and re-deriving a day from a UTC instant is wrong across DST and travel. Do not remove it — `REDESIGN-PROMPT.md` omits it, and that omission is the error |
| `sessionMarks` | **append-only** — session complete/uncomplete per day |
| `settings` | deviceId PK, deviceRole `writer`\|`reader`, units, weekStart, theme, trainingHabitId, lastBackupAt |

State is **derived by replaying events**, last-event-wins. Never stored as a flag. `src/db/clock.ts` guarantees strictly ordered timestamps so replay is deterministic.

**Logic implemented:** `derive.ts` (completion by replay), `streaks.ts` (daily and weekly; takes a `weekStart`, but defaults to `monday` and **no UI call site passes it yet** — `Today.tsx`, `Progress.tsx` and `HabitDetail.tsx` all omit the argument, so the setting is inert until a later slice threads it), `sessions.ts` (set replay, volume, training dates), `records.ts` (Epley 1RM, per-exercise records, best volume, best streak, best month), `reflection.ts`, `backup.ts` (real JSON export/import with validation and reverse-import detection).

**Training already exists at the data and logic layer** — exercises, splits, seeded templates, set-by-set session events, derived records. Finishing a session writes a real `HabitEvent` against `settings.trainingHabitId`, so training ticks its habit once rather than in two places.

**Tests:** 15 files across `db/`, `lib/`, `logic/` — CRUD, v1→v3 migration, backup round-trip, streaks, records, session replay. **No component or route tests.** That is the real gap.

**Palette in the code today:** warm terracotta. `--color-bg #0e0f12`, `--color-surface #17181c`, `--color-accent #c99575`, `--color-complete #7a9b6e`, defined in `src/styles/tokens.css` with a light-mode override.

## What is in flight

A redesign, specified in `docs/REDESIGN-PROMPT.md`: six-tab navigation (Today, Train, Splits, Calendar, Records, Settings), the training module surfaced properly in the UI, and a move to the **Nocturne** palette — near-black `#05050c` ground with a purple accent ramp.

This is a **UI and navigation change**. The data model and logic underneath it are already built and do not change.

> **Note on the reference design.** `REDESIGN-PROMPT.md` cites `Kusuo Redesign.dc.html` as the source for exact layout and copy. That file **now exists** at the repository root (274 KB, roughly 30 phone frames, exported 30 August). It was missing earlier that day; if any document still says it is absent, that document is stale.
>
> **It is incomplete.** The canvas links two assets that are *not* on disk:
>
> ```
> _ds/nocturne-3b49528c-ab2a-4dc7-aaad-a66924b76555/styles.css
> _ds/nocturne-3b49528c-ab2a-4dc7-aaad-a66924b76555/_ds_bundle.js
> ```
>
> There is no `_ds/` directory anywhere in the repo. **The token values are not inlined** — an earlier draft of this spec said they were, and that was wrong. The canvas references **twenty** distinct custom properties and defines **none** of them; the only hex literals in all 274 KB are `#05050c` (×4), `#101120` (×2), `#9184d9` and `#b5abfc`. The entire palette, type scale and shadow set live in the missing `styles.css`, so the file does not merely open degraded — its colours do not exist.
>
> **Export `_ds/` alongside it from the Claude Design session before treating the canvas as the reference.** `REDESIGN-PROMPT.md`'s prose covers layout, behaviour and copy, and is detailed enough to build structure from — but it carries no colour values either, so it cannot substitute for the stylesheet.
>
> A prompt for regenerating the palette from the known anchors is in `docs/nocturne-tokens-prompt.md`. It is a fallback: the thirty screens were rendered with the original values, so regenerated ones will not match them exactly.
>
> Whatever happens, do not reconstruct missing screens from inference and present them as the agreed design.

### Nocturne accessibility constraint — must be honoured

Verified by independent calculation on 30 August 2026. Full working in `docs/decisions/2026-08-30-nocturne-contrast.md`.

`color-mix(in srgb, var(--color-text) 45%, transparent)` over `#05050c` resolves to `#6c6c74` — **3.90:1**. That is below the 4.5:1 WCAG AA threshold for normal-size text, and it cannot be fixed by raising `--color-text` (the required source value works out to 256.1, past the top of the range).

Recomputed independently on 31 August 2026 and confirmed: 16.981:1, 3.904:1, 5.404:1, 4.517:1. Two caveats the decision record does not state:

- Every figure assumes `--color-text: #eaeaf2`. **That value is not on disk** — it lives in the missing `styles.css`. If the exported Nocturne text colour differs, all four rows move and the decision needs recomputing.
- `#76767f` is the *first* solid step that clears 4.5:1. There is no headroom; darkening it by one step fails.

**The fix: make the muted step a solid token, not a mix.**

```css
--color-text-muted: #76767f;  /* 4.52:1 on #05050c — verified */
```

The 45% mix stays, but only for what it is genuinely valid for: hairlines, icon strokes, disabled states, and text at 24px or above. **It must not carry labels, meta text, or inactive tab labels** — those are small text and need 4.5:1.

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
- The redesign's reference canvas is in the repo, but its `_ds/` stylesheet is not, so the Nocturne palette has no values anywhere (above).
- `app/PRODUCT.md` is Impeccable's own schema file, owned by that tool. It is consistent with this spec. Do not hand-edit it.
