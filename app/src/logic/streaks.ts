import type { WeekStart } from '../db/schema'
import { addDays, startOfWeek } from '../lib/date'
import { countInWeek } from './week'

/**
 * Daily habit streak: consecutive localDates ending at today, or at
 * yesterday if today isn't complete yet — an unfinished today doesn't break
 * a streak until the day is actually over.
 */
export function dailyStreak(completedDates: Set<string>, today: string): number {
  let cursor = completedDates.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (completedDates.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

/**
 * N×/week habit streak: consecutive calendar weeks meeting frequencyValue, not
 * consecutive days. Mirrors the daily rule — an in-progress current week that
 * hasn't yet met target doesn't break the streak until the week is actually
 * over. Week boundaries follow the device's `weekStart` setting.
 */
export function weeklyStreak(
  completedDates: Set<string>,
  frequencyValue: number,
  today: string,
  weekStart: WeekStart = 'monday',
): number {
  let cursorWeek = startOfWeek(today, weekStart)
  if (countInWeek(completedDates, cursorWeek) < frequencyValue) {
    cursorWeek = addDays(cursorWeek, -7)
  }
  let streak = 0
  while (countInWeek(completedDates, cursorWeek) >= frequencyValue) {
    streak += 1
    cursorWeek = addDays(cursorWeek, -7)
  }
  return streak
}
