import type { SessionEvent, SessionMark } from '../db/schema'
import { isLater } from './order'

/** A set that survives replay — the last event for its set was a 'log'. */
export interface LoggedSet {
  /** The set's identity: its id, or its slot for a set logged before ids existed. */
  setId: string
  localDate: string
  splitDayId: string
  exerciseId: string
  setIndex: number
  weightKg: number
  reps: number
  rpe?: number
  /** Set only for cardio, which is logged by time rather than by load. */
  durationSec?: number
  timestamp: number
}

function slotKey(
  e: Pick<SessionEvent, 'localDate' | 'splitDayId' | 'exerciseId' | 'setIndex'>,
): string {
  return `${e.localDate} ${e.splitDayId} ${e.exerciseId} ${e.setIndex}`
}

/**
 * The set an event belongs to: its own id, or for an event written before sets
 * had ids, the slot it was logged in. A correction to an old set carries that
 * slot key as its id, so the two still meet on replay.
 */
export function setKeyOf(
  e: Pick<SessionEvent, 'setId' | 'localDate' | 'splitDayId' | 'exerciseId' | 'setIndex'>,
): string {
  return e.setId ?? slotKey(e)
}

/**
 * Replays session events into the sets that are actually live. Set state is
 * never stored: the last event for each set wins — by timestamp, then deviceId —
 * and a set whose last event is a 'void' drops out entirely.
 */
export function liveSets(events: SessionEvent[]): LoggedSet[] {
  const lastBySlot = new Map<string, SessionEvent>()
  for (const e of events) {
    const key = setKeyOf(e)
    const existing = lastBySlot.get(key)
    if (!existing || isLater(e, existing)) lastBySlot.set(key, e)
  }
  const sets: LoggedSet[] = []
  for (const e of lastBySlot.values()) {
    if (e.action !== 'log') continue
    sets.push({
      setId: setKeyOf(e),
      localDate: e.localDate,
      splitDayId: e.splitDayId,
      exerciseId: e.exerciseId,
      setIndex: e.setIndex,
      weightKg: e.weightKg,
      reps: e.reps,
      rpe: e.rpe,
      durationSec: e.durationSec,
      timestamp: e.timestamp,
    })
  }
  return sets.sort(
    (a, b) =>
      a.localDate.localeCompare(b.localDate) ||
      a.exerciseId.localeCompare(b.exerciseId) ||
      a.setIndex - b.setIndex,
  )
}

export function setsOnDate(events: SessionEvent[], localDate: string): LoggedSet[] {
  return liveSets(events.filter((e) => e.localDate === localDate))
}

export function setsForExercise(events: SessionEvent[], exerciseId: string): LoggedSet[] {
  return liveSets(events.filter((e) => e.exerciseId === exerciseId))
}

/** Total weight moved: the sum of weight times reps, in kg. */
export function volume(sets: LoggedSet[]): number {
  return sets.reduce((total, s) => total + s.weightKg * s.reps, 0)
}

/** Replayed "is this session finished" — same last-event-wins rule as habits. */
export function isSessionComplete(
  marks: SessionMark[],
  localDate: string,
  splitDayId: string,
): boolean {
  let last: SessionMark | undefined
  for (const m of marks) {
    if (m.localDate !== localDate || m.splitDayId !== splitDayId) continue
    if (!last || isLater(m, last)) last = m
  }
  return last?.action === 'complete'
}

/** The marks that stand: for each date and routine, the latest, if it says finished. */
export function finishedMarks(marks: SessionMark[]): SessionMark[] {
  const lastByDay = new Map<string, SessionMark>()
  for (const m of marks) {
    const key = `${m.localDate} ${m.splitDayId}`
    const existing = lastByDay.get(key)
    if (!existing || isLater(m, existing)) lastByDay.set(key, m)
  }
  return [...lastByDay.values()].filter((m) => m.action === 'complete')
}

/**
 * Whether a finished mark records a rest day rather than training. A mark says
 * so itself since S1b; an older one is judged by its routine's kind now.
 */
export function isRestMark(mark: SessionMark, restRoutines: ReadonlySet<string>): boolean {
  return mark.kind ? mark.kind === 'rest' : restRoutines.has(mark.splitDayId)
}

/**
 * Every date holding at least one finished training session. A rest day marked
 * done is part of the plan, not training: it used to count here, so the
 * calendar showed rested days as trained and Share offered them as sessions.
 */
export function trainingDates(
  marks: SessionMark[],
  restRoutines: ReadonlySet<string> = new Set(),
): Set<string> {
  const dates = new Set<string>()
  for (const m of finishedMarks(marks)) {
    if (!isRestMark(m, restRoutines)) dates.add(m.localDate)
  }
  return dates
}

/**
 * The routines with work on a date: a set that survived replay, or the routine
 * marked done. This is what decides the day's session once it is under way.
 */
export function workedOn(events: SessionEvent[], marks: SessionMark[], localDate: string): Set<string> {
  const worked = new Set(setsOnDate(events, localDate).map((s) => s.splitDayId))
  for (const m of finishedMarks(marks)) if (m.localDate === localDate) worked.add(m.splitDayId)
  return worked
}

export interface DayExercise {
  exerciseId: string
  sets: LoggedSet[]
  volumeKg: number
}

/**
 * A day's training, grouped by movement in the order it was first logged.
 * Reads back as "what you did" rather than as a flat list of sets.
 */
export function dayBreakdown(events: SessionEvent[], localDate: string): DayExercise[] {
  const sets = setsOnDate(events, localDate)
  const byExercise = new Map<string, LoggedSet[]>()
  for (const set of sets.sort((a, b) => a.timestamp - b.timestamp)) {
    const group = byExercise.get(set.exerciseId)
    if (group) group.push(set)
    else byExercise.set(set.exerciseId, [set])
  }
  return [...byExercise.entries()].map(([exerciseId, group]) => ({
    exerciseId,
    sets: [...group].sort((a, b) => a.setIndex - b.setIndex),
    volumeKg: volume(group),
  }))
}
