import type { Plan, Routine, Schedule, SessionEvent, SessionMark, Split } from './schema'

export const SCHEDULE_ID = 'schedule' satisfies Schedule['id']

/** What a deleted day is called once it has to be named. Its label went with it. */
export const REMOVED_DAY_NAME = 'Removed day'

export interface ConvertedSplits {
  routines: Routine[]
  plans: Plan[]
  /** Empty when no split was active. */
  schedule: Schedule[]
}

/**
 * Turns splits into plans and routines. The one conversion: the database
 * upgrade and the backup importer both call it, so an old phone and an old
 * file arrive at the same thing.
 *
 * Every row it makes carries stamps from the rows it came from. Stamping them
 * now would make every phone look as if it held work newer than any backup
 * made before the update, and restoring that backup would warn for nothing.
 *
 * Sets and marks are read only to find the days they name that no split still
 * has — a deleted day. Each becomes an archived routine, so every set in the
 * record belongs to a routine. Nothing shows it: the screens list a plan's
 * routines, and an archived one is in no plan.
 */
export function convertSplits(
  splits: readonly Split[],
  sessionEvents: readonly Pick<SessionEvent, 'splitDayId' | 'timestamp'>[],
  sessionMarks: readonly Pick<SessionMark, 'splitDayId' | 'timestamp'>[],
): ConvertedSplits {
  const routines = new Map<string, Routine>()
  const plans: Plan[] = []

  for (const split of splits) {
    for (const day of split.days) {
      // Two splits sharing a day id is not something the app does; if a file
      // brings one, the first definition is kept and both plans use it.
      if (routines.has(day.id)) continue
      routines.set(day.id, {
        id: day.id,
        name: day.label,
        kind: day.kind ?? 'training',
        entries: day.entries.map((entry) => ({
          exerciseId: entry.exerciseId,
          sets: entry.sets,
          repsMin: entry.repsMin,
          repsMax: entry.repsMax,
        })),
        archived: false,
        createdAt: split.createdAt,
        updatedAt: split.updatedAt,
      })
    }
    plans.push({
      id: split.id,
      name: split.name,
      ...(split.seededFrom === undefined ? {} : { seededFrom: split.seededFrom }),
      routineIds: split.days.map((day) => day.id),
      createdAt: split.createdAt,
      updatedAt: split.updatedAt,
    })
  }

  // A deleted day with only a mark against it was most likely a rest day:
  // marking rest writes a mark and no sets. One with sets was trained.
  const orphans = new Map<string, { first: number; last: number; trained: boolean }>()
  const note = (ref: { splitDayId: string; timestamp: number }, trained: boolean) => {
    if (routines.has(ref.splitDayId)) return
    const seen = orphans.get(ref.splitDayId)
    if (!seen) {
      orphans.set(ref.splitDayId, { first: ref.timestamp, last: ref.timestamp, trained })
      return
    }
    seen.first = Math.min(seen.first, ref.timestamp)
    seen.last = Math.max(seen.last, ref.timestamp)
    seen.trained ||= trained
  }
  for (const event of sessionEvents) note(event, true)
  for (const mark of sessionMarks) note(mark, false)
  for (const [id, seen] of orphans) {
    routines.set(id, {
      id,
      name: REMOVED_DAY_NAME,
      kind: seen.trained ? 'training' : 'rest',
      entries: [],
      archived: true,
      createdAt: seen.first,
      updatedAt: seen.last,
    })
  }

  // The screens took the first active split in id order, which is the order
  // the table returns them in. If a file ever held two, the same one wins.
  const active = splits
    .filter((split) => split.isActive)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0]

  return {
    routines: [...routines.values()],
    plans,
    schedule: active
      ? [{ id: SCHEDULE_ID, activePlanId: active.id, updatedAt: active.updatedAt }]
      : [],
  }
}
