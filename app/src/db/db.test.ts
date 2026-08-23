import { beforeEach, describe, expect, it } from 'vitest'
import { appendHabitEvent, eventsForHabit } from './events'
import { archiveHabit, createHabit, listActiveHabits, listAllHabits, listCategories, updateHabit } from './habits'
import { db } from './schema'
import { completedDatesForHabit } from '../logic/derive'
import { dailyStreak } from '../logic/streaks'

beforeEach(async () => {
  await db.habits.clear()
  await db.habitEvents.clear()
  await db.settings.clear()
})

describe('habit CRUD', () => {
  it('createHabit generates a UUID id and active flags', async () => {
    const habit = await createHabit({
      name: 'Read',
      frequencyType: 'daily',
      frequencyValue: 1,
    })
    expect(habit.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(habit.isActive).toBe(true)
    expect(habit.archivedAt).toBeUndefined()
  })

  it('archiveHabit removes it from listActiveHabits but keeps it in listAllHabits', async () => {
    const habit = await createHabit({ name: 'Read', frequencyType: 'daily', frequencyValue: 1 })
    await archiveHabit(habit.id)

    const active = await listActiveHabits()
    expect(active).toHaveLength(0)

    const all = await listAllHabits()
    expect(all).toHaveLength(1)
    expect(all[0].archivedAt).toBeTypeOf('number')
  })

  it('updateHabit changes apply going forward only (no retroactive event rewrite)', async () => {
    const habit = await createHabit({
      name: 'Exercise',
      frequencyType: 'weekly',
      frequencyValue: 2,
    })
    await appendHabitEvent(habit.id, '2026-01-05', 'complete', 'dev1')
    await updateHabit(habit.id, { frequencyValue: 4 })

    const events = await eventsForHabit(habit.id)
    expect(events).toHaveLength(1) // past event untouched, no rewrite

    const updated = await db.habits.get(habit.id)
    expect(updated?.frequencyValue).toBe(4)
  })
})

describe('event log + derived state, through Dexie', () => {
  it('replays appended events to derive completion and streak', async () => {
    const habit = await createHabit({ name: 'Meditate', frequencyType: 'daily', frequencyValue: 1 })
    await appendHabitEvent(habit.id, '2026-01-08', 'complete', 'dev1')
    await appendHabitEvent(habit.id, '2026-01-09', 'complete', 'dev1')
    await appendHabitEvent(habit.id, '2026-01-10', 'complete', 'dev1')

    const events = await eventsForHabit(habit.id)
    const completed = completedDatesForHabit(events, habit.id)
    expect(completed).toEqual(new Set(['2026-01-08', '2026-01-09', '2026-01-10']))
    expect(dailyStreak(completed, '2026-01-10')).toBe(3)
  })

  it('un-complete is an appended event, not a mutation, and wins by timestamp', async () => {
    const habit = await createHabit({ name: 'Meditate', frequencyType: 'daily', frequencyValue: 1 })
    await appendHabitEvent(habit.id, '2026-01-10', 'complete', 'dev1')
    await appendHabitEvent(habit.id, '2026-01-10', 'uncomplete', 'dev1')

    const events = await eventsForHabit(habit.id)
    expect(events).toHaveLength(2)
    const completed = completedDatesForHabit(events, habit.id)
    expect(completed.has('2026-01-10')).toBe(false)
  })

  it('double-complete via appended events stays idempotent (day-based, not event-count-based)', async () => {
    const habit = await createHabit({ name: 'Meditate', frequencyType: 'daily', frequencyValue: 1 })
    await appendHabitEvent(habit.id, '2026-01-10', 'complete', 'dev1')
    await appendHabitEvent(habit.id, '2026-01-10', 'complete', 'dev1')

    const events = await eventsForHabit(habit.id)
    const completed = completedDatesForHabit(events, habit.id)
    expect(completed.size).toBe(1)
  })

  it('listActiveHabits only returns non-archived habits', async () => {
    const a = await createHabit({ name: 'Read', frequencyType: 'daily', frequencyValue: 1 })
    const b = await createHabit({ name: 'Write', frequencyType: 'daily', frequencyValue: 1 })
    await archiveHabit(a.id)

    const active = await listActiveHabits()
    expect(active.map((h) => h.id)).toEqual([b.id])
  })
})

describe('listCategories', () => {
  it('returns distinct, non-empty categories sorted alphabetically', async () => {
    await createHabit({ name: 'Read', category: 'Learning', frequencyType: 'daily', frequencyValue: 1 })
    await createHabit({ name: 'Run', category: 'Health', frequencyType: 'daily', frequencyValue: 1 })
    await createHabit({ name: 'Stretch', category: 'Health', frequencyType: 'daily', frequencyValue: 1 })
    await createHabit({ name: 'Journal', frequencyType: 'daily', frequencyValue: 1 })

    expect(await listCategories()).toEqual(['Health', 'Learning'])
  })

  it('excludes categories from archived habits', async () => {
    const habit = await createHabit({ name: 'Read', category: 'Learning', frequencyType: 'daily', frequencyValue: 1 })
    await archiveHabit(habit.id)

    expect(await listCategories()).toEqual([])
  })

  it('returns an empty array when no habits have categories', async () => {
    await createHabit({ name: 'Read', frequencyType: 'daily', frequencyValue: 1 })
    expect(await listCategories()).toEqual([])
  })
})
