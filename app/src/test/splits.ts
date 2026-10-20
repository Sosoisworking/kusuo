import { convertSplits } from '../db/migrate'
import { db, type Split } from '../db/schema'

/**
 * Stores a hand-built split the way the app stores one: a plan, its routines,
 * and the schedule if it is the active one. Tests used to put it straight into
 * the splits table, which the app no longer reads.
 */
export async function addSplit(split: Split): Promise<void> {
  const { routines, plans, schedule } = convertSplits([split], [], [])
  await db.transaction('rw', db.routines, db.plans, db.schedule, async () => {
    await db.routines.bulkAdd(routines)
    await db.plans.bulkAdd(plans)
    await db.schedule.bulkPut(schedule)
  })
}
