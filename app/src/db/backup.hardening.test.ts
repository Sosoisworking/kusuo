import { beforeEach, describe, expect, it } from 'vitest'
import {
  InvalidBackupError,
  buildBackup,
  importBackup,
  isReverseImport,
  parseBackup,
  serializeBackup,
} from './backup'
import { resetDatabase } from '../test/setup'
import { appendHabitEvent } from './events'
import { createHabit } from './habits'
import { db } from './schema'
import { recordTableNames } from './tables'
import { createSettings, getOrCreateDeviceId, getSettings } from './settings'

/**
 * Importing a file you did not write.
 *
 * backup.test.ts covers the happy round trip and the obvious rejections. This
 * file is the adversarial half: files from the wrong app, files cut off
 * mid-write, files from a version that does not exist yet, and files whose
 * rows collide. The rule the codebase states is that a malformed file is
 * refused whole and never half-applied — so every case here also checks what
 * is left in the database afterwards.
 */

beforeEach(async () => {
  await resetDatabase()
})

const now = () => Date.now()

function validPayloadJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 4,
    exportedAt: now(),
    habits: [],
    habitEvents: [],
    ...overrides,
  })
}

/** A record with something in every table, so "nothing was lost" is checkable. */
async function seedARecord() {
  const habit = await createHabit({ name: 'Reading', frequencyType: 'daily', frequencyValue: 1 })
  await appendHabitEvent(habit.id, '2026-01-05', 'complete', 'dev1')
  await db.bodyweight.add({
    id: 'bw1',
    localDate: '2026-01-05',
    weightKg: 80,
    timestamp: now(),
    deviceId: 'dev1',
  })
  const counts = new Map<string, number>()
  for (const name of recordTableNames()) counts.set(name, await db.table(name).count())
  return counts
}

async function currentCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  for (const name of recordTableNames()) counts.set(name, await db.table(name).count())
  return counts
}

describe('files that are not a Kusuo backup', () => {
  it.each([
    ['an empty file', ''],
    ['whitespace only', '   \n  '],
    ['a bare array', '[]'],
    ['literal null', 'null'],
    ['an object with none of the fields', '{"foo":1}'],
    // What another app's export looks like: plausible JSON, wrong shape.
    ['an export from a different app', '{"version":2,"exportedAt":"yesterday","notes":[{"id":"n1"}]}'],
  ])('refuses %s', (_label, json) => {
    expect(() => parseBackup(json)).toThrow(InvalidBackupError)
  })

  it('refuses a file that was cut off mid-write', async () => {
    await createHabit({ name: 'Reading', frequencyType: 'daily', frequencyValue: 1 })
    const whole = serializeBackup(await buildBackup())
    const truncated = whole.slice(0, Math.floor(whole.length * 0.6))
    expect(() => parseBackup(truncated)).toThrow(InvalidBackupError)
  })

  it('refuses a bad field type buried inside a split, not just at the top level', () => {
    const json = validPayloadJson({
      splits: [
        {
          id: 's1',
          name: 'PPL',
          isActive: true,
          createdAt: now(),
          updatedAt: now(),
          days: [
            {
              id: 'd1',
              label: 'Push',
              kind: 'training',
              // sets is a string. Everything above it is well formed.
              entries: [{ exerciseId: 'ex1', sets: '3', repsMin: 6, repsMax: 8 }],
            },
          ],
        },
      ],
    })
    expect(() => parseBackup(json)).toThrow(InvalidBackupError)
  })

  it('leaves the record untouched when the file is refused', async () => {
    const before = await seedARecord()
    expect(() => parseBackup('{"foo":1}')).toThrow(InvalidBackupError)
    expect(await currentCounts()).toEqual(before)
  })
})

describe('an import that fails part-way is not half-applied', () => {
  it('rolls back when two rows share an id', async () => {
    const before = await seedARecord()
    const duplicate = {
      id: 'same-id',
      name: 'First',
      frequencyType: 'daily',
      frequencyValue: 1,
      isActive: true,
      createdAt: now(),
      updatedAt: now(),
    }
    // Structurally valid — parseBackup cannot see the collision, only Dexie can,
    // and it sees it after the tables have already been cleared.
    const payload = parseBackup(
      validPayloadJson({ habits: [duplicate, { ...duplicate, name: 'Second' }] }),
    )

    await expect(importBackup(payload)).rejects.toThrow()

    // The whole point: the clear that ran first must not survive the failure.
    expect(await currentCounts()).toEqual(before)
    expect((await db.habits.toArray()).map((h) => h.name)).toEqual(['Reading'])
  })

  it('leaves this device its own settings when an import fails', async () => {
    await createSettings({ deviceId: 'dev1', deviceRole: 'writer' })
    await seedARecord()
    const duplicate = {
      id: 'dup',
      name: 'X',
      frequencyType: 'daily',
      frequencyValue: 1,
      isActive: true,
      createdAt: now(),
      updatedAt: now(),
    }
    const payload = parseBackup(validPayloadJson({ habits: [duplicate, duplicate] }))
    await expect(importBackup(payload)).rejects.toThrow()

    const settings = await getSettings('dev1')
    expect(settings?.deviceId).toBe('dev1')
    expect(settings?.deviceRole).toBe('writer')
  })
})

describe('the parser keeps up with the schema', () => {
  it('returns every table the record holds', async () => {
    const parsed = parseBackup(serializeBackup(await buildBackup()))
    // parseBackup rebuilds its result field by hand. A table added to the
    // schema is carried by buildBackup and restored by importBackup without
    // either being touched — but it is dropped here, between them, unless this
    // list is updated too. This test is the tripwire for that.
    for (const name of recordTableNames()) {
      expect({ table: name, parsed: name in parsed }).toEqual({ table: name, parsed: true })
    }
  })
})

/**
 * DEFECT (fixed) — a backup from a newer Kusuo used to import as though it were
 * current.
 *
 * `parseBackup` checked `typeof schemaVersion !== 'number'` and nothing else;
 * CURRENT_SCHEMA_VERSION was declared (backup.ts) and then never compared
 * against. A file stamped 99 parsed, and `importBackup` cleared every table and
 * replaced it with whatever that file happened to carry.
 *
 * Failure scenario: a later build adds a table and Soso exports from the
 * iPhone. The Mac, still on the old build, imports the file. Version 99 sails
 * through, the unknown table is dropped by the parser (see below), and the Mac
 * silently ends up holding less than the file did — with a success message.
 *
 * Fixed: parseBackup refuses a schemaVersion above CURRENT_SCHEMA_VERSION and
 * says why, rather than importing it as though it were current.
 */
describe('the preference block the version gate lets through', () => {
  it('refuses a defaultSets that would build an unrenderable split entry', () => {
    const prefs = { units: 'kg', weekStart: 'monday', defaultSets: 1_000_000_000 }
    expect(() => parseBackup(validPayloadJson({ preferences: prefs }))).toThrow(InvalidBackupError)
  })

  it('drops a training habit the file never carried, rather than pointing at nothing', async () => {
    const prefs = {
      units: 'kg',
      weekStart: 'monday',
      defaultSets: 3,
      trainingHabitId: 'habit-that-does-not-exist',
    }
    await createSettings({ deviceId: getOrCreateDeviceId(), deviceRole: 'writer' })
    await importBackup(parseBackup(validPayloadJson({ preferences: prefs })))

    const settings = await db.settings.get(getOrCreateDeviceId())
    expect(settings?.trainingHabitId).toBeUndefined()
    // The rest of the block still applies.
    expect(settings?.defaultSets).toBe(3)
  })
})

describe('a backup from a version that does not exist yet', () => {
  it('is refused rather than imported as though it were current', () => {
    expect(() => parseBackup(validPayloadJson({ schemaVersion: 99 }))).toThrow(InvalidBackupError)
  })
})

/**
 * DEFECT (fixed) — `parseBackup` was the one link in the chain that is still
 * hand-written, so a table added to the schema is dropped on import.
 *
 * `buildBackup` asks `recordTables()` what exists and spreads the answer;
 * `importBackup` does the same and says so in its comment — "a table added to
 * the schema is carried here without this function being touched". True of
 * that function, false of the path: `parseBackup` destructures nine names and
 * rebuilds a fresh object from them, so anything else on the wire is gone
 * before importBackup ever sees it.
 *
 * Measured: a payload carrying `futureTable: [...]` comes back from
 * parseBackup without the key. This is the exact shape of the bug the project
 * was already bitten by — the tenth table breaking reset and the test setup —
 * and tables.ts was written to end it.
 *
 * Fixed: the parser now asks recordTableNames() what exists and leaves
 * everything else on the payload untouched, so the file and the database agree.
 */
describe('a table the parser has not been told about', () => {
  it('survives the trip from file to database', () => {
    const parsed = parseBackup(validPayloadJson({ futureTable: [{ id: 'x' }] }))
    expect('futureTable' in parsed).toBe(true)
  })
})

/**
 * DEFECT (fixed) — the "this device has newer data" warning used to look only at
 * habit events, so a week of training is discarded without one.
 *
 * `isReverseImport` reads `db.habitEvents` and nothing else. Its own comment
 * says it is "True when this device already holds writes newer than the backup
 * being imported — importing would silently discard them", and YourData.tsx
 * gates the whole confirmation screen on it.
 *
 * Failure scenario: Soso trains for a week — logged sets, finished sessions,
 * weigh-ins, nightly reflections — but ticks no habits, then imports last
 * week's export. `isReverseImport` returns false, no warning is shown, and
 * `importBackup` clears the lot.
 *
 * Fixed: the check now asks every record table for its newest write, by row
 * rather than by name, and skips only the seeded movement library — which every
 * device writes at first launch and no one authored.
 */
describe('newer local data that is not a habit event', () => {
  it('still counts as a reverse import', async () => {
    const backupTime = now() - 10_000
    await db.sessionEvents.add({
      id: 's1',
      localDate: '2026-01-05',
      splitDayId: 'd1',
      exerciseId: 'ex1',
      setIndex: 0,
      weightKg: 100,
      reps: 5,
      action: 'log',
      timestamp: now(),
      deviceId: 'dev1',
    })
    await db.bodyweight.add({
      id: 'bw1',
      localDate: '2026-01-05',
      weightKg: 80,
      timestamp: now(),
      deviceId: 'dev1',
    })

    const payload = parseBackup(validPayloadJson({ exportedAt: backupTime }))
    expect(await isReverseImport(payload)).toBe(true)
  })
})
