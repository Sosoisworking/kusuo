import type { Table } from 'dexie'
import { db } from './schema'
import { forgetRestoredPreferences } from './settings'

/**
 * The one place that knows what tables exist.
 *
 * Reset, backup and every test's setup each used to keep their own hand-written
 * list, so adding a table meant remembering all of them. Adding the tenth broke
 * two: reset left weigh-ins behind while promising to erase everything, and
 * nine test files leaked them between cases. Asking Dexie fixed the lists; the
 * classification below makes each new table say what it is.
 */

/**
 * What each table is. Every table must be named here — a test fails if one
 * isn't — because the default would otherwise decide for it.
 *
 * Until now everything but `settings` was assumed to be the record, which made
 * adding a table safe exactly once: the day a table exists that must *not*
 * travel in a backup (a sync cursor, an outbox, a photo cache), the assumption
 * becomes a leak. Naming each one turns forgetting into a red test.
 *
 * - `record`: the history. A backup carries it, an import replaces it, reset
 *   erases it.
 * - `legacy`: no longer read, kept so a migration can be run again. A backup
 *   does not carry it — it would be a stale second copy — but an import
 *   replaces it like the record, so a re-run can never mix this phone's old
 *   data with a restored file, and reset erases it.
 * - `device`: describes this phone — its role, units, id. Survives import and
 *   reset of the record.
 */
export type TableClass = 'record' | 'legacy' | 'device'

export const TABLE_CLASSES: Readonly<Record<string, TableClass>> = {
  habits: 'record',
  habitEvents: 'record',
  goals: 'record',
  reflections: 'record',
  exercises: 'record',
  routines: 'record',
  plans: 'record',
  schedule: 'record',
  splits: 'legacy',
  sessionEvents: 'record',
  sessionMarks: 'record',
  bodyweight: 'record',
  settings: 'device',
}

/** Tables that exist in the database but are named nowhere above. */
export function unclassifiedTables(): string[] {
  return db.tables.map((t) => t.name).filter((name) => !(name in TABLE_CLASSES))
}

/** Every table, including settings. */
export function allTables(): Table[] {
  return db.tables
}

/**
 * The tables holding the record. This is what a backup carries and what an
 * import replaces; the device's own settings — its role, its units, its id —
 * belong to the phone rather than to the history, and survive both.
 */
export function recordTables(): Table[] {
  // An unclassified table is left out rather than assumed to be history: kept
  // out of a backup is the safe failure, and the test above makes it a loud one.
  return db.tables.filter((t) => TABLE_CLASSES[t.name] === 'record')
}

export function recordTableNames(): string[] {
  return recordTables().map((t) => t.name)
}

/**
 * What an import replaces and a reset of the record erases: the record, and
 * the old tables kept beside it.
 */
export function replacedTables(): Table[] {
  return db.tables.filter((t) => TABLE_CLASSES[t.name] === 'record' || TABLE_CLASSES[t.name] === 'legacy')
}

/** Empties the record and leaves this device's settings alone. */
export async function clearRecord(): Promise<void> {
  const tables = replacedTables()
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()))
  })
}

/**
 * Empties everything, settings included, so the next launch asks the first-run
 * questions again rather than silently inheriting a device role.
 */
export async function clearEverything(): Promise<void> {
  const tables = allTables()
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()))
  })
  // Preferences an import parked but no settings row ever took up. They belong
  // to the record being erased, not to the phone.
  forgetRestoredPreferences()
}
