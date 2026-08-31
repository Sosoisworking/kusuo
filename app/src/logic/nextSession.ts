import type { ExerciseCategory, SessionMark, Split, SplitDay, SplitEntry } from '../db/schema'

/**
 * Which day of the split comes next.
 *
 * Kusuo has no training calendar and deliberately does not schedule sessions to
 * weekdays — the split is a cycle you advance through when you train, not a
 * timetable you fall behind on. So "next" is simply the day after the last one
 * you finished, wrapping at the end. Before you have finished anything, it is
 * the first day.
 *
 * A mark whose replayed state is `uncomplete` does not advance the cycle, so
 * un-finishing a session puts you back where you were.
 */
export function nextSplitDay(split: Split, marks: SessionMark[]): SplitDay | undefined {
  if (split.days.length === 0) return undefined

  const dayIds = new Set(split.days.map((d) => d.id))
  const lastByDay = new Map<string, SessionMark>()
  for (const mark of marks) {
    if (!dayIds.has(mark.splitDayId)) continue
    const key = `${mark.localDate} ${mark.splitDayId}`
    const existing = lastByDay.get(key)
    if (!existing || mark.timestamp > existing.timestamp) lastByDay.set(key, mark)
  }

  let latest: SessionMark | undefined
  for (const mark of lastByDay.values()) {
    if (mark.action !== 'complete') continue
    if (!latest || mark.timestamp > latest.timestamp) latest = mark
  }
  if (!latest) return split.days[0]

  const lastIndex = split.days.findIndex((d) => d.id === latest.splitDayId)
  if (lastIndex === -1) return split.days[0]
  return split.days[(lastIndex + 1) % split.days.length]
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
