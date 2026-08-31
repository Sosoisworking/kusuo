import { db, type Goal } from './schema'

export interface CreateGoalInput {
  title: string
  description?: string
  targetDate?: string
}

export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  const now = Date.now()
  const goal: Goal = {
    id: crypto.randomUUID(),
    title: input.title,
    description: input.description,
    targetDate: input.targetDate,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }
  await db.goals.add(goal)
  return goal
}

export async function updateGoal(id: string, changes: Partial<CreateGoalInput>): Promise<void> {
  await db.goals.update(id, { ...changes, updatedAt: Date.now() })
}

/** Puts a goal away without claiming it was reached. */
export async function archiveGoal(id: string): Promise<void> {
  const now = Date.now()
  await db.goals.update(id, { isActive: false, archivedAt: now, updatedAt: now })
}

/**
 * Marks a goal reached. Separate from archiving on purpose: only a goal you
 * actually finished belongs in Records, and abandoning one is not an
 * achievement to be listed as though it were.
 */
export async function completeGoal(id: string): Promise<void> {
  const now = Date.now()
  await db.goals.update(id, { isActive: false, completedAt: now, updatedAt: now })
}

/** Reopens a goal marked done by mistake. */
export async function reopenGoal(id: string): Promise<void> {
  await db.goals.update(id, { isActive: true, completedAt: undefined, updatedAt: Date.now() })
}

/** Goals that were reached, most recently first. */
export async function listCompletedGoals(): Promise<Goal[]> {
  const goals = await db.goals.filter((g) => g.completedAt !== undefined).toArray()
  return goals.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
}

export function listActiveGoals(): Promise<Goal[]> {
  return db.goals.filter((g) => g.isActive).toArray()
}

export function listAllGoals(): Promise<Goal[]> {
  return db.goals.toArray()
}

export function getGoal(id: string): Promise<Goal | undefined> {
  return db.goals.get(id)
}
