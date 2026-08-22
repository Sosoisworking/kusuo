import type { HabitEvent } from '../db/schema'

/**
 * Completion state is never stored — it's derived by replaying events for a
 * habitId+localDate, last event (by timestamp) wins. Double-complete is
 * idempotent by construction: replaying two 'complete' events in a row still
 * yields 'complete'.
 */
export function isCompleteOnDate(
  events: HabitEvent[],
  habitId: string,
  localDate: string,
): boolean {
  let last: HabitEvent | undefined
  for (const e of events) {
    if (e.habitId !== habitId || e.localDate !== localDate) continue
    if (!last || e.timestamp > last.timestamp) last = e
  }
  return last?.action === 'complete'
}

/** All localDates for a habit whose replayed state is 'complete'. */
export function completedDatesForHabit(
  events: HabitEvent[],
  habitId: string,
): Set<string> {
  const lastByDate = new Map<string, HabitEvent>()
  for (const e of events) {
    if (e.habitId !== habitId) continue
    const existing = lastByDate.get(e.localDate)
    if (!existing || e.timestamp > existing.timestamp) {
      lastByDate.set(e.localDate, e)
    }
  }
  const dates = new Set<string>()
  for (const [date, e] of lastByDate) {
    if (e.action === 'complete') dates.add(date)
  }
  return dates
}
