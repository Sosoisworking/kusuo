import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../test/setup'
import { completedDatesForHabit } from '../logic/derive'
import { bestStreak, liftRecords, sessionTotals } from '../logic/records'
import { liveSets } from '../logic/sessions'
import { importBackup, isReverseImport, parseBackup, type BackupPayload } from './backup'
import { REMOVED_DAY_NAME } from './migrate'
import {
  db,
  type BodyweightEntry,
  type Exercise,
  type Habit,
  type HabitEvent,
  type SessionEvent,
  type SessionMark,
  type Split,
  type SplitDay,
} from './schema'
import { findSplitDay, getActiveSplit, listSplits } from './splits'

/**
 * The record as a version 9 phone holds it. Built to have every awkward thing a
 * real one does: a deleted day with sets still against it, a deleted day with
 * only a mark, a day turned into rest after it was trained, an inactive split
 * with old sessions, an empty split, a day imported from a share code with a
 * movement that came with it, corrections, a void, sets from before set ids.
 */
interface Record9 {
  habits: Habit[]
  habitEvents: HabitEvent[]
  exercises: Exercise[]
  splits: Split[]
  sessionEvents: SessionEvent[]
  sessionMarks: SessionMark[]
  bodyweight: BodyweightEntry[]
}

const T = Date.UTC(2025, 8, 1, 12) // 1 Sep 2025, noon UTC
const HOUR = 3_600_000

function fixture(): Record9 {
  let clock = T
  const tick = () => (clock += HOUR)
  let n = 0
  const id = (prefix: string) => `${prefix}-${++n}`

  const exercise = (exerciseId: string, name: string, isCustom = false): Exercise => ({
    id: exerciseId,
    name,
    category: 'push',
    muscleGroup: 'Chest',
    equipment: 'Barbell',
    isCustom,
    createdAt: T,
    updatedAt: T,
  })
  const exercises = [
    exercise('ex-barbell-bench-press', 'Barbell bench press'),
    exercise('ex-back-squat', 'Back squat'),
    exercise('ex-deadlift', 'Deadlift'),
    exercise('custom-zercher', 'Zercher squat', true), // arrived with a share code
  ]

  const day = (dayId: string, label: string, kind: SplitDay['kind'] = 'training'): SplitDay => ({
    id: dayId,
    label,
    kind,
    entries:
      kind === 'rest'
        ? []
        : [
            { exerciseId: 'ex-barbell-bench-press', sets: 4, repsMin: 6, repsMax: 8 },
            { exerciseId: 'ex-deadlift', sets: 3, repsMin: 5, repsMax: 5 },
          ],
  })

  const batman: Split = {
    id: 'split-b',
    name: 'Batman',
    seededFrom: 'split-batman',
    days: [
      day('b-chest', 'Chest'),
      day('b-back', 'Back'),
      // Trained on, then turned into a rest day: its entries went, its sets stayed.
      day('b-arms', 'Arms', 'rest'),
      day('b-rest', 'Rest', 'rest'),
      day('b-legs', 'Legs'),
      {
        id: 'b-shared',
        label: 'Legs (shared)',
        kind: 'training',
        entries: [{ exerciseId: 'custom-zercher', sets: 3, repsMin: 8, repsMax: 10 }],
      },
    ],
    isActive: true,
    createdAt: T,
    updatedAt: T + 400 * HOUR, // edited since it was seeded
  }
  const ppl: Split = {
    id: 'split-a',
    name: 'Push / Pull / Legs',
    seededFrom: 'split-ppl-3',
    days: [day('p-push', 'Push'), day('p-pull', 'Pull'), day('p-legs', 'Legs')],
    isActive: false,
    createdAt: T - 100 * HOUR,
    updatedAt: T - 100 * HOUR, // never edited
  }
  const empty: Split = {
    id: 'split-c',
    name: 'My split',
    days: [],
    isActive: false,
    createdAt: T + 50 * HOUR,
    updatedAt: T + 50 * HOUR,
  }

  const sessionEvents: SessionEvent[] = []
  const set = (
    localDate: string,
    splitDayId: string,
    exerciseId: string,
    setIndex: number,
    weightKg: number,
    reps: number,
    extra: Partial<SessionEvent> = {},
  ) => {
    const event: SessionEvent = {
      id: id('se'),
      localDate,
      splitDayId,
      exerciseId,
      setIndex,
      weightKg,
      reps,
      action: 'log',
      timestamp: tick(),
      deviceId: 'phone',
      ...extra,
    }
    sessionEvents.push(event)
    return event
  }
  const sessionMarks: SessionMark[] = []
  const mark = (localDate: string, splitDayId: string, action: SessionMark['action'] = 'complete') =>
    sessionMarks.push({ id: id('sm'), localDate, splitDayId, action, timestamp: tick(), deviceId: 'phone' })

  // Old programme, before set ids existed.
  set('2025-08-20', 'p-push', 'ex-barbell-bench-press', 0, 70, 8)
  set('2025-08-20', 'p-push', 'ex-barbell-bench-press', 1, 70, 7)
  mark('2025-08-20', 'p-push')
  set('2025-08-21', 'p-legs', 'ex-back-squat', 0, 100, 5)
  mark('2025-08-21', 'p-legs')

  // A day since deleted from Batman, with sets: an orphan that was trained.
  set('2025-09-02', 'b-deleted-trained', 'ex-deadlift', 0, 140, 3, { setId: 'set-d1' })
  set('2025-09-02', 'b-deleted-trained', 'ex-deadlift', 1, 140, 3, { setId: 'set-d2' })
  mark('2025-09-02', 'b-deleted-trained')
  // A deleted rest day: a mark and nothing else.
  mark('2025-09-03', 'b-deleted-rest')

  // Current programme.
  const s1 = set('2025-09-08', 'b-chest', 'ex-barbell-bench-press', 0, 80, 6, { setId: 'set-c1' })
  set('2025-09-08', 'b-chest', 'ex-barbell-bench-press', 1, 80, 6, { setId: 'set-c2', rpe: 8 })
  // A correction of the first set, and a set logged then voided.
  set('2025-09-08', 'b-chest', 'ex-barbell-bench-press', 0, 82.5, 6, { setId: s1.setId })
  set('2025-09-08', 'b-chest', 'ex-barbell-bench-press', 2, 85, 2, { setId: 'set-c3' })
  set('2025-09-08', 'b-chest', 'ex-barbell-bench-press', 2, 85, 2, { setId: 'set-c3', action: 'void' })
  mark('2025-09-08', 'b-chest')
  // Arms, trained before it became a rest day.
  set('2025-09-10', 'b-arms', 'ex-barbell-bench-press', 0, 60, 12, { setId: 'set-a1' })
  mark('2025-09-10', 'b-arms')
  mark('2025-09-11', 'b-rest')
  set('2025-09-12', 'b-shared', 'custom-zercher', 0, 90, 8, { setId: 'set-z1' })
  mark('2025-09-12', 'b-shared')
  // Finished, then un-finished.
  mark('2025-09-15', 'b-legs')
  mark('2025-09-15', 'b-legs', 'uncomplete')

  const habit: Habit = {
    id: 'habit-fitness',
    name: 'Fitness',
    frequencyType: 'daily',
    frequencyValue: 1,
    isActive: true,
    createdAt: T - 200 * HOUR,
    updatedAt: T - 200 * HOUR,
  }
  const habitEvents: HabitEvent[] = sessionMarks
    .filter((m) => m.action === 'complete')
    .map((m) => ({
      id: id('he'),
      habitId: habit.id,
      localDate: m.localDate,
      action: 'complete' as const,
      timestamp: m.timestamp,
      deviceId: 'phone',
    }))

  const bodyweight: BodyweightEntry[] = [
    { id: 'bw-1', localDate: '2025-09-08', weightKg: 82, timestamp: tick(), deviceId: 'phone' },
  ]

  return {
    habits: [habit],
    habitEvents,
    exercises,
    splits: [batman, ppl, empty],
    sessionEvents,
    sessionMarks,
    bodyweight,
  }
}

/** Puts a record into a database at version 9, then lets the app open it, which runs the upgrade. */
async function upgradeFromVersion9(record: Record9): Promise<void> {
  db.close()
  await Dexie.delete(db.name)

  const old = new Dexie(db.name)
  old.version(9).stores({
    habits: 'id, isActive, archivedAt',
    habitEvents: 'id, habitId, localDate, [habitId+localDate], timestamp',
    settings: 'deviceId',
    goals: 'id, isActive, archivedAt, completedAt',
    reflections: 'id, localDate, timestamp',
    exercises: 'id, category, isCustom',
    splits: 'id, isActive',
    sessionEvents: 'id, localDate, exerciseId, splitDayId, [localDate+splitDayId], timestamp',
    sessionMarks: 'id, localDate, timestamp',
    bodyweight: 'id, localDate, timestamp',
  })
  await old.open()
  for (const [table, rows] of Object.entries(record)) await old.table(table).bulkAdd(rows)
  old.close()

  await db.open()
}

/** How a version 9 phone answered: the first active split in id order, and days looked up across every split. */
function oldAnswers(record: Record9) {
  const byId = [...record.splits].sort((a, b) => (a.id < b.id ? -1 : 1))
  const findDay = (dayId: string) => {
    for (const split of byId) {
      const day = split.days.find((d) => d.id === dayId)
      if (day) return { splitId: split.id, day }
    }
    return undefined
  }
  return { splits: byId, active: byId.find((s) => s.isActive), findDay }
}

/** Every number Records and the streaks show, from the events alone. */
function derived(record: Pick<Record9, 'sessionEvents' | 'habitEvents'>) {
  return {
    lifts: liftRecords(record.sessionEvents),
    sessions: sessionTotals(liveSets(record.sessionEvents)),
    streak: bestStreak(completedDatesForHabit(record.habitEvents, 'habit-fitness')),
  }
}

/** The newest stamp a phone had written before the update: what a backup made then would carry. */
function newestStamp(record: Record9): number {
  let latest = 0
  for (const rows of Object.values(record) as Record<string, unknown>[][]) {
    for (const row of rows) {
      const at = typeof row.timestamp === 'number' ? row.timestamp : row.updatedAt
      if (typeof at === 'number' && at > latest) latest = at
    }
  }
  return latest
}

async function expectParity(record: Record9): Promise<void> {
  const before = oldAnswers(record)

  // The screens see the same splits, in the same order, with the same active one.
  const splits = await listSplits()
  expect(splits).toEqual(
    before.splits.map((s) => ({ ...s, isActive: s.id === before.active?.id })),
  )
  expect((await getActiveSplit())?.id).toBe(before.active?.id)

  // Every set and mark names a routine, and every lookup a screen makes gives
  // the answer it gave before — a deleted day still finds nothing.
  for (const ref of [...record.sessionEvents, ...record.sessionMarks]) {
    expect(await db.routines.get(ref.splitDayId), ref.splitDayId).toBeDefined()
    const found = await findSplitDay(ref.splitDayId)
    const old = before.findDay(ref.splitDayId)
    expect(found?.split.id).toBe(old?.splitId)
    expect(found?.day).toEqual(old?.day)
  }

  // Nothing in the record was rewritten.
  expect(await db.sessionEvents.toArray()).toEqual(
    expect.arrayContaining(record.sessionEvents),
  )
  expect(await db.sessionEvents.count()).toBe(record.sessionEvents.length)
  expect(await db.sessionMarks.count()).toBe(record.sessionMarks.length)
  expect(await db.habitEvents.count()).toBe(record.habitEvents.length)
  expect(await db.bodyweight.count()).toBe(record.bodyweight.length)

  // Records and streaks, recomputed from what is stored now.
  expect(
    derived({
      sessionEvents: await db.sessionEvents.toArray(),
      habitEvents: await db.habitEvents.toArray(),
    }),
  ).toEqual(derived(record))

  // No new stamps: a backup made just before the update still restores
  // without warning that this phone holds newer work.
  expect(
    await isReverseImport({ exportedAt: newestStamp(record) } as BackupPayload),
  ).toBe(false)
}

beforeEach(async () => {
  await resetDatabase()
})

describe('upgrading a version 9 phone', () => {
  it('keeps every split, day, set and mark exactly as the screens saw them', async () => {
    const record = fixture()
    await upgradeFromVersion9(record)
    expect(db.verno).toBe(10)
    await expectParity(record)
  })

  it('keeps the old splits table untouched, so the upgrade can be run again', async () => {
    const record = fixture()
    await upgradeFromVersion9(record)
    expect(await db.splits.toArray()).toEqual(
      [...record.splits].sort((a, b) => (a.id < b.id ? -1 : 1)),
    )
  })

  it('makes each split day a routine with the same id, and each split a plan', async () => {
    await upgradeFromVersion9(fixture())

    const arms = await db.routines.get('b-arms')
    expect(arms).toMatchObject({ name: 'Arms', kind: 'rest', archived: false, entries: [] })
    const shared = await db.routines.get('b-shared')
    expect(shared?.entries).toEqual([
      { exerciseId: 'custom-zercher', sets: 3, repsMin: 8, repsMax: 10 },
    ])
    expect(await db.exercises.get('custom-zercher')).toMatchObject({ isCustom: true })

    expect((await db.plans.get('split-b'))?.routineIds).toEqual([
      'b-chest',
      'b-back',
      'b-arms',
      'b-rest',
      'b-legs',
      'b-shared',
    ])
    expect((await db.plans.get('split-c'))?.routineIds).toEqual([])
    expect(await db.schedule.toArray()).toEqual([
      { id: 'schedule', activePlanId: 'split-b', updatedAt: T + 400 * HOUR },
    ])
  })

  it('gives a deleted day an archived routine, in no plan', async () => {
    await upgradeFromVersion9(fixture())

    const trained = await db.routines.get('b-deleted-trained')
    expect(trained).toMatchObject({ name: REMOVED_DAY_NAME, kind: 'training', archived: true })
    const rested = await db.routines.get('b-deleted-rest')
    expect(rested).toMatchObject({ name: REMOVED_DAY_NAME, kind: 'rest', archived: true })

    const inPlans = (await db.plans.toArray()).flatMap((p) => p.routineIds)
    expect(inPlans).not.toContain('b-deleted-trained')
    expect(inPlans).not.toContain('b-deleted-rest')
  })

  it('upgrades a phone with no splits at all', async () => {
    const record = { ...fixture(), splits: [], sessionEvents: [], sessionMarks: [] }
    await upgradeFromVersion9(record)
    expect(await db.routines.count()).toBe(0)
    expect(await db.plans.count()).toBe(0)
    expect(await db.schedule.count()).toBe(0)
    expect(await getActiveSplit()).toBeUndefined()
  })
})

describe('importing a version 5 backup', () => {
  function asVersion5File(record: Record9): string {
    return JSON.stringify({
      schemaVersion: 5,
      exportedAt: newestStamp(record) + 1,
      goals: [],
      reflections: [],
      ...record,
    })
  }

  it('arrives at the same plans and routines as upgrading the phone', async () => {
    const record = fixture()
    await upgradeFromVersion9(record)
    const upgraded = {
      routines: await db.routines.orderBy('id').toArray(),
      plans: await db.plans.orderBy('id').toArray(),
      schedule: await db.schedule.toArray(),
    }

    await resetDatabase()
    await importBackup(parseBackup(asVersion5File(record)))

    expect(await db.routines.orderBy('id').toArray()).toEqual(upgraded.routines)
    expect(await db.plans.orderBy('id').toArray()).toEqual(upgraded.plans)
    expect(await db.schedule.toArray()).toEqual(upgraded.schedule)
    await expectParity(record)
  })

  it('keeps the file’s splits in the old table, as an upgraded phone does', async () => {
    const record = fixture()
    await importBackup(parseBackup(asVersion5File(record)))
    expect(await db.splits.count()).toBe(record.splits.length)
  })

  it('leaves the old table empty when a version 6 file is imported over it', async () => {
    const record = fixture()
    await importBackup(parseBackup(asVersion5File(record)))
    const { buildBackup } = await import('./backup')
    const v6 = await buildBackup()
    expect('splits' in v6).toBe(false)

    await importBackup(parseBackup(JSON.stringify(v6)))
    expect(await db.splits.count()).toBe(0)
    await expectParity(record)
  })
})

/*
  A real exported backup, used on this machine only and never committed. Point
  KUSUO_REAL_BACKUP at the file to run these:

    KUSUO_REAL_BACKUP=~/Downloads/kusuo-backup.json npx vitest run src/db/migrate.test.ts
*/
const realBackupPath: string | undefined = import.meta.env.KUSUO_REAL_BACKUP

/** Node's file reader, imported by name so the app's browser-only types never see Node's. */
async function readRealBackup(): Promise<string> {
  const fs = 'node:fs'
  const { readFileSync } = (await import(/* @vite-ignore */ fs)) as {
    readFileSync: (path: string, encoding: 'utf8') => string
  }
  return readFileSync(realBackupPath as string, 'utf8')
}

describe.skipIf(!realBackupPath)('a real backup', () => {
  async function realRecord(): Promise<Record9> {
    const file = parseBackup(await readRealBackup())
    return {
      habits: file.habits,
      habitEvents: file.habitEvents,
      exercises: file.exercises,
      splits: file.splits ?? [],
      sessionEvents: file.sessionEvents,
      sessionMarks: file.sessionMarks,
      bodyweight: file.bodyweight,
    }
  }

  it('survives the phone upgrade with nothing lost', async () => {
    const record = await realRecord()
    await upgradeFromVersion9(record)
    await expectParity(record)
  })

  it('survives being imported as a file with nothing lost', async () => {
    const record = await realRecord()
    await importBackup(parseBackup(await readRealBackup()))
    await expectParity(record)
  })
})
