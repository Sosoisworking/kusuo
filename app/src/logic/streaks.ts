import { addDays, startOfWeek } from '../lib/date'

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

function countInWeek(completedDates: Set<string>, weekStart: string): number {
  let count = 0
  let cursor = weekStart
  for (let i = 0; i < 7; i++) {
    if (completedDates.has(cursor)) count += 1
    cursor = addDays(cursor, 1)
  }
  return count
}

/**
 * N×/week habit streak: consecutive calendar weeks (Mon-Sun) meeting
 * frequencyValue, not consecutive days. Mirrors the daily rule — an
 * in-progress current week that hasn't yet met target doesn't break the
 * streak until the week is actually over.
 */
export function weeklyStreak(
  completedDates: Set<string>,
  frequencyValue: number,
  today: string,
): number {
  let weekStart = startOfWeek(today)
  if (countInWeek(completedDates, weekStart) < frequencyValue) {
    weekStart = addDays(weekStart, -7)
  }
  let streak = 0
  while (countInWeek(completedDates, weekStart) >= frequencyValue) {
    streak += 1
    weekStart = addDays(weekStart, -7)
  }
  return streak
}
