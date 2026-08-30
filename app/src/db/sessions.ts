import { nextTimestamp } from './clock'
import { appendHabitEvent } from './events'
import { db, type SessionEvent, type SessionMark } from './schema'

export interface SetIdentity {
  localDate: string
  splitDayId: string
  exerciseId: string
  setIndex: number
}

export interface SetValues {
  weightKg: number
  reps: number
  rpe?: number
}

/**
 * Appends a logged set. Re-logging the same (date, day, exercise, setIndex)
 * corrects it — the later event wins on replay — and nothing is overwritten.
 */
export async function logSet(
  identity: SetIdentity,
  values: SetValues,
  deviceId: string,
): Promise<SessionEvent> {
  return appendSessionEvent(identity, values, 'log', deviceId)
}

/**
 * Takes a set back out. The voided values travel with the event so the log
 * still reads honestly about what was there before.
 */
export async function voidSet(
  identity: SetIdentity,
  values: SetValues,
  deviceId: string,
): Promise<SessionEvent> {
  return appendSessionEvent(identity, values, 'void', deviceId)
}

async function appendSessionEvent(
  identity: SetIdentity,
  values: SetValues,
  action: SessionEvent['action'],
  deviceId: string,
): Promise<SessionEvent> {
  const event: SessionEvent = {
    id: crypto.randomUUID(),
    ...identity,
    ...values,
    action,
    timestamp: nextTimestamp(),
    deviceId,
  }
  await db.sessionEvents.add(event)
  return event
}

/**
 * Marks the session finished and ticks the training habit for the same date.
 * One tap, two facts — the habit tick is a real HabitEvent so streaks and the
 * habit history stay the single source of truth for "did I train".
 */
export async function finishSession(
  localDate: string,
  splitDayId: string,
  deviceId: string,
  trainingHabitId?: string,
): Promise<SessionMark> {
  const mark = await appendSessionMark(localDate, splitDayId, 'complete', deviceId)
  if (trainingHabitId) {
    await appendHabitEvent(trainingHabitId, localDate, 'complete', deviceId)
  }
  return mark
}

/**
 * Un-finishes a session. Deliberately does *not* un-tick the training habit:
 * reaching across and silently removing a completion the user can see is the
 * kind of hidden write that loses data. They un-tick it themselves.
 */
export async function unfinishSession(
  localDate: string,
  splitDayId: string,
  deviceId: string,
): Promise<SessionMark> {
  return appendSessionMark(localDate, splitDayId, 'uncomplete', deviceId)
}

async function appendSessionMark(
  localDate: string,
  splitDayId: string,
  action: SessionMark['action'],
  deviceId: string,
): Promise<SessionMark> {
  const mark: SessionMark = {
    id: crypto.randomUUID(),
    localDate,
    splitDayId,
    action,
    timestamp: nextTimestamp(),
    deviceId,
  }
  await db.sessionMarks.add(mark)
  return mark
}

export function allSessionEvents(): Promise<SessionEvent[]> {
  return db.sessionEvents.toArray()
}

export function allSessionMarks(): Promise<SessionMark[]> {
  return db.sessionMarks.toArray()
}

export function sessionEventsOnDate(localDate: string): Promise<SessionEvent[]> {
  return db.sessionEvents.where('localDate').equals(localDate).toArray()
}

export function sessionEventsForExercise(exerciseId: string): Promise<SessionEvent[]> {
  return db.sessionEvents.where('exerciseId').equals(exerciseId).toArray()
}
