import Dexie, { type EntityTable } from 'dexie'

export type FrequencyType = 'daily' | 'weekly'

export interface Habit {
  id: string
  name: string
  description?: string
  category?: string
  frequencyType: FrequencyType
  /** For 'weekly': times per week. For 'daily': unused (kept as 1 for clarity). */
  frequencyValue: number
  isActive: boolean
  createdAt: number
  archivedAt?: number
  updatedAt: number
}

export type HabitEventAction = 'complete' | 'uncomplete'

export interface HabitEvent {
  id: string
  habitId: string
  /** 'YYYY-MM-DD', device-local calendar date. */
  localDate: string
  action: HabitEventAction
  timestamp: number
  deviceId: string
}

export interface Goal {
  id: string
  title: string
  description?: string
  /** 'YYYY-MM-DD'. What you are aiming at, not a deadline the app enforces. */
  targetDate?: string
  /**
   * When it was reached. Distinct from archivedAt, which means put away —
   * a goal you abandoned and a goal you finished are not the same fact, and
   * only the finished one belongs in Records.
   */
  completedAt?: number
  isActive: boolean
  createdAt: number
  archivedAt?: number
  updatedAt: number
}

export interface ReflectionEntry {
  id: string
  /** 'YYYY-MM-DD', device-local calendar date. Editing appends a new entry for the same date; last event wins. */
  localDate: string
  /** The free note. Kept as the first field so entries written before the
   *  prompts existed still read back whole. */
  text: string
  /** 1–5. Absent means not answered — which is different from a low score. */
  energy?: number
  mood?: number
  wentWell?: string
  gotInTheWay?: string
  timestamp: number
  deviceId: string
}

export type ExerciseCategory = 'push' | 'pull' | 'legs' | 'abs' | 'cardio'

export interface CircuitStep {
  name: string
  reps: number
}

/**
 * A circuit is not one movement — it is a named round of several, repeated for
 * a fixed time. The rounds are reference you read between sets, not something
 * to log rep by rep, so the circuit is logged by time like any other cardio and
 * carries its own shape for display.
 */
export interface Circuit {
  durationMin: number
  /** e.g. "1 min break after every 2 rounds". */
  restNote: string
  steps: CircuitStep[]
}

export interface Exercise {
  id: string
  name: string
  category: ExerciseCategory
  muscleGroup: string
  equipment: string
  /** Reference page for the movement. Seeded set points at ExRx.net; no affiliation implied. */
  referenceUrl?: string
  /** Present only on circuits, which are always category 'cardio'. */
  circuit?: Circuit
  isCustom: boolean
  createdAt: number
  updatedAt: number
}

export interface SplitEntry {
  exerciseId: string
  sets: number
  /**
   * Rep target as a range. A fixed target is the same number twice — real
   * programmes are written "3 × 6-8", and flattening that to a single number
   * throws away the part that tells you when to add weight.
   */
  repsMin: number
  repsMax: number
}

/**
 * A rest day is a day in the cycle, not a gap between days. Keeping it means
 * "next up" can say you are resting instead of naming a session you are not
 * due to do.
 */
export type SplitDayKind = 'training' | 'rest'

export interface SplitDay {
  id: string
  label: string
  kind: SplitDayKind
  entries: SplitEntry[]
}

export interface Split {
  id: string
  name: string
  days: SplitDay[]
  /** Template this was seeded from, so "your copy of PPL" stays traceable after edits. */
  seededFrom?: string
  isActive: boolean
  createdAt: number
  updatedAt: number
}

export type SessionEventAction = 'log' | 'void'

/**
 * One logged set. Append-only: correcting a set appends a new 'log' for the
 * same (localDate, splitDayId, exerciseId, setIndex); removing one appends a
 * 'void'. Nothing is ever mutated, so a mistyped 200kg bench can be taken back
 * out of the records without erasing that it happened.
 */
export interface SessionEvent {
  id: string
  /** 'YYYY-MM-DD', device-local calendar date — the calendar and the Fitness tick are calendar-day questions, not UTC instants. */
  localDate: string
  splitDayId: string
  exerciseId: string
  setIndex: number
  /** Always kilograms. Display converts; storage does not. Zero for cardio. */
  weightKg: number
  reps: number
  rpe?: number
  /** Cardio is logged by time; lifts leave this unset. */
  durationSec?: number
  action: SessionEventAction
  timestamp: number
  deviceId: string
}

export type SessionMarkAction = 'complete' | 'uncomplete'

/** "Session finished" for a date — append-only, same shape rule as HabitEvent. */
export interface SessionMark {
  id: string
  localDate: string
  splitDayId: string
  action: SessionMarkAction
  timestamp: number
  deviceId: string
}

export type DeviceRole = 'writer' | 'reader'
export type Theme = 'dark' | 'light' | 'system'
export type Units = 'kg' | 'lb'
export type WeekStart = 'monday' | 'sunday'

export interface Settings {
  deviceId: string
  deviceRole: DeviceRole
  userName?: string
  theme: Theme
  units: Units
  weekStart: WeekStart
  /**
   * The habit that finishing a training session ticks off. An explicit pointer,
   * not a name match: template ids are not habit ids, and the habit can be
   * renamed or archived.
   */
  trainingHabitId?: string
  /** Sets a movement gets when it is added to a day from the directory. */
  defaultSets: number
  lastBackupAt?: number
  schemaVersion: number
  onboardingComplete: boolean
}

export class KusuoDB extends Dexie {
  habits!: EntityTable<Habit, 'id'>
  habitEvents!: EntityTable<HabitEvent, 'id'>
  settings!: EntityTable<Settings, 'deviceId'>
  goals!: EntityTable<Goal, 'id'>
  reflections!: EntityTable<ReflectionEntry, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  splits!: EntityTable<Split, 'id'>
  sessionEvents!: EntityTable<SessionEvent, 'id'>
  sessionMarks!: EntityTable<SessionMark, 'id'>

  constructor(name = 'kusuo') {
    super(name)
    this.version(1).stores({
      habits: 'id, isActive, archivedAt',
      habitEvents: 'id, habitId, localDate, [habitId+localDate], timestamp',
      settings: 'deviceId',
    })
    this.version(2).stores({
      goals: 'id, isActive, archivedAt',
      reflections: 'id, localDate, timestamp',
    })
    this.version(3)
      .stores({
        exercises: 'id, category, isCustom',
        splits: 'id, isActive',
        sessionEvents: 'id, localDate, exerciseId, splitDayId, [localDate+splitDayId], timestamp',
        sessionMarks: 'id, localDate, timestamp',
      })
      .upgrade((tx) =>
        // Backfill the two new required Settings fields on existing devices.
        // Additive only — no user data is rewritten or dropped.
        tx
          .table<Settings, string>('settings')
          .toCollection()
          .modify((s) => {
            s.units ??= 'kg'
            s.weekStart ??= 'monday'
          }),
      )
    this.version(4).upgrade((tx) =>
      // Splits hold their days and entries inline, so the migration rewrites
      // the rows rather than adding an index. A fixed rep target becomes a
      // range of itself, and every existing day is a training day — nothing
      // is dropped and nothing needs the user's attention.
      tx
        .table<Split, string>('splits')
        .toCollection()
        .modify((split) => {
          for (const day of split.days) {
            day.kind ??= 'training'
            for (const entry of day.entries as (SplitEntry & { reps?: number })[]) {
              if (entry.repsMin === undefined) entry.repsMin = entry.reps ?? 0
              if (entry.repsMax === undefined) entry.repsMax = entry.reps ?? 0
              delete entry.reps
            }
          }
        }),
    )
    // Goals gain a description and a completion date. Additive: existing
    // goals keep every field they had, and an unfinished goal simply has no
    // completedAt.
    this.version(5).stores({ goals: 'id, isActive, archivedAt, completedAt' })
    // Reflections gain prompts. Additive and unindexed: an entry written before
    // them simply has none, and its free note still reads back whole.
    this.version(6)
    // Circuits. Additive and unindexed — an exercise without one is unchanged.
    this.version(7)
    // A default set count, backfilled to the 3 the directory used to hard-code.
    this.version(8).upgrade((tx) =>
      tx
        .table<Settings, string>('settings')
        .toCollection()
        .modify((s) => {
          s.defaultSets ??= 3
        }),
    )
  }
}

export const db = new KusuoDB()
