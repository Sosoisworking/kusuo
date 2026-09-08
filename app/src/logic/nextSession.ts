import type { Exercise, ExerciseCategory, Split, SplitDay, SplitEntry, WeekStart } from '../db/schema'
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

/**
 * Which day is actually being done on a date, which is not always the one the
 * schedule names.
 *
 * Miss Monday and Tuesday and the schedule still says Wednesday — that rule
 * stays, because a missed session is missed rather than owed. But someone who
 * decides to do Monday's shoulders on Wednesday is not fighting the schedule,
 * they are training; and once they have logged a set against that day, that is
 * the session in front of them. Work already recorded outranks the calendar.
 *
 * The scheduled day wins any tie: if it has work on it too, the swap was a
 * detour rather than a replacement.
 */
export function sessionDayOn(
  split: Split,
  localDate: string,
  weekStart: WeekStart,
  workedDayIds: ReadonlySet<string>,
): SplitDay | undefined {
  const scheduled = dayForDate(split, localDate, weekStart)
  if (scheduled && workedDayIds.has(scheduled.id)) return scheduled
  return split.days.find((d) => workedDayIds.has(d.id)) ?? scheduled
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

/**
 * The same question with the movement in hand, so the cardio gap has an answer:
 * a circuit reads as the time it runs for, and cardio with no stated length
 * says what it is. Splits and the session screen were each filling that gap
 * themselves and disagreeing about it — one showed "20 min", the other "time".
 */
export function describePrescription(
  entry: SplitEntry,
  exercise?: Pick<Exercise, 'category' | 'circuit'>,
): string {
  return (
    formatPrescription(entry, exercise?.category) ||
    (exercise?.circuit ? `${exercise.circuit.durationMin} min` : 'cardio')
  )
}
