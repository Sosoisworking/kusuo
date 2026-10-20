import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../test/setup'
import { completedDatesForHabit } from '../logic/derive'
import { InvalidBackupError, buildBackup, importBackup, parseBackup } from './backup'
import { eventsForHabit } from './events'
import { archiveHabit, createHabit } from './habits'
import { db } from './schema'
import { finishSession, markRested, unfinishSession } from './sessions'
import { createSettings, getSettings, updateSettings } from './settings'

const DEVICE = 'phone'
const DATE = '2026-01-05'

beforeEach(async () => {
  localStorage.clear()
  localStorage.setItem('kusuo-device-id', DEVICE)
  await resetDatabase()
  await createSettings({ deviceId: DEVICE, deviceRole: 'writer' })
})

async function trainingHabit() {
  const habit = await createHabit({ name: 'Fitness', frequencyType: 'daily', frequencyValue: 1 })
  await updateSettings(DEVICE, { trainingHabitId: habit.id })
  return habit
}

describe('finishing a session', () => {
  it('finishes every routine in it, with one tick', async () => {
    const habit = await trainingHabit()
    const marks = await finishSession(DATE, ['push', 'pull'], DEVICE, habit.id)

    expect(marks.map((m) => [m.splitDayId, m.action, m.kind])).toEqual([
      ['push', 'complete', 'training'],
      ['pull', 'complete', 'training'],
    ])
    expect(await eventsForHabit(habit.id)).toHaveLength(1)
  })

  it('leaves the tick alone when a second routine is finished later the same day', async () => {
    const habit = await trainingHabit()
    await finishSession(DATE, 'push', DEVICE, habit.id)
    await finishSession(DATE, 'pull', DEVICE, habit.id)
    expect(await eventsForHabit(habit.id)).toHaveLength(1)
  })

  it('ticks again if the habit was unticked in between — finishing still means trained', async () => {
    const habit = await trainingHabit()
    await finishSession(DATE, 'push', DEVICE, habit.id)
    const { appendHabitEvent } = await import('./events')
    await appendHabitEvent(habit.id, DATE, 'uncomplete', DEVICE)
    await finishSession(DATE, 'pull', DEVICE, habit.id)

    expect(completedDatesForHabit(await eventsForHabit(habit.id), habit.id).has(DATE)).toBe(true)
  })

  it('ticks nothing for a habit that has been archived', async () => {
    const habit = await createHabit({ name: 'Fitness', frequencyType: 'daily', frequencyValue: 1 })
    await archiveHabit(habit.id)
    // A pointer left from before archiving cleared it.
    await finishSession(DATE, 'push', DEVICE, habit.id)
    expect(await eventsForHabit(habit.id)).toHaveLength(0)
    expect(await db.sessionMarks.count()).toBe(1)
  })

  it('un-finishes every routine it is given, and leaves the habit ticked', async () => {
    const habit = await trainingHabit()
    await finishSession(DATE, ['push', 'pull'], DEVICE, habit.id)
    await unfinishSession(DATE, ['push', 'pull'], DEVICE)

    const marks = await db.sessionMarks.toArray()
    expect(marks.filter((m) => m.action === 'uncomplete')).toHaveLength(2)
    expect(completedDatesForHabit(await eventsForHabit(habit.id), habit.id).has(DATE)).toBe(true)
  })
})

describe('marking a rest day', () => {
  it('records rest, and ticks nothing', async () => {
    const habit = await trainingHabit()
    const mark = await markRested(DATE, 'rest-day', DEVICE)
    expect(mark).toMatchObject({ splitDayId: 'rest-day', action: 'complete', kind: 'rest' })
    expect(await eventsForHabit(habit.id)).toHaveLength(0)
  })
})

describe('archiving the training habit', () => {
  it('lets go of it, so nothing goes on ticking a habit no screen shows', async () => {
    const habit = await trainingHabit()
    await archiveHabit(habit.id)
    expect((await getSettings(DEVICE))?.trainingHabitId).toBeUndefined()
  })

  it('leaves the pointer alone when a different habit is archived', async () => {
    const habit = await trainingHabit()
    const other = await createHabit({ name: 'Reading', frequencyType: 'daily', frequencyValue: 1 })
    await archiveHabit(other.id)
    expect((await getSettings(DEVICE))?.trainingHabitId).toBe(habit.id)
  })
})

describe('backups and the new marks', () => {
  it('carry what a mark recorded', async () => {
    await markRested(DATE, 'rest-day', DEVICE)
    const parsed = parseBackup(JSON.stringify(await buildBackup()))
    expect(parsed.sessionMarks[0].kind).toBe('rest')
  })

  it('refuse a mark that claims to be something else', async () => {
    await markRested(DATE, 'rest-day', DEVICE)
    const payload = await buildBackup()
    const broken = {
      ...payload,
      sessionMarks: payload.sessionMarks.map((m) => ({ ...m, kind: 'nap' })),
    }
    expect(() => parseBackup(JSON.stringify(broken))).toThrow(InvalidBackupError)
  })

  it('do not point training at a habit the file holds only as archived', async () => {
    const habit = await trainingHabit()
    await archiveHabit(habit.id)
    // A file written before archiving let go of the pointer.
    const payload = await buildBackup()
    const stale = { ...payload, preferences: { ...payload.preferences!, trainingHabitId: habit.id } }

    await importBackup(parseBackup(JSON.stringify(stale)))
    expect((await getSettings(DEVICE))?.trainingHabitId).toBeUndefined()
  })
})
