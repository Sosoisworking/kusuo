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
  targetDate?: string
  isActive: boolean
  createdAt: number
  archivedAt?: number
  updatedAt: number
}

export interface ReflectionEntry {
  id: string
  /** 'YYYY-MM-DD', device-local calendar date. Editing appends a new entry for the same date; last event wins. */
  localDate: string
  text: string
  timestamp: number
  deviceId: string
}

export type ExerciseCategory = 'push' | 'pull' | 'legs' | 'abs'

export interface Exercise {
  id: string
  name: string
  category: ExerciseCategory
  muscleGroup: string
  equipment: string
  /** Reference page for the movement. Seeded set points at ExRx.net; no affiliation implied. */
  referenceUrl?: string
  isCustom: boolean
  createdAt: number
  updatedAt: number
}

export interface SplitEntry {
  exerciseId: string
  sets: number
  reps: number
}

export interface SplitDay {
  id: string
  label: string
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
  /** Always kilograms. Display converts; storage does not. */
  weightKg: number
  reps: number
  rpe?: number
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
  }
}

export const db = new KusuoDB()
