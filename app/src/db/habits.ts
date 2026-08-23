import { db, type Habit, type FrequencyType } from './schema'

export interface CreateHabitInput {
  name: string
  description?: string
  category?: string
  frequencyType: FrequencyType
  frequencyValue: number
}

export async function createHabit(input: CreateHabitInput): Promise<Habit> {
  const now = Date.now()
  const habit: Habit = {
    id: crypto.randomUUID(),
    name: input.name,
    description: input.description,
    category: input.category,
    frequencyType: input.frequencyType,
    frequencyValue: input.frequencyValue,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }
  await db.habits.add(habit)
  return habit
}

export type UpdateHabitInput = Partial<CreateHabitInput>

/** Frequency/name edits apply going forward only — past dates are not rewritten. */
export async function updateHabit(id: string, changes: UpdateHabitInput): Promise<void> {
  await db.habits.update(id, { ...changes, updatedAt: Date.now() })
}

/** Sets archivedAt; the habit stays in history/detail views but disappears from Today/template pickers via listActiveHabits. */
export async function archiveHabit(id: string): Promise<void> {
  const now = Date.now()
  await db.habits.update(id, { isActive: false, archivedAt: now, updatedAt: now })
}

export function listActiveHabits(): Promise<Habit[]> {
  return db.habits.filter((h) => h.isActive).toArray()
}

export function listAllHabits(): Promise<Habit[]> {
  return db.habits.toArray()
}

export function getHabit(id: string): Promise<Habit | undefined> {
  return db.habits.get(id)
}

/** Distinct, non-empty categories across active habits, sorted alphabetically. */
export async function listCategories(): Promise<string[]> {
  const habits = await db.habits.filter((h) => h.isActive).toArray()
  const categories = new Set<string>()
  for (const h of habits) {
    if (h.category) categories.add(h.category)
  }
  return Array.from(categories).sort((a, b) => a.localeCompare(b))
}
