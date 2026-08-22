import { db, type HabitEvent, type HabitEventAction } from './schema'

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
    timestamp: Date.now(),
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
