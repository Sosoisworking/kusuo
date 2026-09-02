import { seedExercises } from './exercises'
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
  type BodyweightEntry,
  type SessionMark,
  type SessionMarkAction,
  type Split,
  type SplitDay,
  type SplitDayKind,
  type SplitEntry,
  type Units,
  type WeekStart,
} from './schema'
import {
  applyRecordPreferences,
  getOrCreateDeviceId,
  getSettings,
  recordPreferences,
  updateSettings,
  type RecordPreferences,
} from './settings'
import { recordTableNames, recordTables } from './tables'

export interface BackupPayload {
  schemaVersion: number
  exportedAt: number
  /**
   * The preferences that belong to the record. Absent in files written before
   * version 5, which means "this device keeps its own" — not invalid.
   */
  preferences?: RecordPreferences
  habits: Habit[]
  habitEvents: HabitEvent[]
  goals: Goal[]
  reflections: ReflectionEntry[]
  exercises: Exercise[]
  splits: Split[]
  sessionEvents: SessionEvent[]
  sessionMarks: SessionMark[]
  bodyweight: BodyweightEntry[]
  /**
   * A table this build has not been told about travels through untouched. The
   * parser used to rebuild its result from a hand-written list of names, which
   * dropped anything not on it — the same bug tables.ts was written to end.
   */
  [table: string]: unknown
}

/**
 * 1 — habits, events, goals, reflections.
 * 2 — adds the training tables. A version 1 file still imports: the training
 *     arrays are absent, which means empty, not invalid.
 * 3 — split entries carry a rep range and days carry a kind. A version 2 file
 *     still imports: a fixed `reps` becomes a range of itself and every day is
 *     a training day, the same conversion the Dexie v4 upgrade performs.
 * 4 — adds bodyweight. Absent means none recorded, not invalid.
 * 5 — carries the preferences that belong to the record: your name, units,
 *     week start, default sets, and which habit a finished session ticks. A
 *     version 4 file still imports and leaves this device's own in place.
 *
 * Older files import. Newer ones are refused: a file from a build this one has
 * never seen may carry tables and fields it cannot round-trip, and importing it
 * would quietly replace the record with less than the file held.
 */
const CURRENT_SCHEMA_VERSION = 5

export async function buildBackup(): Promise<BackupPayload> {
  const tables = recordTables()
  const rows = await Promise.all(tables.map((table) => table.toArray()))
  const record = Object.fromEntries(tables.map((table, i) => [table.name, rows[i]]))
  const settings = await getSettings(getOrCreateDeviceId())
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    // Never deviceId, deviceRole or theme: those describe the phone, and a
    // file that carried them could let the Mac import itself into being the
    // writer.
    preferences: settings ? recordPreferences(settings) : undefined,
    ...record,
  } as BackupPayload
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
const UNITS: Units[] = ['kg', 'lb']
const WEEK_STARTS: WeekStart[] = ['monday', 'sunday']

function isPreferences(x: unknown): x is RecordPreferences {
  if (typeof x !== 'object' || x === null) return false
  const p = x as Record<string, unknown>
  return (
    UNITS.includes(p.units as Units) &&
    WEEK_STARTS.includes(p.weekStart as WeekStart) &&
    // Bounded, not merely numeric: this is the one field the version gate lets
    // through to be written straight into settings, and a split entry built
    // from a hostile `1e9` asks the session screen to render a billion rows.
    Number.isInteger(p.defaultSets) &&
    (p.defaultSets as number) >= 1 &&
    (p.defaultSets as number) <= 10 &&
    (p.userName === undefined || typeof p.userName === 'string') &&
    (p.trainingHabitId === undefined || typeof p.trainingHabitId === 'string')
  )
}

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

function isBodyweight(x: unknown): x is BodyweightEntry {
  if (typeof x !== 'object' || x === null) return false
  const b = x as Record<string, unknown>
  return (
    typeof b.id === 'string' &&
    typeof b.localDate === 'string' &&
    typeof b.weightKg === 'number' &&
    typeof b.timestamp === 'number' &&
    typeof b.deviceId === 'string'
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

/**
 * How each table on the wire is checked. Keyed by table name so the parser asks
 * the same question of every table rather than naming them one by one — a table
 * added to the schema and forgotten here is carried through unvalidated, which
 * is a far smaller failure than being silently dropped between the file and the
 * database.
 */
const ROW_VALIDATORS: Record<string, (row: unknown) => boolean> = {
  habits: isHabit,
  habitEvents: isHabitEvent,
  goals: isGoal,
  reflections: isReflectionEntry,
  exercises: isExercise,
  splits: isSplit,
  sessionEvents: isSessionEvent,
  sessionMarks: isSessionMark,
  bodyweight: isBodyweight,
}

/** The two tables every version of the format has had. Absent means malformed. */
const REQUIRED_TABLES = ['habits', 'habitEvents']

/** Parses and structurally validates a backup file. Throws InvalidBackupError on any malformed shape. */
export function parseBackup(json: string): BackupPayload {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new InvalidBackupError('That file is not valid JSON.')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new InvalidBackupError("That file doesn't look like a Kusuo backup.")
  }
  const raw = parsed as Record<string, unknown>
  const { schemaVersion, exportedAt, preferences } = raw

  if (typeof schemaVersion !== 'number' || typeof exportedAt !== 'number') {
    throw new InvalidBackupError("That file doesn't look like a Kusuo backup.")
  }
  // A file from a build this one has never seen may hold tables and fields it
  // cannot round-trip. Importing it would replace the record with less than the
  // file carried, under a success message — so it is refused, and says why.
  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new InvalidBackupError(
      'That backup was written by a newer version of Kusuo. Update this device first.',
    )
  }
  if (preferences !== undefined && !isPreferences(preferences)) {
    throw new InvalidBackupError("That file doesn't look like a Kusuo backup.")
  }
  for (const name of REQUIRED_TABLES) {
    if (!Array.isArray(raw[name])) {
      throw new InvalidBackupError("That file doesn't look like a Kusuo backup.")
    }
  }

  /*
    Every table this build holds, whether or not the file mentions it: absent
    means empty, which is what an export written before that table existed
    means. Anything else the file carries is left on the payload untouched — the
    parser is no longer the one link in the chain with a hand-written list.
  */
  const tables: Record<string, unknown[]> = {}
  for (const name of new Set([...recordTableNames(), ...Object.keys(ROW_VALIDATORS)])) {
    const value = raw[name] === undefined ? [] : raw[name]
    if (!Array.isArray(value)) {
      throw new InvalidBackupError("That file doesn't look like a Kusuo backup.")
    }
    const isValidRow = ROW_VALIDATORS[name]
    if (isValidRow && !value.every(isValidRow)) {
      throw new InvalidBackupError("That file doesn't look like a Kusuo backup.")
    }
    tables[name] = value
  }

  return {
    ...raw,
    ...tables,
    schemaVersion,
    exportedAt,
    preferences: preferences as RecordPreferences | undefined,
    splits: (tables.splits as unknown[]).map(normaliseSplit),
  } as BackupPayload
}

/**
 * When this device last wrote something of its own.
 *
 * Every append-only row carries a `timestamp`; the tables that are edited in
 * place carry an `updatedAt`. Asking each row rather than naming the tables
 * keeps this honest as the schema grows — this used to read `habitEvents`
 * alone, so a week of logged sets, finished sessions, weigh-ins and reflections
 * counted for nothing if no habit happened to be ticked.
 *
 * The seeded exercise library is skipped: it is written at first launch on
 * every device, so counting it would make a brand new phone look like it held
 * work newer than any backup. A movement you added yourself is yours and counts.
 */
async function lastLocalWrite(): Promise<number> {
  const tables = recordTables()
  const rows = await Promise.all(tables.map((table) => table.toArray()))
  let latest = 0
  for (const [i, table] of tables.entries()) {
    for (const row of rows[i] as Record<string, unknown>[]) {
      if (table.name === 'exercises' && row.isCustom === false) continue
      // A split that came in from a template and has not been edited since is
      // the same kind of thing as the seeded movement library: something every
      // device writes at setup, and nobody authored. Counting it would make a
      // phone that has only been through onboarding look like it held work
      // newer than any backup.
      if (table.name === 'splits' && row.seededFrom && row.updatedAt === row.createdAt) continue
      const at = typeof row.timestamp === 'number' ? row.timestamp : row.updatedAt
      if (typeof at === 'number' && at > latest) latest = at
    }
  }
  return latest
}

/**
 * True when this device already holds writes newer than the backup being
 * imported — importing would silently discard them. Callers should surface
 * this as an explicit warning, not a silent no-op or auto-skip.
 */
export async function isReverseImport(payload: BackupPayload): Promise<boolean> {
  return (await lastLocalWrite()) > payload.exportedAt
}

/**
 * Wholesale replace of every user table, in one transaction: it lands whole or
 * not at all. This device's identity — deviceId, deviceRole, theme — is never
 * touched, because it describes the phone rather than the record.
 */
export async function importBackup(payload: BackupPayload): Promise<void> {
  const tables = recordTables()
  await db.transaction('rw', tables, async () => {
    for (const table of tables) {
      await table.clear()
      // Payload keys are the table names, so a table added to the schema is
      // carried here without this function being touched. A table the file
      // does not mention imports as empty, which is what an older export means.
      const rows = (payload as unknown as Record<string, unknown[]>)[table.name] ?? []
      if (rows.length > 0) await table.bulkAdd(rows)
    }
  })

  /*
    Both of these follow the replace rather than joining it, so a failure here
    can never leave a half-imported record behind.

    A file written before version 5 carried no exercise library, and one written
    before version 5 carried no preferences. Seeding is keyed by id and adds only
    what is missing, so it refills a directory the import emptied and does
    nothing at all to a file that brought its own. Without it the movements come
    back only after the app is killed and relaunched, and until then every split
    entry reads "Unknown movement".
  */
  await seedExercises()
  if (payload.preferences) {
    /*
      A training habit that the file did not carry cannot be pointed at. Left
      dangling, finishing a session would append a habit event against a habit
      row that does not exist — and in an append-only log that orphan is
      permanent, because no later event can take it back.
    */
    const habits = new Set((payload.habits ?? []).map((h) => h.id))
    const { trainingHabitId, ...rest } = payload.preferences
    await applyRecordPreferences(
      trainingHabitId && habits.has(trainingHabitId)
        ? payload.preferences
        : { ...rest, trainingHabitId: undefined },
    )
  }
}


export async function recordBackupExported(deviceId: string): Promise<void> {
  await updateSettings(deviceId, { lastBackupAt: Date.now() })
}
