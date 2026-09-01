# Kusuo — redesign slice plan

Written 31 August 2026. Covers the whole redesign from the current three-tab app to the six-tab
design in `Kusuo Redesign.dc.html` (30 screens).

Read `SPEC.md` first — it is the source of truth for what exists. This file is the route from here
to there. Every slice leaves the app working, installed and deployed; a two-week gap costs momentum
and nothing else.

## The shape of the order

The canvas defines **twenty** CSS custom properties and the value of none of them; they lived in
`_ds/nocturne-.../styles.css`, which was missing until 31 August. Its token block is now in
`docs/nocturne-tokens.css`.

The redesign still splits cleanly in two, and the split is worth keeping. **Slices B–H build
structure, behaviour and copy against the tokens already in `src/styles/tokens.css`**, and the
palette swap lands once as slice I. Keeping them apart means a colour problem and a layout problem
can never arrive in the same commit — cheap, because rule 10 already forbids colour literals in
components. Slice I can land whenever you want to see it.

## Slice A — training data model ✅ done

`902eeff`, `d4f9f88`. Schema v3, exercise directory, split templates, session logging, derived
records, backup v2. Deployed and verified on the live build.

---

## Slice B — six-tab shell and Today

**Canvas:** `Today (six-tab)`, and the tab bar shared by every screen.

Navigation goes from three tabs to six: Today, Train, Splits, Calendar, Records, Settings. The four
new tabs land as real routes with honest empty states, not placeholders — an empty Train tab that
says what to do next is finished work; one that says "coming soon" is not.

Today gains, in canvas order: the date line, a greeting, a profile-initials button in the header,
the week strip (seven days, per-day completion counts, today marked), a **Next up** card naming the
day's split with `6 exercises · 21 sets · logging it ticks the habit` and a `Start session` action,
then `Later`, the `2 of 5 done today · 3 left` count, the habit list with per-habit subtitles
(`12d`, `4 of the last 7 days`, `1 of 3 this week`), and Reflect and Goals as **collapsed cards** at
the bottom carrying a one-line summary each.

Reflect and Goals lose their tabs but keep their screens, reached by tapping the card. Settings
keeps its tab.

**Also in this slice:** the first route tests. The shell *is* a routing change and routing is
currently untested, so this is the moment. Thread `settings.weekStart` into the three call sites
that currently omit it — the week strip makes the bug visible for the first time.

## Slice C — Train and the session flow

**Canvas:** `Train`, `Session`, `Exercise detail`.

Train opens **session-first**: a Start session card for today's split day, the day's exercises
below, recent sessions after. Not a tray.

The session flow is one exercise at a time — a set table with weight, reps and RPE, where logging a
set advances focus to the next. Finishing writes the `SessionMark` and the training habit's tick,
both already built and tested in slice A. **There is no rest timer anywhere, and none gets added.**

Exercise detail shows that movement's history and records.

## Slice D — Splits, the editor and the directory

**Canvas:** `Splits`, `Split editor`, `Directory`, `Add custom exercise`.

Six seeded templates, the active split, and the user's own copy after any edit — all present in the
data layer already. The editor reorders by drag handle, reveals Remove on swipe-left, and puts Swap
on each row into the directory. **One gesture per row at a time.** The directory searches by text
and filters by category, muscle group, equipment, recently used and "mine"; add-custom is a bottom
sheet. ExRx.net is credited, with no affiliation implied.

## Slice E — Calendar ✅ done

**Canvas:** `Calendar`, `Calendar day`.

Month grid with category dots and a Habits / Training segmented toggle. Day detail leads with the
summary — dots, volume, sets, habits done — and puts the set-by-set breakdown below. Week start
follows the setting.

## Slice F — Records ✅ done

**Canvas:** `Records`.

Per-lift records and habit bests behind the same Habits / Training toggle, with kg/lb switchable
inline as well as in Settings. Every figure comes from `logic/records.ts`, derived by replay. Facts
stated plainly: no trophies, no targets, no celebration.

## Slice G — Settings and "Your data" — core done, share outstanding

**Canvas:** `Settings (six-tab)`, `Settings — your data`, `Share`, `Import`, `Export confirm`,
`Reset confirm`, `Profile menu`, `Account`.

Units, week start, theme and defaults. "Your data" holds export, import, share and reset. Share
emits plain text for one session or a date range, with a `KUS2` import code behind a toggle that is
on by default. Import takes a whole pasted message or a file, finds the code itself, and arrives as
a **new** split day — nothing existing is overwritten. Reset covers everything and sits behind a
warning panel and a confirm requiring the word `RESET`, offering "Export first".

Destructive actions read through an outlined button, a warning icon and explicit copy. No red.

Account and the profile menu move behind the initials button in the Today and Train headers.

## Slice H — Onboarding ✅ done

**Canvas:** `Onboarding 1 — welcome` through `4 — split`.

Four steps: welcome → you (name, units, bodyweight, height, experience) → first habits → pick a
split. **Every field is skippable.** The existing device-role question stays; it is what makes the
Mac read-only, and slice A's exercise seeding hangs off it.

## Slice I — the Nocturne palette ✅ done

**Unblocked 31 August 2026.** The stylesheet was read out of the Claude Design project; its token
block is in `docs/nocturne-tokens.css`.

A single change to `src/styles/tokens.css`: the Nocturne properties replace the terracotta set, and
the committed dark-only decision removes the light-mode override.

Kusuo's components use `--color-text-primary`, `--color-text-secondary`, `--color-border` and
`--color-complete`, none of which Nocturne defines. Map them rather than rename every component:
`--color-text-primary` → `--color-text`, `--color-text-secondary` → the **55% mix** (5.19:1 —
`#8a8b93`), `--color-border` → `--color-neutral-800`. `--color-complete` has no Nocturne equivalent
and is the one real decision in this slice; the palette carries no green, and per the product rules
completion is not an alert colour, so it likely becomes an accent step.

Per `decisions/2026-08-31-nocturne-contrast-corrected.md`: **do not add a `--color-text-muted`
solid token**, and never use the 45% mix for text under 24px.

Can land any time after slice B.

---

## Cross-cutting, checked every slice

- **Mac read-only.** Write affordances absent, not disabled — including every new training surface.
  No route, deep link or dev affordance reaches a database write on a reader device.
- **44×44pt tap targets**, `100dvh` never `100vh`, `env(safe-area-inset-*)` top and bottom. The six
  tabs must fit at 402px with 19px icons and 9px labels.
- **Five-second open.** Today's habits and the next action visible immediately, never behind
  navigation.
- **No colour, size, radius or shadow literals** in components. Tokens only — this is what makes
  slice I a one-file change.
- **Empty, loading, error and offline states** on every screen.
- Per slice: `/impeccable craft`, then `critique`, then `audit`. Findings fixed or argued down in
  writing, never silently skipped.
- Typecheck, tests and lint clean; deployed and opened on the iPhone before the next slice starts.

## Known gap this plan closes

`SPEC.md` names "no component or route tests" as the real gap in the codebase. Slice B adds route
tests; each slice after it adds tests for its own screens, so the gap closes as the redesign lands
rather than being scheduled as separate work that never happens.

---

## Where this stands — 31 August 2026

Verified against the code, not recalled. 315 tests, deployed and live.

**Done:** A (training data model), B (six-tab shell and Today), C (Train, session
flow, exercise detail), D (Splits, editor, directory), I (Nocturne).

**Slice E — Calendar · part built.** Month grid, habit dots, a training dot,
day selection, the day's reflection and the goals bar all ship. Still to do:
category-coloured dots, the Habits / Training toggle, and the day detail's
set-by-set breakdown with volume and set counts. Today it says "1 of 3 habits ·
trained" but not what was trained.

**Slice F — Records · part built.** Habit bests, reached goals and reflections
ship. Still to do: per-lift records — heaviest set, Epley 1RM, best volume, rep
PRs. `logic/records.ts` already computes all of it and is tested; only Exercise
detail renders it. Also the Habits / Training toggle and the inline kg/lb
toggle.

**Slice G — Settings · the widest gap.** Theme, the update check with its build
stamp, backup import and Start over all ship. Still to do: **units and week
start have no UI at all** — both are in the schema and honoured by the logic, so
the app is stuck on kg and Monday with no way to change either. That is the
first thing to fix here. Then: the "Your data" sub-screen, Share with the
`KUS2` code, export confirm, profile menu, account.

**Slice H — Onboarding · part built.** Three steps: device role, name, first
habits. Still to do: the canvas's four steps, and the real gap — **onboarding
never picks a split**, so a fresh install lands on Today with no training set up
and has to find Splits alone.

### Carried debt

- `app/PRODUCT.md` is stale. Impeccable reads it as the product contract and it
  still describes a warm-and-encouraging voice, one accent, habits-only scope
  and Reflection as a maybe. Every Impeccable run starts from a wrong picture
  until it is regenerated.
- No Playwright test. `SPEC.md`'s definition of done asks for one covering
  add habit → complete → reload → still complete. No config, no e2e directory.
- Nothing has been run on a real iPhone by anyone but Soso. Safe-area, `100dvh`
  and the on-screen keyboard are confirmed only by his own use.

### Waiting on Soso

- The kettlebell cycle. It becomes an eighth template once the exercises and
  days arrive; the same three questions apply as for the Batman split — rep
  ranges, rest days, and which entries are cardio.
