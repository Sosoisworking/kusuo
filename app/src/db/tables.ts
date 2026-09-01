import type { Table } from 'dexie'
import { db } from './schema'

/**
 * The one place that knows what tables exist.
 *
 * Reset, backup and every test's setup each used to keep their own hand-written
 * list, so adding a table meant remembering all of them. Adding the tenth broke
 * two: reset left weigh-ins behind while promising to erase everything, and
 * nine test files leaked them between cases. Asking Dexie is the fix — the
 * eleventh table joins all three by construction.
 */

/** `settings` describes this device, not the record. */
const DEVICE_TABLE = 'settings'

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
  return db.tables.filter((t) => t.name !== DEVICE_TABLE)
}

export function recordTableNames(): string[] {
  return recordTables().map((t) => t.name)
}

/** Empties the record and leaves this device's settings alone. */
export async function clearRecord(): Promise<void> {
  const tables = recordTables()
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
}
