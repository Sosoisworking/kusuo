import { isLater } from '../logic/order'
import { setKeyOf } from '../logic/sessions'
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
  /**
   * Cardio is logged by time, not load. `SessionEvent` has always carried this
   * field; the session flow is the first caller with a value to put in it, so
   * it joins the payload here rather than being written around.
   */
  durationSec?: number
}

/**
 * Appends a logged set. Logging over a set already in that position corrects it
 * — the new event carries the same set id, and the later one wins on replay —
 * and nothing is overwritten.
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

/**
 * The id of the set already at this position, if this device has one there —
 * so logging over it corrects it, and voiding it takes it back. Otherwise a new
 * set, with a new id.
 *
 * The position is still how the session screen addresses a set, which is sound
 * while one device writes. When two devices sync, the screen will address sets
 * by id instead; until then this is the only place the two meet.
 */
async function setIdAt(identity: SetIdentity): Promise<string> {
  const here = await db.sessionEvents
    .where('[localDate+splitDayId]')
    .equals([identity.localDate, identity.splitDayId])
    .filter((e) => e.exerciseId === identity.exerciseId && e.setIndex === identity.setIndex)
    .toArray()
  let latest: SessionEvent | undefined
  for (const e of here) if (!latest || isLater(e, latest)) latest = e
  return latest ? setKeyOf(latest) : crypto.randomUUID()
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
    setId: await setIdAt(identity),
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
