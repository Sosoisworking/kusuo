import { beforeEach, describe, expect, it } from 'vitest'
import { archiveGoal, createGoal, getGoal, listActiveGoals, listAllGoals, updateGoal } from './goals'
import { db } from './schema'

beforeEach(async () => {
  await db.goals.clear()
})

describe('goal CRUD', () => {
  it('createGoal sets correct defaults', async () => {
    const goal = await createGoal({ title: 'Run a marathon' })
    expect(goal.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(goal.title).toBe('Run a marathon')
    expect(goal.isActive).toBe(true)
    expect(goal.archivedAt).toBeUndefined()
    expect(goal.createdAt).toBeTypeOf('number')
    expect(goal.updatedAt).toBeTypeOf('number')
  })

  it('createGoal stores an optional targetDate', async () => {
    const goal = await createGoal({ title: 'Learn piano', targetDate: '2026-12-31' })
    expect(goal.targetDate).toBe('2026-12-31')
  })

  it('updateGoal updates fields and bumps updatedAt', async () => {
    const goal = await createGoal({ title: 'Read 12 books' })
    const before = goal.updatedAt
    await new Promise((resolve) => setTimeout(resolve, 5))
    await updateGoal(goal.id, { title: 'Read 20 books', targetDate: '2026-06-01' })

    const updated = await db.goals.get(goal.id)
    expect(updated?.title).toBe('Read 20 books')
    expect(updated?.targetDate).toBe('2026-06-01')
    expect(updated?.updatedAt).toBeGreaterThan(before)
  })

  it('archiveGoal sets isActive false and archivedAt', async () => {
    const goal = await createGoal({ title: 'Save $10k' })
    await archiveGoal(goal.id)

    const updated = await db.goals.get(goal.id)
    expect(updated?.isActive).toBe(false)
    expect(updated?.archivedAt).toBeTypeOf('number')
  })

  it('listActiveGoals excludes archived goals', async () => {
    const a = await createGoal({ title: 'Goal A' })
    const b = await createGoal({ title: 'Goal B' })
    await archiveGoal(a.id)

    const active = await listActiveGoals()
    expect(active.map((g) => g.id)).toEqual([b.id])
  })

  it('listAllGoals includes archived goals', async () => {
    const a = await createGoal({ title: 'Goal A' })
    const b = await createGoal({ title: 'Goal B' })
    await archiveGoal(a.id)

    const all = await listAllGoals()
    expect(all.map((g) => g.id).sort()).toEqual([a.id, b.id].sort())
  })

  it('getGoal returns undefined for a missing id', async () => {
    const result = await getGoal('does-not-exist')
    expect(result).toBeUndefined()
  })
})
