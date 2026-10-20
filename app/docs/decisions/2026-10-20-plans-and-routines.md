# Decision — splits are stored as plans and routines

**Date:** 20 October 2026
**Status:** Adopted and built (S1a). Database version 10, backup format version 6.

## What changed

A split was one row holding its days inline, with an `isActive` flag on each split. It is now
three tables:

- **`routines`** — one per split day, keeping the day's id. Name, kind (training or rest),
  entries, and `archived`.
- **`plans`** — one per split, keeping the split's id: a name, `seededFrom`, and `routineIds` in
  order, rest days included.
- **`schedule`** — one row, `activePlanId`.

## Why

- **Days have to stand on their own.** S3's week editor puts more than one routine on a day and
  the same routine on more than one; S1b's combined session finishes several at once. Neither
  works while a day lives inside one split.
- **One pointer, not a flag on each plan.** With two devices writing (S9), two flags can both end
  up set. One row can't point at two plans.
- **Every set belongs to something.** Deleting a day left its sets naming an id nothing defined.
  Such a day now becomes an archived routine — at the upgrade for days already deleted, and at
  the moment of removal from now on.

## How it was done without anyone seeing it

- **Same ids.** A routine has its day's id and a plan its split's, so `splitDayId` on every set
  and mark still resolves and nothing in the record was rewritten.
- **Same answers.** `db/splits.ts` still returns `Split` and `SplitDay`, assembled from plans and
  routines, and every function kept its name. No screen changed. The test suite passed with only
  its storage reads moved onto those functions, and with the version numbers it pins updated.
- **No new stamps.** Converted rows carry the stamps of the rows they came from; an archived
  routine for a deleted day carries the times of the first and last sets or marks against it.
  Restoring a backup made just before the update doesn't warn that the phone holds newer work.
- **One conversion.** `db/migrate.ts`'s `convertSplits` is called by the Dexie upgrade and by the
  importer for files older than version 6, so an old phone and an old file arrive at the same
  plans. A test checks that.
- **Reversible.** The `splits` table is kept, unread, and classed `legacy`: a backup doesn't
  carry it, an import or reset empties it. If the conversion turns out to be wrong, a later
  version can run it again from there.

## Guesses the conversion makes

- A deleted day is named "Removed day"; its label went with it. It is a training routine if any
  set was logged against it, otherwise a rest routine — marking a rest day writes a mark and no
  sets. A session finished with no sets logged would be misread as rest; nothing reads the kind
  of an archived routine yet.
- If a file ever held two active splits, the first in id order stays active — the one the
  screens already showed.

## Not in this slice

The plan put the exercise library's new fields and the conversion of circuits into
`instructions[]` into the same database version. They moved to the slices that show them (S2
and S4): converting circuits now would change the session screen, and S1a changes no screen.
Each is its own later version upgrade.

## Verified

`db/migrate.test.ts` upgrades a version 9 database holding deleted days (one trained, one only
marked), a day turned into rest after it was trained, an inactive split, an empty split, a day
imported from a share code with its custom movement, corrections, a void, and sets from before
set ids. Every split, day, set and mark reads as it did; records and streaks are identical; the
old table is untouched. The same file imported as a version 5 backup produces identical rows.
The same checks run on a real exported backup when `KUSUO_REAL_BACKUP` points at one; the file
stays on the machine and is never committed.
