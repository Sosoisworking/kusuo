import { db, type FrequencyType, type Habit, type HabitEvent, type HabitEventAction } from './schema'
import { updateSettings } from './settings'

export interface BackupPayload {
  schemaVersion: number
  exportedAt: number
  habits: Habit[]
  habitEvents: HabitEvent[]
}

const CURRENT_SCHEMA_VERSION = 1

export async function buildBackup(): Promise<BackupPayload> {
  const [habits, habitEvents] = await Promise.all([db.habits.toArray(), db.habitEvents.toArray()])
  return { schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt: Date.now(), habits, habitEvents }
}

export function serializeBackup(payload: BackupPayload): string {
  return JSON.stringify(payload, null, 2)
}

export class InvalidBackupError extends Error {}

const FREQUENCY_TYPES: FrequencyType[] = ['daily', 'weekly']
const EVENT_ACTIONS: HabitEventAction[] = ['complete', 'uncomplete']

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
  const { schemaVersion, exportedAt, habits, habitEvents } = raw as Record<string, unknown>
  if (
    typeof schemaVersion !== 'number' ||
    typeof exportedAt !== 'number' ||
    !Array.isArray(habits) ||
    !Array.isArray(habitEvents) ||
    !habits.every(isHabit) ||
    !habitEvents.every(isHabitEvent)
  ) {
    throw new InvalidBackupError("That file doesn't look like a Kusuo backup.")
  }
  return { schemaVersion, exportedAt, habits, habitEvents }
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

/** Wholesale replace of habits + habitEvents. Settings (incl. deviceId, deviceRole, theme) are never touched. */
export async function importBackup(payload: BackupPayload): Promise<void> {
  await db.transaction('rw', db.habits, db.habitEvents, async () => {
    await db.habits.clear()
    await db.habitEvents.clear()
    if (payload.habits.length > 0) await db.habits.bulkAdd(payload.habits)
    if (payload.habitEvents.length > 0) await db.habitEvents.bulkAdd(payload.habitEvents)
  })
}

export async function recordBackupExported(deviceId: string): Promise<void> {
  await updateSettings(deviceId, { lastBackupAt: Date.now() })
}
