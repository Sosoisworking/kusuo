import type { WeekStart } from '../db/schema'
import { weekdayIndex } from '../lib/date'

/**
 * A week: for each weekday, Sunday first, the routines on it. Several can share
 * a day, and a day can have none.
 */
export type Week = readonly (readonly string[])[]

/**
 * The week a plan's order makes. The first routine falls on the first day of
 * the week, and a plan shorter than seven repeats within it — a 3-day
 * push/pull/legs runs Mon-Tue-Wed and again Thu-Fri-Sat.
 *
 * This is derived each time it is asked for, so changing the week-start
 * setting still moves the whole schedule by a day. When plans get a week of
 * their own (S3) it is stored instead, pinned to real weekdays — see
 * docs/decisions/2026-10-20-week-storage.md.
 */
export function weekFromOrder(routineIds: readonly string[], weekStart: WeekStart): Week {
  const week: string[][] = Array.from({ length: 7 }, () => [])
  if (routineIds.length === 0) return week
  for (let column = 0; column < 7; column++) {
    const weekday = weekStart === 'monday' ? (column + 1) % 7 : column
    week[weekday] = [routineIds[column % routineIds.length]]
  }
  return week
}

/** The routines a week puts on a date. */
export function sessionFor(week: Week, localDate: string): readonly string[] {
  return week[weekdayIndex(localDate, 'sunday')] ?? []
}
