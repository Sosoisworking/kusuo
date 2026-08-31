import { SPLIT_TEMPLATES, type SplitTemplate } from '../lib/splitTemplates'
import { db, type Split, type SplitDay } from './schema'

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
  const now = Date.now()
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
  await db.splits.add(split)
  if (makeActive) await setActiveSplit(split.id)
  return (await db.splits.get(split.id)) ?? split
}

/** Exactly one split is active at a time; activating one deactivates the rest. */
export async function setActiveSplit(splitId: string): Promise<void> {
  await db.transaction('rw', db.splits, async () => {
    const now = Date.now()
    await db.splits
      .filter((s) => s.isActive && s.id !== splitId)
      .modify({ isActive: false, updatedAt: now })
    await db.splits.update(splitId, { isActive: true, updatedAt: now })
  })
}

export async function getActiveSplit(): Promise<Split | undefined> {
  return db.splits.filter((s) => s.isActive).first()
}

export function listSplits(): Promise<Split[]> {
  return db.splits.toArray()
}

export function getSplit(id: string): Promise<Split | undefined> {
  return db.splits.get(id)
}

/** Renames a split or replaces its days wholesale (the editor rebuilds the array). */
export async function updateSplit(
  id: string,
  changes: { name?: string; days?: SplitDay[] },
): Promise<void> {
  await db.splits.update(id, { ...changes, updatedAt: Date.now() })
}

/** Finds the day a session was logged against, across every split. */
export async function findSplitDay(
  splitDayId: string,
): Promise<{ split: Split; day: SplitDay } | undefined> {
  const splits = await db.splits.toArray()
  for (const split of splits) {
    const day = split.days.find((d) => d.id === splitDayId)
    if (day) return { split, day }
  }
  return undefined
}
