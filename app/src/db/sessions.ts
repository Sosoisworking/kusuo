import { isLater } from '../logic/order'
import { setKeyOf } from '../logic/sessions'
import { nextTimestamp } from './clock'
import { isCompleteOnDate } from '../logic/derive'
import { appendHabitEvent } from './events'
import { db, type SessionEvent, type SessionMark, type SplitDayKind } from './schema'

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
 * Marks a session finished and ticks the training habit for the same date.
 * One tap, two facts — the habit tick is a real HabitEvent so streaks and the
 * habit history stay the single source of truth for "did I train".
 *
 * A session can cover several routines done the same day, and finishing it
 * finishes all of them: one mark each, and one tick. A second routine finished
 * later the same day leaves the tick alone rather than stacking another on it.
 *
 * The tick goes only to a habit that is still active. A pointer left at an
 * archived habit would tick something no screen shows.
 */
export async function finishSession(
  localDate: string,
  routineIds: string | readonly string[],
  deviceId: string,
  trainingHabitId?: string,
): Promise<SessionMark[]> {
  const marks: SessionMark[] = []
  for (const id of typeof routineIds === 'string' ? [routineIds] : routineIds) {
    marks.push(await appendSessionMark(localDate, id, 'complete', 'training', deviceId))
  }
  if (trainingHabitId && (await db.habits.get(trainingHabitId))?.isActive) {
    const today = await db.habitEvents
      .where('[habitId+localDate]')
      .equals([trainingHabitId, localDate])
      .toArray()
    if (!isCompleteOnDate(today, trainingHabitId, localDate)) {
      await appendHabitEvent(trainingHabitId, localDate, 'complete', deviceId)
    }
  }
  return marks
}

/**
 * A rest day taken. It still has to be marked, or the schedule sticks on it;
 * but it is not training, so it ticks no habit and counts toward no record.
 */
export async function markRested(
  localDate: string,
  routineId: string,
  deviceId: string,
): Promise<SessionMark> {
  return appendSessionMark(localDate, routineId, 'complete', 'rest', deviceId)
}

/**
 * Un-finishes a session — every routine in it, as finishing finished them all.
 * Deliberately does *not* un-tick the training habit: reaching across and
 * silently removing a completion the user can see is the kind of hidden write
 * that loses data. They un-tick it themselves.
 */
export async function unfinishSession(
  localDate: string,
  routineIds: string | readonly string[],
  deviceId: string,
): Promise<SessionMark[]> {
  const marks: SessionMark[] = []
  for (const id of typeof routineIds === 'string' ? [routineIds] : routineIds) {
    marks.push(await appendSessionMark(localDate, id, 'uncomplete', undefined, deviceId))
  }
  return marks
}

async function appendSessionMark(
  localDate: string,
  splitDayId: string,
  action: SessionMark['action'],
  kind: SplitDayKind | undefined,
  deviceId: string,
): Promise<SessionMark> {
  const mark: SessionMark = {
    id: crypto.randomUUID(),
    localDate,
    splitDayId,
    action,
    ...(kind ? { kind } : {}),
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
