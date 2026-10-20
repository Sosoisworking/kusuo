import { nextTimestamp } from './clock'
import { SPLIT_TEMPLATES, type SplitTemplate } from '../lib/splitTemplates'
import { createCustomExercise } from './exercises'
import type { SharedWorkout } from '../lib/share'
import { SCHEDULE_ID } from './migrate'
import {
  db,
  type Plan,
  type Routine,
  type Split,
  type SplitDay,
  type SplitDayKind,
  type SplitEntry,
} from './schema'

/*
  Splits are stored as plans and routines since database version 10 (see
  `Plan` and `Routine` in schema.ts). This module still speaks in splits and
  days, assembled from those rows, so the screens did not change when the
  storage did. Every function here kept its name and its answer.
*/

function copyEntries(entries: readonly SplitEntry[]): SplitEntry[] {
  return entries.map((entry) => ({
    exerciseId: entry.exerciseId,
    sets: entry.sets,
    repsMin: entry.repsMin,
    repsMax: entry.repsMax,
  }))
}

function toDay(routine: Routine): SplitDay {
  return { id: routine.id, label: routine.name, kind: routine.kind, entries: copyEntries(routine.entries) }
}

function toSplit(plan: Plan, routines: ReadonlyMap<string, Routine>, activePlanId?: string): Split {
  const days: SplitDay[] = []
  for (const id of plan.routineIds) {
    const routine = routines.get(id)
    if (routine) days.push(toDay(routine))
  }
  return {
    id: plan.id,
    name: plan.name,
    days,
    ...(plan.seededFrom === undefined ? {} : { seededFrom: plan.seededFrom }),
    isActive: plan.id === activePlanId,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  }
}

async function activePlanId(): Promise<string | undefined> {
  return (await db.schedule.get(SCHEDULE_ID))?.activePlanId
}

async function routinesFor(plans: readonly Plan[]): Promise<Map<string, Routine>> {
  const ids = [...new Set(plans.flatMap((plan) => plan.routineIds))]
  const rows = await db.routines.bulkGet(ids)
  return new Map(rows.filter((r): r is Routine => r !== undefined).map((r) => [r.id, r]))
}

async function assemble(plans: readonly Plan[]): Promise<Split[]> {
  const [routines, active] = await Promise.all([routinesFor(plans), activePlanId()])
  return plans.map((plan) => toSplit(plan, routines, active))
}

/**
 * Stores a new split: one routine per day and a plan listing them. Used when a
 * split is created; edits go through `updateSplit`.
 */
async function addPlan(split: Omit<Split, 'isActive'>): Promise<void> {
  await db.transaction('rw', db.plans, db.routines, async () => {
    await db.routines.bulkAdd(
      split.days.map((day) => ({
        id: day.id,
        name: day.label,
        kind: day.kind,
        entries: copyEntries(day.entries),
        archived: false,
        createdAt: split.createdAt,
        updatedAt: split.updatedAt,
      })),
    )
    await db.plans.add({
      id: split.id,
      name: split.name,
      ...(split.seededFrom === undefined ? {} : { seededFrom: split.seededFrom }),
      routineIds: split.days.map((day) => day.id),
      createdAt: split.createdAt,
      updatedAt: split.updatedAt,
    })
  })
}

export function getSplitTemplate(templateId: string): SplitTemplate | undefined {
  return SPLIT_TEMPLATES.find((t) => t.id === templateId)
}

/**
 * Creates the user's own copy of a template. The split and every day get fresh
 * UUIDs — session events point at day ids the user owns, so editing or
 * re-seeding a template can never orphan logged history.
 */
export async function instantiateTemplate(templateId: string, makeActive = true): Promise<Split> {
  const template = getSplitTemplate(templateId)
  if (!template) throw new Error(`Unknown split template: ${templateId}`)
  const now = nextTimestamp()
  const days: SplitDay[] = template.days.map((d) => ({
    id: crypto.randomUUID(),
    label: d.label,
    kind: d.kind ?? 'training',
    entries: d.entries.map((entry) => ({ ...entry })),
  }))
  const split: Split = {
    id: crypto.randomUUID(),
    name: template.name,
    days,
    seededFrom: template.id,
    isActive: false,
    createdAt: now,
    updatedAt: now,
  }
  await addPlan(split)
  if (makeActive) await setActiveSplit(split.id)
  return (await getSplit(split.id)) ?? split
}

/**
 * Exactly one split is active at a time; activating one deactivates the rest.
 *
 * Both plans are stamped as well as the pointer, as both splits were: the
 * Splits screen shows when the active one was last updated, and switching to it
 * has always counted.
 */
export async function setActiveSplit(splitId: string): Promise<void> {
  await db.transaction('rw', db.plans, db.schedule, async () => {
    if (!(await db.plans.get(splitId))) return
    const now = nextTimestamp()
    const previous = await activePlanId()
    if (previous !== undefined && previous !== splitId) {
      await db.plans.update(previous, { updatedAt: now })
    }
    await db.plans.update(splitId, { updatedAt: now })
    await db.schedule.put({ id: SCHEDULE_ID, activePlanId: splitId, updatedAt: now })
  })
}

export async function getActiveSplit(): Promise<Split | undefined> {
  const id = await activePlanId()
  return id === undefined ? undefined : getSplit(id)
}

export async function listSplits(): Promise<Split[]> {
  return assemble(await db.plans.toArray())
}

export async function getSplit(id: string): Promise<Split | undefined> {
  const plan = await db.plans.get(id)
  return plan ? (await assemble([plan]))[0] : undefined
}

/**
 * Renames a split or replaces its days wholesale (the editor rebuilds the array).
 *
 * A routine is stamped only when it actually changed, so a later merge between
 * devices can tell an edit from a bystander. A day dropped from the list is
 * archived rather than deleted — the sets logged against it still name it.
 */
export async function updateSplit(
  id: string,
  changes: { name?: string; days?: SplitDay[] },
): Promise<void> {
  await db.transaction('rw', db.plans, db.routines, async () => {
    const plan = await db.plans.get(id)
    if (!plan) return
    const now = nextTimestamp()

    let routineIds = plan.routineIds
    if (changes.days) {
      const days = changes.days
      routineIds = days.map((day) => day.id)
      const before = await db.routines.bulkGet(routineIds)
      const writes: Routine[] = []
      days.forEach((day, i) => {
        const old = before[i]
        const next: Routine = {
          id: day.id,
          name: day.label,
          kind: day.kind,
          entries: copyEntries(day.entries),
          archived: false,
          createdAt: old?.createdAt ?? now,
          updatedAt: now,
        }
        const unchanged =
          old !== undefined &&
          old.name === next.name &&
          old.kind === next.kind &&
          !old.archived &&
          JSON.stringify(old.entries) === JSON.stringify(next.entries)
        if (!unchanged) writes.push(next)
      })
      await db.routines.bulkPut(writes)

      const kept = new Set(routineIds)
      const elsewhere = new Set(
        (await db.plans.toArray()).filter((p) => p.id !== id).flatMap((p) => p.routineIds),
      )
      const dropped = plan.routineIds.filter((r) => !kept.has(r) && !elsewhere.has(r))
      for (const routineId of dropped) {
        await db.routines.update(routineId, { archived: true, updatedAt: now })
      }
    }

    await db.plans.update(id, {
      ...(changes.name === undefined ? {} : { name: changes.name }),
      routineIds,
      updatedAt: now,
    })
  })
}

/** Finds the day a session was logged against, across every split. */
export async function findSplitDay(
  splitDayId: string,
): Promise<{ split: Split; day: SplitDay } | undefined> {
  const splits = await listSplits()
  for (const split of splits) {
    const day = split.days.find((d) => d.id === splitDayId)
    if (day) return { split, day }
  }
  return undefined
}

/**
 * Adds a shared workout to a split as a **new day**. Nothing existing is
 * touched — an import that could overwrite your programme would make accepting
 * one from someone else an act of faith.
 *
 * Movements arrive by name. One already known is reused; one that is not
 * becomes a custom exercise, so the day is complete rather than half-missing.
 */
export async function importWorkoutAsDay(
  splitId: string,
  workout: SharedWorkout,
): Promise<SplitDay> {
  const split = await getSplit(splitId)
  if (!split) throw new Error(`Unknown split: ${splitId}`)

  const existing = await db.exercises.toArray()
  const byName = new Map(existing.map((e) => [e.name.trim().toLowerCase(), e]))

  const entries: SplitEntry[] = []
  for (const entry of workout.entries) {
    const key = entry.name.trim().toLowerCase()
    let exercise = byName.get(key)
    if (!exercise) {
      exercise = await createCustomExercise({
        name: entry.name.trim(),
        category: 'push',
        muscleGroup: 'Imported',
        equipment: 'Other',
      })
      byName.set(key, exercise)
    }
    entries.push({
      exerciseId: exercise.id,
      sets: entry.sets,
      repsMin: entry.repsMin,
      repsMax: entry.repsMax,
    })
  }

  // A label that says where it came from, and does not collide with a day the
  // split already has.
  const taken = new Set(split.days.map((d) => d.label))
  let label = `${workout.label} (shared)`
  let n = 2
  while (taken.has(label)) label = `${workout.label} (shared ${n++})`

  const day: SplitDay = { id: crypto.randomUUID(), label, kind: 'training', entries }
  await updateSplit(splitId, { days: [...split.days, day] })
  return day
}

/** A programme with no days in it yet, ready to be built up. */
export async function createSplit(name: string): Promise<Split> {
  const now = nextTimestamp()
  const split: Split = {
    id: crypto.randomUUID(),
    name: name.trim() || 'My split',
    days: [],
    isActive: false,
    createdAt: now,
    updatedAt: now,
  }
  await addPlan(split)
  await setActiveSplit(split.id)
  return (await getSplit(split.id)) ?? split
}

export async function addSplitDay(splitId: string, label: string, kind: SplitDayKind = 'training'): Promise<SplitDay> {
  const split = await getSplit(splitId)
  if (!split) throw new Error(`Unknown split: ${splitId}`)
  const day: SplitDay = { id: crypto.randomUUID(), label: label.trim() || 'New day', kind, entries: [] }
  await updateSplit(splitId, { days: [...split.days, day] })
  return day
}

export async function renameSplitDay(splitId: string, dayId: string, label: string): Promise<void> {
  const split = await getSplit(splitId)
  if (!split) return
  await updateSplit(splitId, {
    days: split.days.map((d) => (d.id === dayId ? { ...d, label: label.trim() || d.label } : d)),
  })
}

/**
 * Switches a day between training and rest. A rest day holds no exercises, so
 * becoming one empties it — the entries are the plan, and a rest day has none.
 */
export async function setSplitDayKind(splitId: string, dayId: string, kind: SplitDayKind): Promise<void> {
  const split = await getSplit(splitId)
  if (!split) return
  await updateSplit(splitId, {
    days: split.days.map((d) =>
      d.id === dayId ? { ...d, kind, entries: kind === 'rest' ? [] : d.entries } : d,
    ),
  })
}

/**
 * Removes a day from the plan. Sessions logged against it stay in the event log
 * untouched — the day leaving the programme does not unmake the training, so it
 * still counts toward records and still shows on the calendar.
 */
export async function removeSplitDay(splitId: string, dayId: string): Promise<void> {
  const split = await getSplit(splitId)
  if (!split) return
  await updateSplit(splitId, { days: split.days.filter((d) => d.id !== dayId) })
}
