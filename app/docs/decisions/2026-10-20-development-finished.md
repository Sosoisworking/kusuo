# Decision — development is finished

**Date:** 20 October 2026
**Status:** Final.

## What was decided

Sohaib stopped the project on 20 October 2026. Development ended after slice S1b of the training
rebuild (`2026-10-20-training-rebuild.md`). Nothing further is planned.

## The state it is left in

- **Live** at https://sosoisworking.github.io/kusuo/, deployed from `main` by
  `.github/workflows/deploy.yml`, which still gates every push on typecheck, lint, unit and
  end-to-end tests.
- **Habits, goals, reflections, streaks and records** — as they were before the rebuild began.
- **Training** — the training log as it was, plus what the rebuild shipped:
  - **S0:** one replay ordering, a persisted clock, an id for every set, and every table
    classified; backups can no longer change what a device is.
  - **S1a:** splits are stored as plans and routines (database version 10, backup format 6).
  - **S1b:** the day's session is every routine done that day; rest days marked done are not
    training; archiving the training habit lets go of it.
- **Tests:** 39 unit and component test files and 4 Playwright suites; lint is clean.

## What the rebuild did not reach

S2 to S12 and the Gate were not built. There is no imported exercise library, no new planner or
session screen, no progression rules, no new stats, no importers, no move to its own domain, no
server, accounts, sync, reminders or AI coach.

So every rule the rebuild was going to end still holds, and the documents that state them are
right as they stand: a split is a weekly schedule; no green, no red; no backend and no accounts;
no notifications; no AI. Kusuo stays on `sosoisworking.github.io`, which is fine for an app that
holds nothing a server or another page could use.

No openGym code, data or media was brought into this repository.

## Left in place on purpose

- **The `splits` table**, unread since version 10. It was kept so the conversion could be run
  again; removing it would take another database version and buy nothing.
- **The real-backup migration tests** (`db/migrate.test.ts`), which run only when
  `KUSUO_REAL_BACKUP` points at an exported file.
- **The skipped root-font-size test** (`e2e/landscape-and-scaling.spec.ts`) — a decision, not a
  failure; the test explains it.

## The last changes

Next movement now greys out while a set is saving, as Finish already did, instead of ignoring the
tap without a sign. The last two lint warnings — Today reading its loader before declaring it,
and Onboarding choosing its starter habits in an effect — are gone.
