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

export type DeviceRole = 'writer' | 'reader'
export type Theme = 'dark' | 'light' | 'system'

export interface Settings {
  deviceId: string
  deviceRole: DeviceRole
  userName?: string
  theme: Theme
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
  }
}

export const db = new KusuoDB()
