import type { BodyweightEntry, SessionEvent } from '../db/schema'
import { addDays } from '../lib/date'
import { setsForExercise, volume, type LoggedSet } from './sessions'

/**
 * Epley estimate: weight * (1 + reps / 30). At a single rep the formula
 * overshoots by 3%, so a single is reported as itself — an estimate that
 * inflates a real lift is not a record worth keeping.
 */
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg
  return weightKg * (1 + reps / 30)
}

export interface SessionTotal {
  localDate: string
  splitDayId: string
  volumeKg: number
}

export interface ExerciseRecords {
  /** Heaviest single set. Ties break toward the higher rep count. */
  heaviestSet?: LoggedSet
  /** Set with the highest Epley estimate, and the estimate itself. */
  bestEstimatedOneRepMax?: { set: LoggedSet; oneRepMaxKg: number }
  /** Set with the most weight moved (weight times reps). */
  bestSetVolume?: { set: LoggedSet; volumeKg: number }
  /** Highest reps achieved at each distinct weight, heaviest first. */
  repPrs: { weightKg: number; reps: number }[]
  totalSets: number
}

/**
 * Records are derived by replay, never stored. Voided sets are gone from
 * `setsForExercise` before any of this runs, so a mistyped lift leaves no
 * record behind.
 */
export function exerciseRecords(events: SessionEvent[], exerciseId: string): ExerciseRecords {
  const sets = setsForExercise(events, exerciseId)
  const records: ExerciseRecords = { repPrs: [], totalSets: sets.length }
  if (sets.length === 0) return records

  const repsByWeight = new Map<number, number>()

  for (const set of sets) {
    if (
      !records.heaviestSet ||
      set.weightKg > records.heaviestSet.weightKg ||
      (set.weightKg === records.heaviestSet.weightKg && set.reps > records.heaviestSet.reps)
    ) {
      records.heaviestSet = set
    }

    const oneRepMaxKg = estimatedOneRepMax(set.weightKg, set.reps)
    if (!records.bestEstimatedOneRepMax || oneRepMaxKg > records.bestEstimatedOneRepMax.oneRepMaxKg) {
      records.bestEstimatedOneRepMax = { set, oneRepMaxKg }
    }

    const volumeKg = set.weightKg * set.reps
    if (!records.bestSetVolume || volumeKg > records.bestSetVolume.volumeKg) {
      records.bestSetVolume = { set, volumeKg }
    }

    const best = repsByWeight.get(set.weightKg)
    if (best === undefined || set.reps > best) repsByWeight.set(set.weightKg, set.reps)
  }

  records.repPrs = Array.from(repsByWeight, ([weightKg, reps]) => ({ weightKg, reps })).sort(
    (a, b) => b.weightKg - a.weightKg,
  )
  return records
}

/** Volume per finished session, most recent first. */
export function sessionTotals(sets: LoggedSet[]): SessionTotal[] {
  const bySession = new Map<string, LoggedSet[]>()
  for (const set of sets) {
    const key = `${set.localDate} ${set.splitDayId}`
    const group = bySession.get(key)
    if (group) group.push(set)
    else bySession.set(key, [set])
  }
  return Array.from(bySession.values())
    .map((group) => ({
      localDate: group[0].localDate,
      splitDayId: group[0].splitDayId,
      volumeKg: volume(group),
    }))
    .sort((a, b) => b.localDate.localeCompare(a.localDate))
}

export function bestSessionVolume(sets: LoggedSet[]): SessionTotal | undefined {
  return sessionTotals(sets).reduce<SessionTotal | undefined>(
    (best, s) => (!best || s.volumeKg > best.volumeKg ? s : best),
    undefined,
  )
}

/**
 * Longest run of consecutive dates in a set of completed dates. Used for both
 * "best habit streak" and training consistency, so the two read the same way.
 */
export function bestStreak(completedDates: Set<string>): number {
  let best = 0
  for (const date of completedDates) {
    // Only start counting from the beginning of a run.
    if (completedDates.has(addDays(date, -1))) continue
    let length = 0
    let cursor = date
    while (completedDates.has(cursor)) {
      length += 1
      cursor = addDays(cursor, 1)
    }
    if (length > best) best = length
  }
  return best
}

/** Completions per calendar month, as 'YYYY-MM' keys. */
export function completionsByMonth(completedDates: Set<string>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const date of completedDates) {
    const month = date.slice(0, 7)
    counts.set(month, (counts.get(month) ?? 0) + 1)
  }
  return counts
}

export function bestMonth(completedDates: Set<string>): { month: string; count: number } | undefined {
  let best: { month: string; count: number } | undefined
  for (const [month, count] of completionsByMonth(completedDates)) {
    if (!best || count > best.count || (count === best.count && month < best.month)) {
      best = { month, count }
    }
  }
  return best
}

export interface LiftRecord {
  exerciseId: string
  records: ExerciseRecords
  /** Volume of the single heaviest session this movement appeared in. */
  bestSession: SessionTotal | undefined
}

/**
 * Every movement that has been lifted at least once, heaviest single set first.
 * Ordering by weight rather than by recency puts the lifts you care about at
 * the top without ranking you against anything.
 */
export function liftRecords(events: SessionEvent[]): LiftRecord[] {
  const ids = new Set<string>()
  for (const e of events) ids.add(e.exerciseId)

  const rows: LiftRecord[] = []
  for (const exerciseId of ids) {
    const records = exerciseRecords(events, exerciseId)
    if (records.totalSets === 0 || !records.heaviestSet) continue
    // Cardio and circuits carry no load, so they have no lift record to state.
    if (records.heaviestSet.weightKg <= 0) continue
    rows.push({
      exerciseId,
      records,
      bestSession: bestSessionVolume(setsForExercise(events, exerciseId)),
    })
  }
  return rows.sort(
    (a, b) => (b.records.heaviestSet?.weightKg ?? 0) - (a.records.heaviestSet?.weightKg ?? 0),
  )
}

export interface BodyweightPoint {
  localDate: string
  weightKg: number
}

/**
 * One weigh-in per day, most recent first. Same last-event-wins replay as every
 * other record: correcting a day appends, and the newest entry for that date is
 * the one that counts.
 */
export function bodyweightByDate(entries: BodyweightEntry[]): BodyweightPoint[] {
  const lastByDate = new Map<string, BodyweightEntry>()
  for (const entry of entries) {
    const existing = lastByDate.get(entry.localDate)
    if (!existing || entry.timestamp > existing.timestamp) lastByDate.set(entry.localDate, entry)
  }
  return [...lastByDate.values()]
    .sort((a, b) => b.localDate.localeCompare(a.localDate))
    .map((e) => ({ localDate: e.localDate, weightKg: e.weightKg }))
}

/** Change since the earliest weigh-in, or undefined with fewer than two. */
export function bodyweightChange(points: BodyweightPoint[]): number | undefined {
  if (points.length < 2) return undefined
  return points[0].weightKg - points[points.length - 1].weightKg
}
