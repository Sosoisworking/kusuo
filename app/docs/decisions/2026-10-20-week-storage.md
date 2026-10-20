# Decision — the week is stored by weekday

**Date:** 20 October 2026
**Status:** Adopted. S1a derives the week from each plan's order; S3 stores it and pins it to
weekdays.

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

**How existing splits carry over:** each plan's week is derived from its day order by the same
rule `dayForDate` always used. A property test compares the two across all seven weekdays, both
week starts, and splits of 1 to 10 days with every placement of rest days.

**Why S1a derives it rather than storing it.** S1a promises no change anyone can see, and today
changing the week start moves the schedule. A week stored in S1a would either stop moving — a
visible change, early — or have to be rewritten on every change of the setting, which is the
behaviour this record exists to end. So `logic/schedule.ts` builds the week from the plan's order
each time it is asked (`weekFromOrder`, read through `sessionFor`), and `dayForDate` already goes
through it. S3 stores that week on each plan, from the week start in effect then, and the
schedule stops moving with the setting from that day on.

**The test that asserts the shift** is changed on purpose in S3, with this record as the reason.
