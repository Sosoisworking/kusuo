import type { Habit, HabitEvent, WeekStart } from '../db/schema'
import { addDays, startOfWeek } from '../lib/date'
import { completedDatesForHabit } from './derive'

/** The seven localDates of the week containing `localDate`, in order. */
export function weekDays(localDate: string, weekStart: WeekStart = 'monday'): string[] {
  const first = startOfWeek(localDate, weekStart)
  return Array.from({ length: 7 }, (_, i) => addDays(first, i))
}

/**
 * How many of a habit's completions fall in the seven days from `firstDay`.
 * Shared by the streak logic and the week strip so the two can never disagree
 * about what a week contains.
 */
export function countInWeek(completedDates: Set<string>, firstDay: string): number {
  let count = 0
  let cursor = firstDay
  for (let i = 0; i < 7; i++) {
    if (completedDates.has(cursor)) count += 1
    cursor = addDays(cursor, 1)
  }
  return count
}

/** Completions in the week containing `localDate`, honouring the week start. */
export function countInWeekOf(
  completedDates: Set<string>,
  localDate: string,
  weekStart: WeekStart = 'monday',
): number {
  return countInWeek(completedDates, startOfWeek(localDate, weekStart))
}

/**
 * How many habits were completed on each of `dates`. Drives the week strip's
 * per-day numbers. Every date asked for gets an entry, including zeroes — a
 * missing day and an empty day are different things and the strip shows both.
 */
export function completionsByDate(
  habits: Habit[],
  events: HabitEvent[],
  dates: string[],
): Map<string, number> {
  const counts = new Map(dates.map((d) => [d, 0]))
  for (const habit of habits) {
    const completed = completedDatesForHabit(events, habit.id)
    for (const date of dates) {
      if (completed.has(date)) counts.set(date, (counts.get(date) ?? 0) + 1)
    }
  }
  return counts
}
