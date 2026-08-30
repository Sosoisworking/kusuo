import type { SessionEvent, SessionMark } from '../db/schema'

/** A set that survives replay — the last event for its slot was a 'log'. */
export interface LoggedSet {
  localDate: string
  splitDayId: string
  exerciseId: string
  setIndex: number
  weightKg: number
  reps: number
  rpe?: number
  timestamp: number
}

function slotKey(
  e: Pick<SessionEvent, 'localDate' | 'splitDayId' | 'exerciseId' | 'setIndex'>,
): string {
  return `${e.localDate} ${e.splitDayId} ${e.exerciseId} ${e.setIndex}`
}

/**
 * Replays session events into the sets that are actually live. Set state is
 * never stored: the last event by timestamp for a (date, day, exercise, index)
 * slot wins, and a slot whose last event is a 'void' drops out entirely.
 */
export function liveSets(events: SessionEvent[]): LoggedSet[] {
  const lastBySlot = new Map<string, SessionEvent>()
  for (const e of events) {
    const key = slotKey(e)
    const existing = lastBySlot.get(key)
    if (!existing || e.timestamp > existing.timestamp) lastBySlot.set(key, e)
  }
  const sets: LoggedSet[] = []
  for (const e of lastBySlot.values()) {
    if (e.action !== 'log') continue
    sets.push({
      localDate: e.localDate,
      splitDayId: e.splitDayId,
      exerciseId: e.exerciseId,
      setIndex: e.setIndex,
      weightKg: e.weightKg,
      reps: e.reps,
      rpe: e.rpe,
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
    if (!last || m.timestamp >= last.timestamp) last = m
  }
  return last?.action === 'complete'
}

/** Every date holding at least one finished session. */
export function trainingDates(marks: SessionMark[]): Set<string> {
  const lastByDay = new Map<string, SessionMark>()
  for (const m of marks) {
    const key = `${m.localDate} ${m.splitDayId}`
    const existing = lastByDay.get(key)
    if (!existing || m.timestamp > existing.timestamp) lastByDay.set(key, m)
  }
  const dates = new Set<string>()
  for (const m of lastByDay.values()) {
    if (m.action === 'complete') dates.add(m.localDate)
  }
  return dates
}
