import { describe, expect, it } from 'vitest'
import { db } from './schema'
import { TABLE_CLASSES, recordTableNames, unclassifiedTables } from './tables'

describe('every table says what it is', () => {
  it('leaves no table in the database unclassified', () => {
    // Adding a table without naming it here fails this test, so the choice of
    // whether it travels in a backup is made on purpose, not by default.
    expect(unclassifiedTables()).toEqual([])
  })

  it('classifies no table that no longer exists', () => {
    const real = new Set(db.tables.map((t) => t.name))
    expect(Object.keys(TABLE_CLASSES).filter((name) => !real.has(name))).toEqual([])
  })

  it('keeps this device out of the record', () => {
    expect(recordTableNames()).not.toContain('settings')
    expect(recordTableNames()).toContain('sessionEvents')
  })
})
