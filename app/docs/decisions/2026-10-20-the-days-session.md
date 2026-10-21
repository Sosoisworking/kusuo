# Decision — the day's session is every routine done that day

**Date:** 20 October 2026
**Status:** Adopted and built (S1b).

## What was wrong

- **Today and Train disagreed after a swap.** Train had learned that work recorded today
  outranks the schedule — do Monday's shoulders on Wednesday and Wednesday's session is
  shoulders. Today still asked only the schedule, and went on offering Wednesday's back work
  after the shoulders were done.
- **Two routines in a day were two half-sessions.** Doing the scheduled day and a missed one
  together left whichever wasn't finished from its own screen "in progress" for the rest of the
  day, after the habit was already ticked. A second finish ticked the habit a second time.
- **A rest day counted as training.** Marking a rest day done wrote the same mark as finishing
  a session, so the calendar showed rested days as trained, Train listed them among recent
  sessions, and Share offered them.
- **Archiving the training habit left the pointer behind.** Finishing a session went on ticking
  a habit no screen shows, Today kept promising "logging it ticks the habit", and Settings showed
  no habit chosen while one still was.

## What it is now

- **One question, one answer.** `sessionFor` (in `logic/schedule.ts`) returns the routines
  being done on a date: every routine with work on it — a set logged, or the routine marked
  done — with the scheduled one first when it is among them, or, until anything is worked, what
  the schedule names. `sessionDaysOn` asks it of a split; Today, Train, the session screen and
  Share all use it.
- **Finishing finishes the session.** From any of its routines, Finish writes a mark for every
  training routine in the day's session and ticks the habit once; Reopen undoes them all, and
  still never un-ticks the habit. A routine finished later the same day leaves the tick alone.
- **Marks say what they were.** Every mark now carries `kind`: `training` from Finish, `rest`
  from marking a rest day. Rest marks are not training anywhere. A mark from before this is
  judged by its routine's kind now — the one guess, and the reason marks record it from here on:
  a routine's kind can change, and turning Sunday from rest into training must not make every
  rested Sunday look trained.
- **The pointer follows the habit.** Archiving the training habit clears `trainingHabitId`. A
  pointer already left at an archived habit is treated as unset: finishing ticks nothing, Today
  promises nothing, and a backup that points at an archived habit doesn't restore the pointer.

## What the screens show

- **Today** names the whole session ("Push + Pull"), counts sets across it, and says "Done today"
  only when every routine in it is finished.
- **Train** shows the routine still to do, with the rest of the session listed beneath it as
  "Also today", each with where it stands. "Doing this instead of …" appears only when the
  scheduled routine is not part of the session at all.
- **Recent sessions** lists one row a day, named for every routine finished in it.
- **Share** names a session for all its routines. Its import code carries one day, so a session
  of several travels as one day holding all their movements, named for all of them.

## Not in this slice

- The session screen still runs one routine at a time. S4 was to replace it with one that runs
  the whole session; it was not built — development stopped after S1b.
- There are no nudges, so nothing needed a "trained today" beyond what the calendar shows.
