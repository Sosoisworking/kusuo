import { nextTimestamp } from './clock'
import { db, type ReflectionEntry } from './schema'

export interface ReflectionAnswers {
  text?: string
  energy?: number
  mood?: number
  wentWell?: string
  gotInTheWay?: string
}

/** Appends a reflection entry; never mutates or deletes prior entries. Editing today's answers is a new appended entry, not an edit. */
export async function appendReflection(
  localDate: string,
  answers: ReflectionAnswers | string,
  deviceId: string,
): Promise<ReflectionEntry> {
  const fields: ReflectionAnswers = typeof answers === 'string' ? { text: answers } : answers
  const entry: ReflectionEntry = {
    id: crypto.randomUUID(),
    localDate,
    text: fields.text ?? '',
    energy: fields.energy,
    mood: fields.mood,
    wentWell: fields.wentWell,
    gotInTheWay: fields.gotInTheWay,
    timestamp: nextTimestamp(),
    deviceId,
  }
  await db.reflections.add(entry)
  return entry
}

export function allReflections(): Promise<ReflectionEntry[]> {
  return db.reflections.toArray()
}
