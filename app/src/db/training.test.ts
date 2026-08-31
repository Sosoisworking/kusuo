import { beforeEach, describe, expect, it } from 'vitest'
import { completedDatesForHabit } from '../logic/derive'
import { isSessionComplete, liveSets, setsOnDate } from '../logic/sessions'
import { SPLIT_TEMPLATES } from '../lib/splitTemplates'
import { EXERCISE_SEED } from '../lib/exerciseSeed'
import { allHabitEvents } from './events'
import {
  createCustomExercise,
  filterExercises,
  listExercises,
  recentExerciseIds,
  seedExercises,
} from './exercises'
import { createHabit } from './habits'
import { db } from './schema'
import {
  allSessionEvents,
  allSessionMarks,
  finishSession,
  logSet,
  unfinishSession,
  voidSet,
} from './sessions'
import { findSplitDay, getActiveSplit, instantiateTemplate, listSplits, setActiveSplit } from './splits'

beforeEach(async () => {
  await db.habits.clear()
  await db.habitEvents.clear()
  await db.exercises.clear()
  await db.splits.clear()
  await db.sessionEvents.clear()
  await db.sessionMarks.clear()
})

describe('seedExercises', () => {
  it('adds the whole directory on a fresh device', async () => {
    const added = await seedExercises()
    expect(added).toBe(EXERCISE_SEED.length)
    expect(await db.exercises.count()).toBe(EXERCISE_SEED.length)
  })

  it('is idempotent — a second run adds nothing', async () => {
    await seedExercises()
    expect(await seedExercises()).toBe(0)
    expect(await db.exercises.count()).toBe(EXERCISE_SEED.length)
  })

  it('leaves a custom exercise alone', async () => {
    await seedExercises()
    const custom = await createCustomExercise({
      name: 'Sled push',
      category: 'legs',
      muscleGroup: 'Quads',
      equipment: 'Other',
    })
    await seedExercises()
    expect(await db.exercises.get(custom.id)).toBeTruthy()
  })

  it('backfills a movement added in a later app version', async () => {
    await seedExercises()
    await db.exercises.delete(EXERCISE_SEED[0].id)
    expect(await seedExercises()).toBe(1)
  })
})

describe('filterExercises', () => {
  it('matches name case-insensitively', async () => {
    await seedExercises()
    const all = await listExercises()
    const found = filterExercises(all, { query: 'BENCH' })
    expect(found.length).toBeGreaterThan(0)
    expect(found.every((x) => x.name.toLowerCase().includes('bench'))).toBe(true)
  })

  it('combines category and equipment filters', async () => {
    await seedExercises()
    const all = await listExercises()
    const found = filterExercises(all, { category: 'legs', equipment: 'Machine' })
    expect(found.every((x) => x.category === 'legs' && x.equipment === 'Machine')).toBe(true)
  })

  it('narrows to custom movements only', async () => {
    await seedExercises()
    await createCustomExercise({
      name: 'Sled push',
      category: 'legs',
      muscleGroup: 'Quads',
      equipment: 'Other',
    })
    const found = filterExercises(await listExercises(), { customOnly: true })
    expect(found).toHaveLength(1)
    expect(found[0].name).toBe('Sled push')
  })

  it('narrows to a recently used set', async () => {
    await seedExercises()
    const all = await listExercises()
    const found = filterExercises(all, { recentIds: ['ex-back-squat', 'ex-deadlift'] })
    expect(found.map((x) => x.id).sort()).toEqual(['ex-back-squat', 'ex-deadlift'])
  })

  it('combines recently used with a category', async () => {
    await seedExercises()
    const all = await listExercises()
    const found = filterExercises(all, {
      category: 'legs',
      recentIds: ['ex-back-squat', 'ex-barbell-bench-press'],
    })
    expect(found.map((x) => x.id)).toEqual(['ex-back-squat'])
  })

  it('shows nothing when the recent set is empty', async () => {
    await seedExercises()
    expect(filterExercises(await listExercises(), { recentIds: [] })).toEqual([])
  })
})

describe('recentExerciseIds', () => {
  const base = {
    localDate: '2026-08-30',
    splitDayId: 'day-1',
    weightKg: 60,
    reps: 8,
    action: 'log' as const,
    deviceId: 'device',
  }

  it('orders by the newest logged set, not by how often', () => {
    const ids = recentExerciseIds([
      { id: '1', ...base, exerciseId: 'ex-a', setIndex: 0, timestamp: 1 },
      { id: '2', ...base, exerciseId: 'ex-a', setIndex: 1, timestamp: 2 },
      { id: '3', ...base, exerciseId: 'ex-b', setIndex: 0, timestamp: 9 },
    ])
    expect(ids).toEqual(['ex-b', 'ex-a'])
  })

  it('ignores voided sets', () => {
    const ids = recentExerciseIds([
      { id: '1', ...base, action: 'void', exerciseId: 'ex-a', setIndex: 0, timestamp: 1 },
    ])
    expect(ids).toEqual([])
  })

  it('caps the list at the limit', () => {
    const events = Array.from({ length: 20 }, (_, i) => ({
      id: `e${i}`,
      ...base,
      exerciseId: `ex-${i}`,
      setIndex: 0,
      timestamp: i + 1,
    }))
    expect(recentExerciseIds(events, 3)).toEqual(['ex-19', 'ex-18', 'ex-17'])
  })
})

describe('split templates', () => {
  it('every template entry points at a seeded movement', () => {
    const ids = new Set(EXERCISE_SEED.map((e) => e.id))
    for (const template of SPLIT_TEMPLATES) {
      for (const day of template.days) {
        for (const entry of day.entries) {
          expect(ids.has(entry.exerciseId), `${template.id}/${day.label}: ${entry.exerciseId}`).toBe(
            true,
          )
        }
      }
    }
  })

  it('ships the six templates the brief names, plus the Batman split', () => {
    expect(SPLIT_TEMPLATES).toHaveLength(7)
    expect(SPLIT_TEMPLATES.map((t) => t.days.length)).toEqual([3, 4, 5, 4, 3, 5, 7])
  })

  it('gives the Batman split two rest days in the right places', () => {
    const batman = SPLIT_TEMPLATES.find((t) => t.id === 'split-batman-7')
    expect(batman?.days.map((d) => d.kind ?? 'training')).toEqual([
      'training', 'training', 'rest', 'training', 'training', 'training', 'rest',
    ])
    expect(batman?.days.filter((d) => d.kind === 'rest').every((d) => d.entries.length === 0)).toBe(true)
  })

  it('keeps the rep ranges the Batman split was written with', () => {
    const day = SPLIT_TEMPLATES.find((t) => t.id === 'split-batman-7')?.days[0]
    const incline = day?.entries[0]
    expect(incline).toMatchObject({ sets: 3, repsMin: 6, repsMax: 8 })
    const preacher = day?.entries.at(-2)
    expect(preacher).toMatchObject({ sets: 3, repsMin: 8, repsMax: 12 })
  })

  it('instantiates a template as the user copy with fresh ids', async () => {
    const split = await instantiateTemplate('split-ppl-3')
    expect(split.seededFrom).toBe('split-ppl-3')
    expect(split.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(split.days).toHaveLength(3)
    for (const day of split.days) expect(day.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('gives two copies of one template different day ids', async () => {
    const a = await instantiateTemplate('split-ppl-3')
    const b = await instantiateTemplate('split-ppl-3')
    expect(a.days[0].id).not.toBe(b.days[0].id)
  })

  it('rejects an unknown template id', async () => {
    await expect(instantiateTemplate('split-nope')).rejects.toThrow('Unknown split template')
  })

  it('keeps exactly one split active', async () => {
    const a = await instantiateTemplate('split-ppl-3')
    const b = await instantiateTemplate('split-upper-lower-4')
    expect((await getActiveSplit())?.id).toBe(b.id)

    await setActiveSplit(a.id)
    const active = (await listSplits()).filter((s) => s.isActive)
    expect(active).toHaveLength(1)
    expect(active[0].id).toBe(a.id)
  })

  it('finds the split a logged day belongs to', async () => {
    const split = await instantiateTemplate('split-ppl-3')
    const found = await findSplitDay(split.days[1].id)
    expect(found?.split.id).toBe(split.id)
    expect(found?.day.label).toBe('Pull')
  })
})

describe('session logging', () => {
  it('appends rather than mutates when a set is corrected', async () => {
    const identity = {
      localDate: '2026-01-10',
      splitDayId: 'day1',
      exerciseId: 'ex-back-squat',
      setIndex: 0,
    }
    await logSet(identity, { weightKg: 200, reps: 5 }, 'dev1')
    await logSet(identity, { weightKg: 100, reps: 5 }, 'dev1')

    const events = await allSessionEvents()
    expect(events).toHaveLength(2)
    const sets = liveSets(events)
    expect(sets).toHaveLength(1)
    expect(sets[0].weightKg).toBe(100)
  })

  it('voids a set without erasing that it was logged', async () => {
    const identity = {
      localDate: '2026-01-10',
      splitDayId: 'day1',
      exerciseId: 'ex-back-squat',
      setIndex: 0,
    }
    await logSet(identity, { weightKg: 200, reps: 5 }, 'dev1')
    await voidSet(identity, { weightKg: 200, reps: 5 }, 'dev1')

    expect(await allSessionEvents()).toHaveLength(2)
    expect(setsOnDate(await allSessionEvents(), '2026-01-10')).toEqual([])
  })

  it('gives every event a strictly increasing timestamp', async () => {
    const identity = {
      localDate: '2026-01-10',
      splitDayId: 'day1',
      exerciseId: 'ex-back-squat',
      setIndex: 0,
    }
    await logSet({ ...identity, setIndex: 0 }, { weightKg: 100, reps: 5 }, 'dev1')
    await logSet({ ...identity, setIndex: 1 }, { weightKg: 100, reps: 5 }, 'dev1')
    await logSet({ ...identity, setIndex: 2 }, { weightKg: 100, reps: 5 }, 'dev1')

    const stamps = (await allSessionEvents()).map((e) => e.timestamp).sort((a, b) => a - b)
    expect(new Set(stamps).size).toBe(3)
  })
})

describe('finishing a session', () => {
  it('marks the session and ticks the training habit for the same date', async () => {
    const habit = await createHabit({ name: 'Fitness', frequencyType: 'weekly', frequencyValue: 3 })
    await finishSession('2026-01-10', 'day1', 'dev1', habit.id)

    expect(isSessionComplete(await allSessionMarks(), '2026-01-10', 'day1')).toBe(true)
    expect(completedDatesForHabit(await allHabitEvents(), habit.id)).toEqual(
      new Set(['2026-01-10']),
    )
  })

  it('marks the session with no habit tick when no training habit is set', async () => {
    await finishSession('2026-01-10', 'day1', 'dev1')
    expect(isSessionComplete(await allSessionMarks(), '2026-01-10', 'day1')).toBe(true)
    expect(await allHabitEvents()).toEqual([])
  })

  it('leaves the habit ticked when the session is un-finished', async () => {
    const habit = await createHabit({ name: 'Fitness', frequencyType: 'weekly', frequencyValue: 3 })
    await finishSession('2026-01-10', 'day1', 'dev1', habit.id)
    await unfinishSession('2026-01-10', 'day1', 'dev1')

    expect(isSessionComplete(await allSessionMarks(), '2026-01-10', 'day1')).toBe(false)
    expect(completedDatesForHabit(await allHabitEvents(), habit.id)).toEqual(
      new Set(['2026-01-10']),
    )
  })
})
