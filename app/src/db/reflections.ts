import { db, type ReflectionEntry } from './schema'

// Same monotonic-timestamp pattern as events.ts: Dexie's primary key is a
// UUID, so query results are not guaranteed to come back in insertion order —
// replay's "last event wins" relies entirely on `timestamp`. Date.now() alone
// can tie within the same millisecond on rapid successive writes, so this
// device's clock is forced strictly monotonic on append.
let lastTimestamp = 0
function nextTimestamp(): number {
  const now = Date.now()
  lastTimestamp = now > lastTimestamp ? now : lastTimestamp + 1
  return lastTimestamp
}

/** Appends a reflection entry; never mutates or deletes prior entries. Editing today's note is a new appended entry, not an edit. */
export async function appendReflection(
  localDate: string,
  text: string,
  deviceId: string,
): Promise<ReflectionEntry> {
  const entry: ReflectionEntry = {
    id: crypto.randomUUID(),
    localDate,
    text,
    timestamp: nextTimestamp(),
    deviceId,
  }
  await db.reflections.add(entry)
  return entry
}

export function allReflections(): Promise<ReflectionEntry[]> {
  return db.reflections.toArray()
}
