import {
  db,
  type Exercise,
  type ExerciseCategory,
  type FrequencyType,
  type Goal,
  type Habit,
  type HabitEvent,
  type HabitEventAction,
  type ReflectionEntry,
  type SessionEvent,
  type SessionEventAction,
  type SessionMark,
  type SessionMarkAction,
  type Split,
  type SplitDay,
  type SplitDayKind,
  type SplitEntry,
} from './schema'
import { updateSettings } from './settings'

export interface BackupPayload {
  schemaVersion: number
  exportedAt: number
  habits: Habit[]
  habitEvents: HabitEvent[]
  goals: Goal[]
  reflections: ReflectionEntry[]
  exercises: Exercise[]
  splits: Split[]
  sessionEvents: SessionEvent[]
  sessionMarks: SessionMark[]
}

/**
 * 1 — habits, events, goals, reflections.
 * 2 — adds the training tables. A version 1 file still imports: the training
 *     arrays are absent, which means empty, not invalid.
 * 3 — split entries carry a rep range and days carry a kind. A version 2 file
 *     still imports: a fixed `reps` becomes a range of itself and every day is
 *     a training day, the same conversion the Dexie v4 upgrade performs.
 */
const CURRENT_SCHEMA_VERSION = 3

export async function buildBackup(): Promise<BackupPayload> {
  const [habits, habitEvents, goals, reflections, exercises, splits, sessionEvents, sessionMarks] =
    await Promise.all([
      db.habits.toArray(),
      db.habitEvents.toArray(),
      db.goals.toArray(),
      db.reflections.toArray(),
      db.exercises.toArray(),
      db.splits.toArray(),
      db.sessionEvents.toArray(),
      db.sessionMarks.toArray(),
    ])
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    habits,
    habitEvents,
    goals,
    reflections,
    exercises,
    splits,
    sessionEvents,
    sessionMarks,
  }
}

export function serializeBackup(payload: BackupPayload): string {
  return JSON.stringify(payload, null, 2)
}

export class InvalidBackupError extends Error {}

const FREQUENCY_TYPES: FrequencyType[] = ['daily', 'weekly']
const EVENT_ACTIONS: HabitEventAction[] = ['complete', 'uncomplete']
const EXERCISE_CATEGORIES: ExerciseCategory[] = ['push', 'pull', 'legs', 'abs', 'cardio']
const SESSION_EVENT_ACTIONS: SessionEventAction[] = ['log', 'void']
const SESSION_MARK_ACTIONS: SessionMarkAction[] = ['complete', 'uncomplete']

function isHabit(x: unknown): x is Habit {
  if (typeof x !== 'object' || x === null) return false
  const h = x as Record<string, unknown>
  return (
    typeof h.id === 'string' &&
    typeof h.name === 'string' &&
    FREQUENCY_TYPES.includes(h.frequencyType as FrequencyType) &&
    typeof h.frequencyValue === 'number' &&
    typeof h.isActive === 'boolean' &&
    typeof h.createdAt === 'number' &&
    typeof h.updatedAt === 'number' &&
    (h.archivedAt === undefined || typeof h.archivedAt === 'number') &&
    (h.description === undefined || typeof h.description === 'string') &&
    (h.category === undefined || typeof h.category === 'string')
  )
}

function isHabitEvent(x: unknown): x is HabitEvent {
  if (typeof x !== 'object' || x === null) return false
  const e = x as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    typeof e.habitId === 'string' &&
    typeof e.localDate === 'string' &&
    EVENT_ACTIONS.includes(e.action as HabitEventAction) &&
    typeof e.timestamp === 'number' &&
    typeof e.deviceId === 'string'
  )
}

function isGoal(x: unknown): x is Goal {
  if (typeof x !== 'object' || x === null) return false
  const g = x as Record<string, unknown>
  return (
    typeof g.id === 'string' &&
    typeof g.title === 'string' &&
    typeof g.isActive === 'boolean' &&
    typeof g.createdAt === 'number' &&
    typeof g.updatedAt === 'number' &&
    (g.archivedAt === undefined || typeof g.archivedAt === 'number') &&
    (g.targetDate === undefined || typeof g.targetDate === 'string') &&
    (g.description === undefined || typeof g.description === 'string') &&
    (g.completedAt === undefined || typeof g.completedAt === 'number')
  )
}

function isReflectionEntry(x: unknown): x is ReflectionEntry {
  if (typeof x !== 'object' || x === null) return false
  const r = x as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.localDate === 'string' &&
    typeof r.text === 'string' &&
    typeof r.timestamp === 'number' &&
    typeof r.deviceId === 'string' &&
    (r.energy === undefined || typeof r.energy === 'number') &&
    (r.mood === undefined || typeof r.mood === 'number') &&
    (r.wentWell === undefined || typeof r.wentWell === 'string') &&
    (r.gotInTheWay === undefined || typeof r.gotInTheWay === 'string')
  )
}

function isCircuit(x: unknown): boolean {
  if (typeof x !== 'object' || x === null) return false
  const c = x as Record<string, unknown>
  return (
    typeof c.durationMin === 'number' &&
    typeof c.restNote === 'string' &&
    Array.isArray(c.steps) &&
    c.steps.every((s) => {
      if (typeof s !== 'object' || s === null) return false
      const step = s as Record<string, unknown>
      return typeof step.name === 'string' && typeof step.reps === 'number'
    })
  )
}

function isExercise(x: unknown): x is Exercise {
  if (typeof x !== 'object' || x === null) return false
  const e = x as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    typeof e.name === 'string' &&
    EXERCISE_CATEGORIES.includes(e.category as ExerciseCategory) &&
    typeof e.muscleGroup === 'string' &&
    typeof e.equipment === 'string' &&
    typeof e.isCustom === 'boolean' &&
    typeof e.createdAt === 'number' &&
    typeof e.updatedAt === 'number' &&
    (e.referenceUrl === undefined || typeof e.referenceUrl === 'string') &&
    (e.circuit === undefined || isCircuit(e.circuit))
  )
}

/** Accepts both shapes: schema 3's rep range, and schema 2's fixed `reps`. */
function isSplitEntry(x: unknown): boolean {
  if (typeof x !== 'object' || x === null) return false
  const s = x as Record<string, unknown>
  if (typeof s.exerciseId !== 'string' || typeof s.sets !== 'number') return false
  const ranged = typeof s.repsMin === 'number' && typeof s.repsMax === 'number'
  return ranged || typeof s.reps === 'number'
}

function isSplitDay(x: unknown): boolean {
  if (typeof x !== 'object' || x === null) return false
  const d = x as Record<string, unknown>
  return (
    typeof d.id === 'string' &&
    typeof d.label === 'string' &&
    (d.kind === undefined || d.kind === 'training' || d.kind === 'rest') &&
    Array.isArray(d.entries) &&
    d.entries.every(isSplitEntry)
  )
}

/**
 * Brings a validated split up to the current shape. Done at parse time so the
 * rest of the app never sees a legacy row, and so an old export and a fresh one
 * import to exactly the same thing.
 */
function normaliseSplit(raw: unknown): Split {
  const s = raw as Split & { days: (SplitDay & { kind?: SplitDayKind })[] }
  return {
    ...s,
    days: s.days.map((day) => ({
      ...day,
      kind: day.kind ?? 'training',
      entries: day.entries.map((entry) => {
        const legacy = entry as SplitEntry & { reps?: number }
        return {
          exerciseId: legacy.exerciseId,
          sets: legacy.sets,
          repsMin: legacy.repsMin ?? legacy.reps ?? 0,
          repsMax: legacy.repsMax ?? legacy.reps ?? 0,
        }
      }),
    })),
  }
}

function isSplit(x: unknown): x is Split {
  if (typeof x !== 'object' || x === null) return false
  const s = x as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    Array.isArray(s.days) &&
    s.days.every(isSplitDay) &&
    typeof s.isActive === 'boolean' &&
    typeof s.createdAt === 'number' &&
    typeof s.updatedAt === 'number' &&
    (s.seededFrom === undefined || typeof s.seededFrom === 'string')
  )
}

function isSessionEvent(x: unknown): x is SessionEvent {
  if (typeof x !== 'object' || x === null) return false
  const e = x as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    typeof e.localDate === 'string' &&
    typeof e.splitDayId === 'string' &&
    typeof e.exerciseId === 'string' &&
    typeof e.setIndex === 'number' &&
    typeof e.weightKg === 'number' &&
    typeof e.reps === 'number' &&
    SESSION_EVENT_ACTIONS.includes(e.action as SessionEventAction) &&
    typeof e.timestamp === 'number' &&
    typeof e.deviceId === 'string' &&
    (e.rpe === undefined || typeof e.rpe === 'number')
  )
}

function isSessionMark(x: unknown): x is SessionMark {
  if (typeof x !== 'object' || x === null) return false
  const m = x as Record<string, unknown>
  return (
    typeof m.id === 'string' &&
    typeof m.localDate === 'string' &&
    typeof m.splitDayId === 'string' &&
    SESSION_MARK_ACTIONS.includes(m.action as SessionMarkAction) &&
    typeof m.timestamp === 'number' &&
    typeof m.deviceId === 'string'
  )
}

/** Parses and structurally validates a backup file. Throws InvalidBackupError on any malformed shape. */
export function parseBackup(json: string): BackupPayload {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new InvalidBackupError('That file is not valid JSON.')
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new InvalidBackupError("That file doesn't look like a Kusuo backup.")
  }
  const {
    schemaVersion,
    exportedAt,
    habits,
    habitEvents,
    goals,
    reflections,
    exercises,
    splits,
    sessionEvents,
    sessionMarks,
  } = raw as Record<string, unknown>
  // Every table after habits is optional on the wire, for backward
  // compatibility with backups exported before it existed; absent means empty,
  // not invalid. Present-but-malformed is still rejected outright.
  const goalsArr = goals === undefined ? [] : goals
  const reflectionsArr = reflections === undefined ? [] : reflections
  const exercisesArr = exercises === undefined ? [] : exercises
  const splitsArr = splits === undefined ? [] : splits
  const sessionEventsArr = sessionEvents === undefined ? [] : sessionEvents
  const sessionMarksArr = sessionMarks === undefined ? [] : sessionMarks
  if (
    typeof schemaVersion !== 'number' ||
    typeof exportedAt !== 'number' ||
    !Array.isArray(habits) ||
    !Array.isArray(habitEvents) ||
    !Array.isArray(goalsArr) ||
    !Array.isArray(reflectionsArr) ||
    !Array.isArray(exercisesArr) ||
    !Array.isArray(splitsArr) ||
    !Array.isArray(sessionEventsArr) ||
    !Array.isArray(sessionMarksArr) ||
    !habits.every(isHabit) ||
    !habitEvents.every(isHabitEvent) ||
    !goalsArr.every(isGoal) ||
    !reflectionsArr.every(isReflectionEntry) ||
    !exercisesArr.every(isExercise) ||
    !splitsArr.every(isSplit) ||
    !sessionEventsArr.every(isSessionEvent) ||
    !sessionMarksArr.every(isSessionMark)
  ) {
    throw new InvalidBackupError("That file doesn't look like a Kusuo backup.")
  }
  return {
    schemaVersion,
    exportedAt,
    habits,
    habitEvents,
    goals: goalsArr,
    reflections: reflectionsArr,
    exercises: exercisesArr,
    splits: splitsArr.map(normaliseSplit),
    sessionEvents: sessionEventsArr,
    sessionMarks: sessionMarksArr,
  }
}

/**
 * True when this device already holds writes newer than the backup being
 * imported — importing would silently discard them. Callers should surface
 * this as an explicit warning, not a silent no-op or auto-skip.
 */
export async function isReverseImport(payload: BackupPayload): Promise<boolean> {
  const events = await db.habitEvents.toArray()
  const latestLocal = events.reduce((max, e) => Math.max(max, e.timestamp), 0)
  return latestLocal > payload.exportedAt
}

/**
 * Wholesale replace of every user table. Settings (incl. deviceId, deviceRole,
 * theme, units) are never touched — they describe this device, not the record.
 *
 * Importing a version 1 file empties the exercise table; `seedExercises()` on
 * next launch refills the directory, so the movements come back even though the
 * old file never carried them.
 */
export async function importBackup(payload: BackupPayload): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.habits,
      db.habitEvents,
      db.goals,
      db.reflections,
      db.exercises,
      db.splits,
      db.sessionEvents,
      db.sessionMarks,
    ],
    async () => {
      await db.habits.clear()
      await db.habitEvents.clear()
      await db.goals.clear()
      await db.reflections.clear()
      await db.exercises.clear()
      await db.splits.clear()
      await db.sessionEvents.clear()
      await db.sessionMarks.clear()
      if (payload.habits.length > 0) await db.habits.bulkAdd(payload.habits)
      if (payload.habitEvents.length > 0) await db.habitEvents.bulkAdd(payload.habitEvents)
      if (payload.goals.length > 0) await db.goals.bulkAdd(payload.goals)
      if (payload.reflections.length > 0) await db.reflections.bulkAdd(payload.reflections)
      if (payload.exercises.length > 0) await db.exercises.bulkAdd(payload.exercises)
      if (payload.splits.length > 0) await db.splits.bulkAdd(payload.splits)
      if (payload.sessionEvents.length > 0) await db.sessionEvents.bulkAdd(payload.sessionEvents)
      if (payload.sessionMarks.length > 0) await db.sessionMarks.bulkAdd(payload.sessionMarks)
    },
  )
}

export async function recordBackupExported(deviceId: string): Promise<void> {
  await updateSettings(deviceId, { lastBackupAt: Date.now() })
}
