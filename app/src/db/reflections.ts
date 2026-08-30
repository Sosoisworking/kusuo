import { nextTimestamp } from './clock'
import { db, type ReflectionEntry } from './schema'

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
