import { describe, expect, it } from 'vitest'
import { groupHabitsByCategory } from './groupByCategory'
import type { Habit } from '../db/schema'

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

describe('groupHabitsByCategory', () => {
  it('returns a single group with no category key for uncategorized habits', () => {
    const a = { habit: makeHabit({ name: 'A' }) }
    const b = { habit: makeHabit({ name: 'B' }) }
    const groups = groupHabitsByCategory([a, b])
    expect(groups).toEqual([{ category: null, rows: [a, b] }])
  })

  it('groups by category, preserving input order within each group', () => {
    const a = { habit: makeHabit({ name: 'A', category: 'Health' }) }
    const b = { habit: makeHabit({ name: 'B', category: 'Work' }) }
    const c = { habit: makeHabit({ name: 'C', category: 'Health' }) }
    const groups = groupHabitsByCategory([a, b, c])
    expect(groups).toEqual([
      { category: 'Health', rows: [a, c] },
      { category: 'Work', rows: [b] },
    ])
  })

  it('puts empty-string category in the uncategorized bucket', () => {
    const a = { habit: makeHabit({ name: 'A', category: '' }) }
    const b = { habit: makeHabit({ name: 'B', category: 'Work' }) }
    const groups = groupHabitsByCategory([a, b])
    expect(groups).toEqual([
      { category: null, rows: [a] },
      { category: 'Work', rows: [b] },
    ])
  })

  it('returns an empty array for empty input', () => {
    expect(groupHabitsByCategory([])).toEqual([])
  })
})
