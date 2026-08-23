import type { ReflectionEntry } from '../db/schema'

/**
 * Today's (or any date's) reflection text is never stored — it's derived by
 * replaying entries for a localDate, last entry (by timestamp) wins. Same
 * pattern as habit completion in derive.ts.
 */
export function latestReflectionForDate(
  entries: ReflectionEntry[],
  localDate: string,
): ReflectionEntry | undefined {
  let last: ReflectionEntry | undefined
  for (const e of entries) {
    if (e.localDate !== localDate) continue
    if (!last || e.timestamp >= last.timestamp) last = e
  }
  return last
}

/** Latest entry per distinct localDate, for the history list. */
export function latestReflectionsByDate(entries: ReflectionEntry[]): Map<string, ReflectionEntry> {
  const lastByDate = new Map<string, ReflectionEntry>()
  for (const e of entries) {
    const existing = lastByDate.get(e.localDate)
    if (!existing || e.timestamp > existing.timestamp) {
      lastByDate.set(e.localDate, e)
    }
  }
  return lastByDate
}
