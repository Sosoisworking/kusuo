import { db, type Goal } from './schema'

export interface CreateGoalInput {
  title: string
  targetDate?: string
}

export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  const now = Date.now()
  const goal: Goal = {
    id: crypto.randomUUID(),
    title: input.title,
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

/** Marks the goal done: sets isActive false and archivedAt. */
export async function archiveGoal(id: string): Promise<void> {
  const now = Date.now()
  await db.goals.update(id, { isActive: false, archivedAt: now, updatedAt: now })
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
