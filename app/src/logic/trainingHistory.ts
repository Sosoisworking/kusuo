import type { SessionMark, Units, WeekStart } from '../db/schema'
import { addDays, startOfWeek } from '../lib/date'
import { weightValue } from '../lib/units'
import { isRestMark, type LoggedSet } from './sessions'
import { isLater } from './order'

/**
 * How a day's sets read on one line. Sets sharing a weight collapse to
 * "45 kg × 8, 8, 7, 7"; a working set that moved read as "92.5 × 6 · 85 × 8",
 * where the unit is carried by the column or tile above rather than repeated
 * four times. Cardio has no load, so it reports its time.
 */
export function summariseSets(sets: LoggedSet[], units: Units, isCardio = false): string {
  if (sets.length === 0) return ''
  if (isCardio) {
    const seconds = sets.reduce((total, s) => total + (s.durationSec ?? 0), 0)
    return seconds > 0 ? `${Math.round(seconds / 60)} min` : `${sets.length} logged`
  }
  const first = sets[0].weightKg
  if (sets.every((s) => s.weightKg === first)) {
    return `${weightValue(first, units)} ${units} × ${sets.map((s) => s.reps).join(', ')}`
  }
  return sets.map((s) => `${weightValue(s.weightKg, units)} × ${s.reps}`).join(' · ')
}

/** A day's worth of sets for one exercise, newest day first. */
export interface DayOfSets {
  localDate: string
  sets: LoggedSet[]
}

/**
 * Groups replayed sets by the calendar day they were logged on, newest first,
 * with each day's sets in set order. This is what "history" means on exercise
 * detail: one line per day, not one line per set.
 */
export function historyByDate(sets: LoggedSet[]): DayOfSets[] {
  const byDate = new Map<string, LoggedSet[]>()
  for (const set of sets) {
    const day = byDate.get(set.localDate)
    if (day) day.push(set)
    else byDate.set(set.localDate, [set])
  }
  return Array.from(byDate, ([localDate, group]) => ({
    localDate,
    sets: [...group].sort((a, b) => a.setIndex - b.setIndex),
  })).sort((a, b) => b.localDate.localeCompare(a.localDate))
}

/**
 * The sets from the most recent day this movement was trained. Used for the
 * "last time 45 kg × 8, 8, 7, 7" line, which is the only prompt the session
 * screen gives — a fact about the last session, not a suggested target.
 */
export function lastSessionSets(sets: LoggedSet[], before?: string): LoggedSet[] {
  const days = historyByDate(sets)
  const day = before ? days.find((d) => d.localDate < before) : days[0]
  return day?.sets ?? []
}

export interface WeekTop {
  /** First day of the week, under the device's week start. */
  weekStart: string
  /** Heaviest single set that week, in kg. Zero when nothing was logged. */
  topKg: number
}

/**
 * Heaviest set per week across the last `weeks` weeks, oldest first, including
 * the weeks with nothing in them. A gap is a gap: it draws as an empty column
 * rather than being closed up, because closing it would draw a rising line
 * through weeks that never happened.
 */
export function topSetWeeks(
  sets: LoggedSet[],
  today: string,
  weeks: number,
  weekStart: WeekStart = 'monday',
): WeekTop[] {
  const topByWeek = new Map<string, number>()
  for (const set of sets) {
    const key = startOfWeek(set.localDate, weekStart)
    const best = topByWeek.get(key)
    if (best === undefined || set.weightKg > best) topByWeek.set(key, set.weightKg)
  }
  const thisWeek = startOfWeek(today, weekStart)
  return Array.from({ length: weeks }, (_, i) => {
    const key = addDays(thisWeek, (i - (weeks - 1)) * 7)
    return { weekStart: key, topKg: topByWeek.get(key) ?? 0 }
  })
}

/** The last date this split day was finished, or undefined if it never was. */
export function lastCompletedDate(marks: SessionMark[], splitDayId: string): string | undefined {
  let latest: string | undefined
  for (const mark of completedMarks(marks)) {
    if (mark.splitDayId !== splitDayId) continue
    if (!latest || mark.localDate > latest) latest = mark.localDate
  }
  return latest
}

export interface FinishedSession {
  localDate: string
  /** Every routine finished that day: one session can cover several. */
  routineIds: string[]
}

/**
 * Finished sessions, newest first, one per day. Un-finishing one takes it back
 * out, and a rest day marked done is not a session.
 */
export function recentSessions(
  marks: SessionMark[],
  limit: number,
  restRoutines: ReadonlySet<string> = new Set(),
): FinishedSession[] {
  const byDate = new Map<string, SessionMark[]>()
  for (const mark of completedMarks(marks)) {
    if (isRestMark(mark, restRoutines)) continue
    const day = byDate.get(mark.localDate)
    if (day) day.push(mark)
    else byDate.set(mark.localDate, [mark])
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, limit)
    .map(([localDate, day]) => ({
      localDate,
      // In the order they were finished, which is the order they were done.
      routineIds: [...day].sort((a, b) => a.timestamp - b.timestamp).map((m) => m.splitDayId),
    }))
}

/** Last-event-wins replay per (date, day) — the same rule habits use. */
function completedMarks(marks: SessionMark[]): SessionMark[] {
  const lastByDay = new Map<string, SessionMark>()
  for (const mark of marks) {
    const key = `${mark.localDate} ${mark.splitDayId}`
    const existing = lastByDay.get(key)
    if (!existing || isLater(mark, existing)) lastByDay.set(key, mark)
  }
  return Array.from(lastByDay.values()).filter((m) => m.action === 'complete')
}
