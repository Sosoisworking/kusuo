import { db, type HabitEvent, type HabitEventAction } from './schema'

// Dexie's primary key here is a UUID, so query results are not guaranteed to
// come back in insertion order — replay's "last event wins" relies entirely
// on `timestamp`. Date.now() alone can tie within the same millisecond on
// rapid successive writes, so this device's clock is forced strictly
// monotonic on append.
let lastTimestamp = 0
function nextTimestamp(): number {
  const now = Date.now()
  lastTimestamp = now > lastTimestamp ? now : lastTimestamp + 1
  return lastTimestamp
}

/** Appends an event; never mutates or deletes prior events. Un-completing is an appended 'uncomplete' event, not an edit. */
export async function appendHabitEvent(
  habitId: string,
  localDate: string,
  action: HabitEventAction,
  deviceId: string,
): Promise<HabitEvent> {
  const event: HabitEvent = {
    id: crypto.randomUUID(),
    habitId,
    localDate,
    action,
    timestamp: nextTimestamp(),
    deviceId,
  }
  await db.habitEvents.add(event)
  return event
}

export function eventsForHabit(habitId: string): Promise<HabitEvent[]> {
  return db.habitEvents.where('habitId').equals(habitId).toArray()
}

export function allHabitEvents(): Promise<HabitEvent[]> {
  return db.habitEvents.toArray()
}
