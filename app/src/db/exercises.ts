import { EXERCISE_SEED } from '../lib/exerciseSeed'
import { db, type Exercise, type ExerciseCategory } from './schema'

/**
 * Adds any seed movements this device is missing. Idempotent and additive:
 * existing rows are left alone, so re-running it after an app update never
 * rewrites timestamps or clobbers a movement the user has already used.
 */
export async function seedExercises(): Promise<number> {
  const existing = new Set(await db.exercises.toCollection().primaryKeys())
  const now = Date.now()
  const missing: Exercise[] = EXERCISE_SEED.filter((s) => !existing.has(s.id)).map((s) => ({
    ...s,
    isCustom: false,
    createdAt: now,
    updatedAt: now,
  }))
  if (missing.length > 0) await db.exercises.bulkAdd(missing)
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
}

export function filterExercises(exercises: Exercise[], filter: ExerciseFilter): Exercise[] {
  const query = filter.query?.trim().toLowerCase()
  return exercises.filter((x) => {
    if (query && !x.name.toLowerCase().includes(query)) return false
    if (filter.category && x.category !== filter.category) return false
    if (filter.muscleGroup && x.muscleGroup !== filter.muscleGroup) return false
    if (filter.equipment && x.equipment !== filter.equipment) return false
    if (filter.customOnly && !x.isCustom) return false
    return true
  })
}
