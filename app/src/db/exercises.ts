import { EXERCISE_SEED } from '../lib/exerciseSeed'
import { db, type Exercise, type ExerciseCategory, type SessionEvent } from './schema'

/**
 * Brings this device's movement library up to date with the seed: adds any
 * seed movement it is missing, and gives a seeded movement the seed's name if
 * it still holds an older one. Returns how many movements were added.
 *
 * Names follow the seed because nothing else ever writes them — a seeded
 * movement cannot be edited — and its id never changes, because every logged
 * set points at it. So a rename in the seed reaches an installed app on its
 * next launch, and an older backup as soon as it is imported. A custom
 * movement is never touched, and a seeded one whose name already matches is
 * left exactly as it was, timestamps included.
 */
export async function seedExercises(): Promise<number> {
  const existing = new Map((await db.exercises.toArray()).map((row) => [row.id, row]))
  const now = Date.now()
  const missing: Exercise[] = EXERCISE_SEED.filter((s) => !existing.has(s.id)).map((s) => ({
    ...s,
    isCustom: false,
    createdAt: now,
    updatedAt: now,
  }))
  if (missing.length > 0) await db.exercises.bulkAdd(missing)

  for (const seeded of EXERCISE_SEED) {
    const row = existing.get(seeded.id)
    if (row && !row.isCustom && row.name !== seeded.name) {
      await db.exercises.update(seeded.id, { name: seeded.name, updatedAt: now })
    }
  }
  return missing.length
}

export interface CreateExerciseInput {
  name: string
  category: ExerciseCategory
  muscleGroup: string
  equipment: string
  referenceUrl?: string
}

export async function createCustomExercise(input: CreateExerciseInput): Promise<Exercise> {
  const now = Date.now()
  const exercise: Exercise = {
    id: crypto.randomUUID(),
    ...input,
    isCustom: true,
    createdAt: now,
    updatedAt: now,
  }
  await db.exercises.add(exercise)
  return exercise
}

export function listExercises(): Promise<Exercise[]> {
  return db.exercises.toArray()
}

export function getExercise(id: string): Promise<Exercise | undefined> {
  return db.exercises.get(id)
}

export interface ExerciseFilter {
  /** Case-insensitive substring match on name. */
  query?: string
  category?: ExerciseCategory
  muscleGroup?: string
  equipment?: string
  customOnly?: boolean
  /**
   * "Recently used": keep only these ids. Passed in rather than looked up so
   * the filter stays pure and the caller decides what recent means — the
   * directory hands it `recentExerciseIds(events)`.
   */
  recentIds?: readonly string[]
}

export function filterExercises(exercises: Exercise[], filter: ExerciseFilter): Exercise[] {
  const query = filter.query?.trim().toLowerCase()
  const recent = filter.recentIds ? new Set(filter.recentIds) : undefined
  return exercises.filter((x) => {
    if (query && !x.name.toLowerCase().includes(query)) return false
    if (filter.category && x.category !== filter.category) return false
    if (filter.muscleGroup && x.muscleGroup !== filter.muscleGroup) return false
    if (filter.equipment && x.equipment !== filter.equipment) return false
    if (filter.customOnly && !x.isCustom) return false
    if (recent && !recent.has(x.id)) return false
    return true
  })
}

/**
 * Movements the user has actually logged, most recent first.
 *
 * Only `log` events count. A voided set still says the movement was reached
 * for that day, but a set taken back out is usually a mistyped entry, and the
 * cheapest honest rule is "the last time you logged this". Ordering is by the
 * newest event per exercise, so a movement done twenty times last year sits
 * behind one done once yesterday.
 */
export function recentExerciseIds(events: SessionEvent[], limit = 12): string[] {
  const newest = new Map<string, number>()
  for (const e of events) {
    if (e.action !== 'log') continue
    const seen = newest.get(e.exerciseId)
    if (seen === undefined || e.timestamp > seen) newest.set(e.exerciseId, e.timestamp)
  }
  return [...newest.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id)
}
