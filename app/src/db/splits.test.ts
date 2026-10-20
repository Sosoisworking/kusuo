import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../test/setup'
import { seedExercises } from './exercises'
import { db } from './schema'
import { logSet } from './sessions'
import {
  addSplitDay,
  findSplitDay,
  getActiveSplit,
  getSplit,
  instantiateTemplate,
  removeSplitDay,
  renameSplitDay,
  setActiveSplit,
  updateSplit,
} from './splits'

beforeEach(async () => {
  await resetDatabase()
  await seedExercises()
})

describe('splits stored as plans and routines', () => {
  it('archives the routine of a removed day, so its sets still belong to something', async () => {
    const split = await instantiateTemplate('split-ppl-3')
    const push = split.days[0]
    await logSet(
      { localDate: '2026-01-05', splitDayId: push.id, exerciseId: 'ex-barbell-bench-press', setIndex: 0 },
      { weightKg: 80, reps: 5 },
      'phone',
    )

    await removeSplitDay(split.id, push.id)

    expect((await getSplit(split.id))?.days.map((d) => d.id)).not.toContain(push.id)
    expect(await db.routines.get(push.id)).toMatchObject({ archived: true, name: push.label })
    // The screens still find nothing for it, as they did when it was deleted.
    expect(await findSplitDay(push.id)).toBeUndefined()
  })

  it('brings an archived routine back when its day returns', async () => {
    const split = await instantiateTemplate('split-ppl-3')
    const days = split.days
    await updateSplit(split.id, { days: days.slice(1) })
    await updateSplit(split.id, { days })

    expect(await db.routines.get(days[0].id)).toMatchObject({ archived: false })
    expect((await getSplit(split.id))?.days).toEqual(days)
  })

  it('stamps only the routine that changed', async () => {
    const split = await instantiateTemplate('split-ppl-3')
    const before = await db.routines.bulkGet(split.days.map((d) => d.id))

    await renameSplitDay(split.id, split.days[1].id, 'Back')

    const after = await db.routines.bulkGet(split.days.map((d) => d.id))
    expect(after[0]?.updatedAt).toBe(before[0]?.updatedAt)
    expect(after[1]?.updatedAt).toBeGreaterThan(before[1]?.updatedAt ?? Infinity)
    expect(after[2]?.updatedAt).toBe(before[2]?.updatedAt)
    // The plan is stamped on every edit, as the split was.
    expect((await getSplit(split.id))?.updatedAt).toBeGreaterThan(split.updatedAt)
  })

  it('keeps one pointer to the active plan', async () => {
    const first = await instantiateTemplate('split-ppl-3')
    const second = await instantiateTemplate('split-full-body-3')
    expect((await getActiveSplit())?.id).toBe(second.id)

    await setActiveSplit(first.id)
    expect(await db.schedule.count()).toBe(1)
    expect((await getActiveSplit())?.id).toBe(first.id)
    expect((await getSplit(second.id))?.isActive).toBe(false)
  })

  it('leaves the active plan alone when asked to activate one that does not exist', async () => {
    const split = await instantiateTemplate('split-ppl-3')
    await setActiveSplit('no-such-plan')
    expect((await getActiveSplit())?.id).toBe(split.id)
  })

  it('stores a new day as a routine of its own', async () => {
    const split = await instantiateTemplate('split-ppl-3')
    const day = await addSplitDay(split.id, 'Arms')
    expect(await db.routines.get(day.id)).toMatchObject({ name: 'Arms', kind: 'training', archived: false })
    expect((await db.plans.get(split.id))?.routineIds.at(-1)).toBe(day.id)
  })
})
