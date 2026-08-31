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

/** True when an entry holds nothing at all — an empty save is not a reflection. */
export function isBlank(entry: Partial<Pick<ReflectionEntry, 'text' | 'energy' | 'mood' | 'wentWell' | 'gotInTheWay'>>): boolean {
  return (
    !entry.text?.trim() &&
    !entry.wentWell?.trim() &&
    !entry.gotInTheWay?.trim() &&
    entry.energy === undefined &&
    entry.mood === undefined
  )
}

/**
 * An entry as one readable block, for the places that show a day rather than
 * edit it. Prompts that were left alone are omitted rather than shown empty —
 * a blank answer is not an answer.
 */
export function reflectionSummary(entry: ReflectionEntry): string {
  const parts: string[] = []
  if (entry.energy !== undefined || entry.mood !== undefined) {
    const bits: string[] = []
    if (entry.energy !== undefined) bits.push(`energy ${entry.energy}/5`)
    if (entry.mood !== undefined) bits.push(`mood ${entry.mood}/5`)
    parts.push(bits.join(' · '))
  }
  if (entry.wentWell?.trim()) parts.push(`Went well: ${entry.wentWell.trim()}`)
  if (entry.gotInTheWay?.trim()) parts.push(`Got in the way: ${entry.gotInTheWay.trim()}`)
  if (entry.text?.trim()) parts.push(entry.text.trim())
  return parts.join('\n')
}
