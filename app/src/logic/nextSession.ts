import type { ExerciseCategory, Split, SplitDay, SplitEntry, WeekStart } from '../db/schema'
import { weekdayIndex } from '../lib/date'

/**
 * Which day of the split belongs to a date.
 *
 * The split is a weekly schedule, not a cycle you advance through: the first
 * day falls on the first day of the week, and today's date decides today's
 * session. Miss Tuesday and Wednesday still shows Wednesday's work — a missed
 * session is missed, not carried forward as a debt.
 *
 * A split with fewer than seven days repeats within the week, so a 3-day
 * push/pull/legs runs Mon-Tue-Wed then again Thu-Fri-Sat. The week start
 * setting decides which weekday is column zero.
 */
export function dayForDate(
  split: Split,
  localDate: string,
  weekStart: WeekStart = 'monday',
): SplitDay | undefined {
  if (split.days.length === 0) return undefined
  return split.days[weekdayIndex(localDate, weekStart) % split.days.length]
}

/** Total sets a split day prescribes, for the "6 exercises · 21 sets" line. */
export function plannedSetCount(day: SplitDay): number {
  return day.entries.reduce((total, entry) => total + entry.sets, 0)
}

/**
 * How a prescribed entry reads. Cardio has no sets or reps to state, so it
 * shows nothing rather than "1 × 0"; a fixed target collapses to one number.
 */
export function formatPrescription(entry: SplitEntry, category?: ExerciseCategory): string {
  if (category === 'cardio') return ''
  const reps = entry.repsMin === entry.repsMax ? `${entry.repsMin}` : `${entry.repsMin}-${entry.repsMax}`
  return `${entry.sets} × ${reps}`
}
