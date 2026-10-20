# Decision — the week is stored by weekday

**Date:** 20 October 2026
**Status:** Adopted; takes effect in S1a (storage) and S3 (behaviour).

## Today

A split is an ordered list of days. Today's session is
`days[weekdayIndex(date, weekStart) % days.length]`, so the first day falls on the first day
of the week, and changing the week-start setting from Monday to Sunday shifts the whole schedule
by a day. `logic/nextSession.test.ts` asserts that shift.

## From the rebuild

A plan keeps its ordered day list — rest slots included, because that order is also the
rotation sequence — and the schedule is a week template: each actual weekday (Sunday to
Saturday) maps to the routines for that day, as openGym does. Several routines can share a day.

**What changes:** the schedule is pinned to real weekdays. Changing the week-start setting
changes how a week is drawn and where weekly targets begin, not which day Push falls on.

**How existing splits carry over:** the migration derives each plan's week from the same
`dayForDate` rule, using the week start in effect at the time, so on the day of the migration
every day maps to exactly what it did before. A property test compares the two across all
seven weekdays, both week starts, and splits of 1 to 10 days with and without rest days.

**The test that asserts the shift** is changed on purpose in S3, with this record as the reason.
