import { beforeEach, describe, expect, it } from 'vitest'
import {
  InvalidBackupError,
  buildBackup,
  importBackup,
  isReverseImport,
  parseBackup,
  recordBackupExported,
  serializeBackup,
  type BackupPayload,
} from './backup'
import { appendHabitEvent } from './events'
import { seedExercises } from './exercises'
import { createHabit } from './habits'
import { finishSession, logSet } from './sessions'
import { instantiateTemplate } from './splits'
import { db, type Habit, type HabitEvent } from './schema'
import { createSettings, getSettings } from './settings'

beforeEach(async () => {
  await db.habits.clear()
  await db.habitEvents.clear()
  await db.settings.clear()
  await db.exercises.clear()
  await db.splits.clear()
  await db.sessionEvents.clear()
  await db.sessionMarks.clear()
})

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    name: 'Read',
    frequencyType: 'daily',
    frequencyValue: 1,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeEvent(overrides: Partial<HabitEvent> = {}): HabitEvent {
  return {
    id: crypto.randomUUID(),
    habitId: crypto.randomUUID(),
    localDate: '2026-01-10',
    action: 'complete',
    timestamp: Date.now(),
    deviceId: 'dev1',
    ...overrides,
  }
}

describe('buildBackup', () => {
  it('round-trips real Dexie data', async () => {
    const habit = await createHabit({ name: 'Read', frequencyType: 'daily', frequencyValue: 1 })
    const event = await appendHabitEvent(habit.id, '2026-01-10', 'complete', 'dev1')

    const before = Date.now()
    const payload = await buildBackup()
    const after = Date.now()

    expect(payload.habits).toEqual([habit])
    expect(payload.habitEvents).toEqual([event])
    expect(typeof payload.schemaVersion).toBe('number')
    expect(payload.exportedAt).toBeGreaterThanOrEqual(before)
    expect(payload.exportedAt).toBeLessThanOrEqual(after)
  })
})

describe('serializeBackup / parseBackup', () => {
  it('round-trips a payload losslessly', () => {
    const payload: BackupPayload = {
      schemaVersion: 1,
      exportedAt: Date.now(),
      habits: [makeHabit()],
      habitEvents: [makeEvent()],
      goals: [],
      reflections: [],
      exercises: [],
      splits: [],
      sessionEvents: [],
      sessionMarks: [],
    }
    const json = serializeBackup(payload)
    expect(parseBackup(json)).toEqual(payload)
  })

  it('throws on non-JSON garbage', () => {
    expect(() => parseBackup('not json {{{')).toThrow(InvalidBackupError)
  })

  it('throws when the parsed JSON is not an object (array)', () => {
    expect(() => parseBackup(JSON.stringify([1, 2, 3]))).toThrow(InvalidBackupError)
  })

  it('throws when the parsed JSON is not an object (string)', () => {
    expect(() => parseBackup(JSON.stringify('hello'))).toThrow(InvalidBackupError)
  })

  it('throws when required top-level fields are missing', () => {
    const payload = { schemaVersion: 1, exportedAt: Date.now(), habitEvents: [] }
    expect(() => parseBackup(JSON.stringify(payload))).toThrow(InvalidBackupError)
  })

  it('throws when a habit is missing a required field', () => {
    const habit = makeHabit() as unknown as Record<string, unknown>
    delete habit.frequencyType
    const payload = { schemaVersion: 1, exportedAt: Date.now(), habits: [habit], habitEvents: [] }
    expect(() => parseBackup(JSON.stringify(payload))).toThrow(InvalidBackupError)
  })

  it('throws when a habit has an invalid frequencyType value', () => {
    const habit = { ...makeHabit(), frequencyType: 'monthly' }
    const payload = { schemaVersion: 1, exportedAt: Date.now(), habits: [habit], habitEvents: [] }
    expect(() => parseBackup(JSON.stringify(payload))).toThrow(InvalidBackupError)
  })

  it('throws when a habitEvent has an invalid action value', () => {
    const event = { ...makeEvent(), action: 'toggle' }
    const payload = { schemaVersion: 1, exportedAt: Date.now(), habits: [], habitEvents: [event] }
    expect(() => parseBackup(JSON.stringify(payload))).toThrow(InvalidBackupError)
  })

  it('throws when a habitEvent is missing timestamp', () => {
    const event = makeEvent() as unknown as Record<string, unknown>
    delete event.timestamp
    const payload = { schemaVersion: 1, exportedAt: Date.now(), habits: [], habitEvents: [event] }
    expect(() => parseBackup(JSON.stringify(payload))).toThrow(InvalidBackupError)
  })
})

describe('isReverseImport', () => {
  it('is false when the local DB is empty', async () => {
    const payload: BackupPayload = { schemaVersion: 1, exportedAt: 1000, habits: [], habitEvents: [], goals: [], reflections: [], exercises: [], splits: [], sessionEvents: [], sessionMarks: [] }
    expect(await isReverseImport(payload)).toBe(false)
  })

  it('is true when a local event is newer than the backup', async () => {
    const habit = await createHabit({ name: 'Read', frequencyType: 'daily', frequencyValue: 1 })
    const event = await appendHabitEvent(habit.id, '2026-01-10', 'complete', 'dev1')
    const payload: BackupPayload = {
      schemaVersion: 1,
      exportedAt: event.timestamp - 1000,
      habits: [],
      habitEvents: [],
      goals: [],
      reflections: [],
      exercises: [],
      splits: [],
      sessionEvents: [],
      sessionMarks: [],
    }
    expect(await isReverseImport(payload)).toBe(true)
  })

  it('is false when the backup is newer than every local event', async () => {
    const habit = await createHabit({ name: 'Read', frequencyType: 'daily', frequencyValue: 1 })
    const event = await appendHabitEvent(habit.id, '2026-01-10', 'complete', 'dev1')
    const payload: BackupPayload = {
      schemaVersion: 1,
      exportedAt: event.timestamp + 1000,
      habits: [],
      habitEvents: [],
      goals: [],
      reflections: [],
      exercises: [],
      splits: [],
      sessionEvents: [],
      sessionMarks: [],
    }
    expect(await isReverseImport(payload)).toBe(false)
  })
})

describe('importBackup', () => {
  it('wholesale-replaces habits and habitEvents', async () => {
    const oldHabit = await createHabit({ name: 'Old', frequencyType: 'daily', frequencyValue: 1 })
    await appendHabitEvent(oldHabit.id, '2026-01-01', 'complete', 'dev1')

    const newHabit = makeHabit({ name: 'New' })
    const newEvent = makeEvent({ habitId: newHabit.id })
    const payload: BackupPayload = {
      schemaVersion: 1,
      exportedAt: Date.now(),
      habits: [newHabit],
      habitEvents: [newEvent],
      goals: [],
      reflections: [],
      exercises: [],
      splits: [],
      sessionEvents: [],
      sessionMarks: [],
    }

    await importBackup(payload)

    expect(await db.habits.toArray()).toEqual([newHabit])
    expect(await db.habitEvents.toArray()).toEqual([newEvent])
  })

  it('clears tables to empty when the payload has no rows', async () => {
    const habit = await createHabit({ name: 'Old', frequencyType: 'daily', frequencyValue: 1 })
    await appendHabitEvent(habit.id, '2026-01-01', 'complete', 'dev1')

    const payload: BackupPayload = { schemaVersion: 1, exportedAt: Date.now(), habits: [], habitEvents: [], goals: [], reflections: [], exercises: [], splits: [], sessionEvents: [], sessionMarks: [] }
    await importBackup(payload)

    expect(await db.habits.toArray()).toEqual([])
    expect(await db.habitEvents.toArray()).toEqual([])
  })

  it('never touches the settings table', async () => {
    const settings = await createSettings({ deviceId: 'dev1', deviceRole: 'writer', userName: 'Soso' })
    const payload: BackupPayload = {
      schemaVersion: 1,
      exportedAt: Date.now(),
      habits: [makeHabit()],
      habitEvents: [],
      goals: [],
      reflections: [],
      exercises: [],
      splits: [],
      sessionEvents: [],
      sessionMarks: [],
    }

    await importBackup(payload)

    expect(await getSettings('dev1')).toEqual(settings)
  })
})

describe('recordBackupExported', () => {
  it('sets lastBackupAt on the existing settings row', async () => {
    await createSettings({ deviceId: 'dev1', deviceRole: 'writer' })
    const before = Date.now()

    await recordBackupExported('dev1')

    const settings = await getSettings('dev1')
    expect(settings?.lastBackupAt).toBeGreaterThanOrEqual(before)
    expect(settings?.lastBackupAt).toBeLessThanOrEqual(Date.now())
  })
})

describe('backup across schema versions', () => {
  it('imports a version 1 file, treating the absent training tables as empty', () => {
    const v1 = {
      schemaVersion: 1,
      exportedAt: Date.now(),
      habits: [makeHabit()],
      habitEvents: [makeEvent()],
      goals: [],
      reflections: [],
    }
    const parsed = parseBackup(JSON.stringify(v1))
    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.habits).toHaveLength(1)
    expect(parsed.exercises).toEqual([])
    expect(parsed.splits).toEqual([])
    expect(parsed.sessionEvents).toEqual([])
    expect(parsed.sessionMarks).toEqual([])
  })

  it('round-trips real training data through Dexie', async () => {
    await seedExercises()
    const split = await instantiateTemplate('split-ppl-3')
    await logSet(
      { localDate: '2026-01-10', splitDayId: split.days[0].id, exerciseId: 'ex-barbell-bench-press', setIndex: 0 },
      { weightKg: 80, reps: 5 },
      'dev1',
    )
    await finishSession('2026-01-10', split.days[0].id, 'dev1')

    const payload = await buildBackup()
    expect(payload.schemaVersion).toBe(3)

    const restored = parseBackup(serializeBackup(payload))
    expect(restored).toEqual(payload)

    await importBackup(restored)
    expect(await db.splits.count()).toBe(1)
    expect(await db.sessionEvents.count()).toBe(1)
    expect(await db.sessionMarks.count()).toBe(1)
    expect((await db.splits.get(split.id))?.days[0].entries.length).toBe(
      split.days[0].entries.length,
    )
  })

  it('rejects a file whose session event is malformed rather than half-importing it', async () => {
    await seedExercises()
    const payload = await buildBackup()
    const broken = {
      ...payload,
      sessionEvents: [{ id: 'x', localDate: '2026-01-10', splitDayId: 'd', exerciseId: 'e' }],
    }
    expect(() => parseBackup(JSON.stringify(broken))).toThrow(InvalidBackupError)
  })

  it('rejects a split whose days are not the right shape', async () => {
    const payload = await buildBackup()
    const broken = {
      ...payload,
      splits: [
        {
          id: 'split-1',
          name: 'Bad',
          days: [{ id: 'd1', label: 'Push', entries: [{ exerciseId: 'e', sets: 'three', reps: 8 }] }],
          isActive: true,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    }
    expect(() => parseBackup(JSON.stringify(broken))).toThrow(InvalidBackupError)
  })

  it('clears the training tables when the payload has none', async () => {
    await seedExercises()
    await instantiateTemplate('split-ppl-3')

    await importBackup({
      schemaVersion: 3,
      exportedAt: Date.now(),
      habits: [],
      habitEvents: [],
      goals: [],
      reflections: [],
      exercises: [],
      splits: [],
      sessionEvents: [],
      sessionMarks: [],
    })

    expect(await db.exercises.count()).toBe(0)
    expect(await db.splits.count()).toBe(0)
  })
})

describe('importing a schema 2 export', () => {
  it('turns a fixed rep target into a range and marks every day a training day', () => {
    const v2 = {
      schemaVersion: 2,
      exportedAt: Date.now(),
      habits: [],
      habitEvents: [],
      goals: [],
      reflections: [],
      exercises: [],
      sessionEvents: [],
      sessionMarks: [],
      splits: [
        {
          id: 'split-legacy',
          name: 'Push / Pull / Legs',
          days: [
            { id: 'day-1', label: 'Push', entries: [{ exerciseId: 'ex-a', sets: 3, reps: 8 }] },
          ],
          isActive: true,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    }

    const parsed = parseBackup(JSON.stringify(v2))
    const day = parsed.splits[0].days[0]
    expect(day.kind).toBe('training')
    expect(day.entries[0]).toEqual({ exerciseId: 'ex-a', sets: 3, repsMin: 8, repsMax: 8 })
    expect('reps' in day.entries[0]).toBe(false)
  })

  it('still refuses a split whose entry has neither reps nor a range', () => {
    const broken = {
      schemaVersion: 2,
      exportedAt: Date.now(),
      habits: [],
      habitEvents: [],
      splits: [
        {
          id: 's',
          name: 'Bad',
          days: [{ id: 'd', label: 'Push', entries: [{ exerciseId: 'ex-a', sets: 3 }] }],
          isActive: true,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    }
    expect(() => parseBackup(JSON.stringify(broken))).toThrow(InvalidBackupError)
  })
})
