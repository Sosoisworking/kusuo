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
import { createHabit } from './habits'
import { db, type Habit, type HabitEvent } from './schema'
import { createSettings, getSettings } from './settings'

beforeEach(async () => {
  await db.habits.clear()
  await db.habitEvents.clear()
  await db.settings.clear()
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
    const payload: BackupPayload = { schemaVersion: 1, exportedAt: 1000, habits: [], habitEvents: [], goals: [], reflections: [] }
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
    }

    await importBackup(payload)

    expect(await db.habits.toArray()).toEqual([newHabit])
    expect(await db.habitEvents.toArray()).toEqual([newEvent])
  })

  it('clears tables to empty when the payload has no rows', async () => {
    const habit = await createHabit({ name: 'Old', frequencyType: 'daily', frequencyValue: 1 })
    await appendHabitEvent(habit.id, '2026-01-01', 'complete', 'dev1')

    const payload: BackupPayload = { schemaVersion: 1, exportedAt: Date.now(), habits: [], habitEvents: [], goals: [], reflections: [] }
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
