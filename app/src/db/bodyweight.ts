import { nextTimestamp } from './clock'
import { db, type BodyweightEntry } from './schema'

/** Appends a weigh-in; never mutates or deletes a previous one. */
export async function appendBodyweight(
  localDate: string,
  weightKg: number,
  deviceId: string,
): Promise<BodyweightEntry> {
  const entry: BodyweightEntry = {
    id: crypto.randomUUID(),
    localDate,
    weightKg,
    timestamp: nextTimestamp(),
    deviceId,
  }
  await db.bodyweight.add(entry)
  return entry
}

export function allBodyweight(): Promise<BodyweightEntry[]> {
  return db.bodyweight.toArray()
}
