import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { KusuoDB, type Habit, type HabitEvent } from './schema'

/**
 * Opens a database at schema version 2 — the shape shipped before the training
 * tables existed — writes real rows into it, then reopens it as the current
 * KusuoDB so the version 3 upgrade actually runs against them.
 */
async function seedVersion2(name: string): Promise<void> {
  const old = new Dexie(name)
  old.version(1).stores({
    habits: 'id, isActive, archivedAt',
    habitEvents: 'id, habitId, localDate, [habitId+localDate], timestamp',
    settings: 'deviceId',
  })
  old.version(2).stores({
    goals: 'id, isActive, archivedAt',
    reflections: 'id, localDate, timestamp',
  })
  await old.open()

  const now = Date.now()
  const habit: Habit = {
    id: 'habit-1',
    name: 'Reading',
    frequencyType: 'daily',
    frequencyValue: 1,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }
  const event: HabitEvent = {
    id: 'event-1',
    habitId: 'habit-1',
    localDate: '2026-01-10',
    action: 'complete',
    timestamp: now,
    deviceId: 'dev1',
  }
  await old.table('habits').add(habit)
  await old.table('habitEvents').add(event)
  // A version 2 settings row has no units and no weekStart.
  await old.table('settings').add({
    deviceId: 'dev1',
    deviceRole: 'writer',
    userName: 'Soso',
    theme: 'system',
    schemaVersion: 1,
    onboardingComplete: true,
  })
  old.close()
}

describe('schema upgrade from version 2', () => {
  it('backfills the new settings fields without touching user data', async () => {
    const name = `kusuo-migration-${crypto.randomUUID()}`
    await seedVersion2(name)

    const upgraded = new KusuoDB(name)
    await upgraded.open()
    expect(upgraded.verno).toBe(9)

    const settings = await upgraded.settings.get('dev1')
    expect(settings?.units).toBe('kg')
    expect(settings?.weekStart).toBe('monday')
    // Everything the row already held survives untouched.
    expect(settings?.userName).toBe('Soso')
    expect(settings?.theme).toBe('system')
    expect(settings?.onboardingComplete).toBe(true)

    // The upgrade is additive: no habit or event is rewritten or dropped.
    expect(await upgraded.habits.toArray()).toHaveLength(1)
    expect((await upgraded.habitEvents.get('event-1'))?.localDate).toBe('2026-01-10')

    // The training tables exist and start empty.
    expect(await upgraded.exercises.count()).toBe(0)
    expect(await upgraded.splits.count()).toBe(0)
    expect(await upgraded.sessionEvents.count()).toBe(0)
    expect(await upgraded.sessionMarks.count()).toBe(0)

    upgraded.close()
  })

  it('does not overwrite a units setting that is already there', async () => {
    const name = `kusuo-migration-${crypto.randomUUID()}`
    await seedVersion2(name)

    const first = new KusuoDB(name)
    await first.open()
    await first.settings.update('dev1', { units: 'lb', weekStart: 'sunday' })
    first.close()

    // Reopening runs no upgrade, but this pins the intent: the backfill uses
    // ??=, so a user's choice is never reset by a later version bump.
    const second = new KusuoDB(name)
    await second.open()
    const settings = await second.settings.get('dev1')
    expect(settings?.units).toBe('lb')
    expect(settings?.weekStart).toBe('sunday')
    second.close()
  })
})
