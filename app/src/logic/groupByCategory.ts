import type { Habit } from '../db/schema'

export interface CategoryGroup<T> {
  category: string | null
  rows: T[]
}

/** Groups rows by habit.category, preserving input order within each group. Uncategorized habits go in category: null. */
export function groupHabitsByCategory<T extends { habit: Habit }>(rows: T[]): CategoryGroup<T>[] {
  const groups = new Map<string | null, T[]>()
  for (const row of rows) {
    const category = row.habit.category || null
    const existing = groups.get(category)
    if (existing) {
      existing.push(row)
    } else {
      groups.set(category, [row])
    }
  }
  return Array.from(groups.entries()).map(([category, rows]) => ({ category, rows }))
}
