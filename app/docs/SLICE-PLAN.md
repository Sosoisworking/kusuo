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

## Slice G — Settings and "Your data" ✅ done

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

## Where this stands — 1 September 2026

Every slice A through I is done. 380 unit tests across 28 files, plus two
Playwright paths on WebKit at iPhone size. CI runs typecheck, lint, unit tests
and e2e before anything deploys.

### Carried debt, closed

- `PRODUCT.md` was stale enough to mislead Impeccable. Rewritten from `SPEC.md`.
- There was no Playwright test. There are two, covering the only thing the
  component suite cannot: data surviving a real reload in a real browser engine.
- CI ran `npm run build` alone, so a green deploy meant the code compiled and
  nothing more. It gates on the full suite now.

### Carried debt, closed on 1 September

- The split editor can add, rename, remove and rest a **day**, and Splits offers
  "Build a split of my own" — the canvas's from-scratch path, now that the
  editor can finish what it starts. Removing a day keeps every session logged
  against it: the day leaving the plan does not unmake the training.
- **Bodyweight is tracked over time.** Onboarding takes the first weigh-in and
  Records holds the rest, with the change since the first. Height and experience
  are still not collected, because nothing reads them.

### Carried debt, open

- **Nothing has run on a physical iPhone.** Everything below was found and
  verified on the iOS Simulator (iPhone 17, iOS 26.3), which is the real engine
  on real iOS but still not Soso's own handset. Playwright's WebKit at iPhone 13
  size covers the same engine at the same size in CI.

---

## The defect sweep — 1 and 2 September 2026

A screen-by-screen sweep on the Simulator found 33 defects; a separate hardening
pass on the five areas the sweep had not touched — offline, backup import, drag
reorder, landscape, text scaling — found 11 more. All of them are fixed except
the three decisions recorded at the end. 453 unit tests across 30 files and 13
Playwright paths; one Playwright test is deliberately skipped and says why.

### What the sweep changed

- **A set that was never performed could be logged.** Typing one set and tapping
  *Next movement* wrote all three, because the suggestion behind an untouched row
  was a value rather than a placeholder and "not blank" was mistaken for "typed
  in". A field now holds only what was typed or what is logged; a suggestion is a
  ghost you can see through, and moving on commits only rows you touched. An RPE
  on its own is not a set either. This corrupted records, 1RM, volume and the
  calendar, and is the reason the sweep happened.
- **Deep links and reloads went to GitHub's 404 page.** `public/404.html` folds
  the path into the query and `index.html` unfolds it before the bundle runs, so
  a bookmark, a shared link or a pull-to-refresh reaches the router.
- **Offline did not work unless Settings had been opened.** The service worker
  was registered only by a hook inside `Settings.tsx`; it is now injected at
  build time and installs on load.
- **Backups could lose data quietly.** Schema 5 carries the record's preferences,
  refuses a file from a newer version, parses tables from `db/tables.ts` rather
  than a hand-written list, re-seeds the movement library after an old import,
  and asks every table — not just habit events — whether this device holds newer
  work before replacing it.
- **A drag that ended off the handle never ended**, leaving the split rewritable
  by a passing pointer. The drag now lives on the window for its own lifetime.
- **One throw took the whole app down** with no way back. There is an error
  boundary, and its escape route is Your data and an export.
- **Two screens were unreachable.** Habit detail gained a way in from Today's
  habit name; Progress was retired, because the week strip, Calendar, Records and
  Habit detail carry what it showed.
- **Log out** exists: this device forgets its role, name and preferences and asks
  the first-run questions again. The record is untouched — erasing that is still
  Your data › Reset all data, behind a typed RESET.
- **Onboarding can restore.** A device that has a backup imports it before it has
  a record, which is the only bridge across iOS's separate storage for an
  installed home-screen app — and the app now says that plainly rather than
  looking empty and unexplained.
- Smaller: a day on the calendar answers three questions in tabs (training,
  reflection, goals) instead of stacking them; the month grid stops growing when
  the phone turns sideways; the split editor's number fields no longer fight you
  mid-keystroke; every movement can leave a day from the list rather than only
  the one you are standing on; the tab bar keeps clear of the notch housing in
  landscape.

### What the peer review then found

An adversarial review of the whole diff found three more paths that lose or
invent data, all of them in the same place the sweep had already been:

- **Leaving a movement meant three different things.** Only "Next movement"
  committed a typed set. Finishing the session from the last movement, or
  tapping another movement in the list, threw it away — the mirror of the
  phantom-set bug, losing work you did rather than inventing work you did not.
  Every way out of a movement now commits through one function.
- **A removed set came back.** Voiding a set left the draft that matched it
  behind, so the next "Next movement" wrote the set straight back and the log
  carried `log → void → log` for a set performed once.
- **Removing a movement from the list cleared the drafts on the movement in
  front of you.** Editing the plan elsewhere is not a reason to lose what you
  typed here.

And three that were wrong in a different way:

- **A waiting update applied itself.** `registerType` was `prompt` and nothing
  prompted: the page reloaded under a half-typed name, and because the reload
  beat the check's own wait, "You're up to date" was the only message the button
  could ever show. A new version is now an offer with a button.
- **The suggestion token was 3.14:1** — the app's least readable text on the one
  number a tick commits. Difference in *kind* carries it now: the placeholder is
  italic, at 4.50:1 dark and 4.68:1 light.
- **The drag's auto-scroll started on press**, so a hold near the bottom of a long
  day scrolled and reordered on its own. It waits for the finger to move.

Also from the review: `theme-color` and the manifest still named the
pre-Nocturne ground; `defaultSets` was the one imported preference the version
gate let through unbounded; a `trainingHabitId` naming a habit the file never
carried would have been written anyway; an untouched template split made a
freshly onboarded phone look like it held work newer than any backup; the
calendar's tabs had half the ARIA pattern and none of the keyboard behaviour;
and the landscape cap used `vh` where the SPEC calls for `dvh`.

### Decided, not fixed

- **Dynamic Type.** iOS applies it to native apps, never to web content — not in
  Safari and not in an installed home-screen app — so making the type scale
  answer to the root font size would change nothing on the only device this app
  runs on, while rewriting a scale six tabs at 402pt were designed around. The
  test sits skipped, ready for the day that stops being true.
- **The installed app's separate storage.** Not fixable from the web; carried by
  copy and by the restore step instead.
- **Export in the installed app** opens iOS's preview with *Open in…* rather than
  saving a file. The copy says what each route actually does instead of promising
  a download.
