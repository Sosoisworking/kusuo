import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { seedExercises } from './db/exercises'
import { eventsForHabit } from './db/events'
import { createHabit } from './db/habits'
import { db, type Split, type SplitDay } from './db/schema'
import { finishSession, logSet, markRested } from './db/sessions'
import { createSettings, updateSettings } from './db/settings'
import { instantiateTemplate } from './db/splits'
import { addDays, todayLocalDate } from './lib/date'
import { decodeWorkout, findWorkoutCode } from './lib/share'
import { plannedSetCount } from './logic/nextSession'
import { isSessionComplete } from './logic/sessions'
import { resetDatabase } from './test/setup'

/*
  Today's session is the days actually being done, which can be more than one:
  the scheduled day and a missed one, done on the same date. Today, Train, the
  session screen and Share all ask the same question of the same two logs.

  The suite runs on Monday 5 January 2026, so Push / Pull / Legs schedules Push.
*/

const DEVICE_ID = 'test-device'

beforeEach(async () => {
  localStorage.clear()
  localStorage.setItem('kusuo-device-id', DEVICE_ID)
  await resetDatabase()
})

async function withPpl(): Promise<{ split: Split; push: SplitDay; pull: SplitDay; legs: SplitDay }> {
  await createSettings({ deviceId: DEVICE_ID, deviceRole: 'writer', userName: 'Sohaib' })
  await db.settings.update(DEVICE_ID, { onboardingComplete: true })
  await seedExercises()
  const split = await instantiateTemplate('split-ppl-3')
  const [push, pull, legs] = split.days
  return { split, push, pull, legs }
}

async function logOne(day: SplitDay, localDate = todayLocalDate()) {
  await logSet(
    { localDate, splitDayId: day.id, exerciseId: day.entries[0].exerciseId, setIndex: 0 },
    { weightKg: 60, reps: 10 },
    DEVICE_ID,
  )
}

/** A finished mark as builds before S1b wrote them: no word on whether it was rest. */
async function oldStyleMark(localDate: string, splitDayId: string) {
  await db.sessionMarks.add({
    id: crypto.randomUUID(),
    localDate,
    splitDayId,
    action: 'complete',
    timestamp: Date.now(),
    deviceId: DEVICE_ID,
  })
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('Today follows the session actually under way', () => {
  it('names the day being done, not the one the schedule names', async () => {
    const { split, push, pull } = await withPpl()
    await logOne(pull)

    renderAt('/')

    expect(await screen.findByRole('heading', { name: `${split.name} · ${pull.label}` })).toBeInTheDocument()
    expect(screen.getByText('In progress')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: `${split.name} · ${push.label}` })).toBeNull()
  })

  it('names every day in it when a missed one is done alongside', async () => {
    const { split, push, pull } = await withPpl()
    await logOne(pull)
    await logOne(push)

    renderAt('/')

    expect(
      await screen.findByRole('heading', { name: `${split.name} · ${push.label} + ${pull.label}` }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(`2 of ${plannedSetCount(push) + plannedSetCount(pull)} sets logged`),
    ).toBeInTheDocument()
  })

  it('is done only once every day in it is', async () => {
    const { push, pull } = await withPpl()
    await logOne(pull)
    await logOne(push)
    await finishSession(todayLocalDate(), pull.id, DEVICE_ID)

    const first = renderAt('/')
    expect(await screen.findByText('In progress')).toBeInTheDocument()
    first.unmount()

    await finishSession(todayLocalDate(), push.id, DEVICE_ID)
    renderAt('/')
    expect(await screen.findByText('Done today')).toBeInTheDocument()
  })

  it('shows a rest day taken instead of the scheduled session', async () => {
    await createSettings({ deviceId: DEVICE_ID, deviceRole: 'writer' })
    await db.settings.update(DEVICE_ID, { onboardingComplete: true })
    const split = await instantiateTemplate('split-batman-7')
    const rest = split.days.find((d) => d.kind === 'rest')!
    await markRested(todayLocalDate(), rest.id, DEVICE_ID)

    renderAt('/')

    expect(await screen.findByText('A day in the split, not a gap in it.')).toBeInTheDocument()
  })

  it('does not promise a tick from a habit that has been archived', async () => {
    await withPpl()
    const habit = await createHabit({ name: 'Fitness', frequencyType: 'daily', frequencyValue: 1 })
    // Left over from before archiving let go of the pointer.
    await db.habits.update(habit.id, { isActive: false })
    await updateSettings(DEVICE_ID, { trainingHabitId: habit.id })

    renderAt('/')

    expect(await screen.findByText('Next up')).toBeInTheDocument()
    expect(screen.queryByText(/logging it ticks the habit/)).toBeNull()
  })
})

describe('Train holds the whole session', () => {
  it('shows the day still to do, with the rest of the session beside it', async () => {
    const { push, pull } = await withPpl()
    await logOne(pull)
    await logOne(push)
    await finishSession(todayLocalDate(), pull.id, DEVICE_ID)
    // Finishing from the screen finishes both; this mark stands in for an older
    // build that finished one at a time.

    renderAt('/train')

    expect(await screen.findByRole('heading', { name: push.label, level: 2 })).toBeInTheDocument()
    const also = screen.getByRole('list', { name: 'Also today' })
    expect(within(also).getByText(`Also today · ${pull.label}`)).toBeInTheDocument()
    expect(within(also).getByText('done')).toBeInTheDocument()
    // Push is scheduled and in the session, so nothing was swapped.
    expect(screen.queryByText(/Doing this instead of/)).toBeNull()
  })

  it('lists a session of several days once, named for all of them', async () => {
    const { push, pull } = await withPpl()
    const yesterday = addDays(todayLocalDate(), -1)
    await logOne(push, yesterday)
    await logOne(pull, yesterday)
    await finishSession(yesterday, [push.id, pull.id], DEVICE_ID)

    renderAt('/train')

    const recent = (await screen.findByText('Recent sessions')).closest('section') as HTMLElement
    expect(within(recent).getAllByRole('listitem')).toHaveLength(1)
    expect(within(recent).getByText(`${push.label} + ${pull.label}`)).toBeInTheDocument()
  })

  it('does not list a rest day as a session', async () => {
    await createSettings({ deviceId: DEVICE_ID, deviceRole: 'writer' })
    await db.settings.update(DEVICE_ID, { onboardingComplete: true })
    const split = await instantiateTemplate('split-batman-7')
    const rest = split.days.find((d) => d.kind === 'rest')!
    await markRested(addDays(todayLocalDate(), -1), rest.id, DEVICE_ID)
    // And one from before marks said what they recorded: its routine decides.
    await oldStyleMark(addDays(todayLocalDate(), -8), rest.id)

    renderAt('/train')

    // The title shows while Train is still loading; the session card is loaded.
    await screen.findByText(/^Today · Day/)
    expect(screen.queryByText('Recent sessions')).toBeNull()
  })
})

describe('finishing from the session screen', () => {
  it('finishes every day in today’s session, and ticks the habit once', async () => {
    const { push, pull, legs } = await withPpl()
    const habit = await createHabit({ name: 'Fitness', frequencyType: 'daily', frequencyValue: 1 })
    await updateSettings(DEVICE_ID, { trainingHabitId: habit.id })
    await logOne(push)
    await logOne(pull)

    renderAt(`/train/session/${pull.id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Finish and log the session' }))
    await screen.findByRole('heading', { name: 'Train', level: 1 })

    const marks = await db.sessionMarks.toArray()
    const today = todayLocalDate()
    expect(isSessionComplete(marks, today, push.id)).toBe(true)
    expect(isSessionComplete(marks, today, pull.id)).toBe(true)
    // Legs had nothing done, so it is not part of the session.
    expect(isSessionComplete(marks, today, legs.id)).toBe(false)
    expect(await eventsForHabit(habit.id)).toHaveLength(1)
  })

  it('undoes every day it finished', async () => {
    const { push, pull } = await withPpl()
    await logOne(push)
    await logOne(pull)
    await finishSession(todayLocalDate(), [push.id, pull.id], DEVICE_ID)

    renderAt(`/train/session/${pull.id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Reopen this session' }))

    await waitFor(async () => {
      const marks = await db.sessionMarks.toArray()
      expect(isSessionComplete(marks, todayLocalDate(), push.id)).toBe(false)
      expect(isSessionComplete(marks, todayLocalDate(), pull.id)).toBe(false)
    })
  })
})

describe('Share', () => {
  it('names a session of several days for all of them, and its code carries them all', async () => {
    const { push, pull } = await withPpl()
    await logOne(push)
    await logOne(pull)

    renderAt('/settings/share')

    const message = (await screen.findByRole('textbox', { name: 'Message' })) as HTMLTextAreaElement
    expect(message.value.split('\n')[0]).toMatch(new RegExp(`^${push.label} \\+ ${pull.label} · `))
    const shared = decodeWorkout(findWorkoutCode(message.value) ?? '')
    expect(shared?.label).toBe(`${push.label} + ${pull.label}`)
    expect(shared?.entries).toHaveLength(push.entries.length + pull.entries.length)
  })

  it('does not offer a rest day as a session', async () => {
    await createSettings({ deviceId: DEVICE_ID, deviceRole: 'writer' })
    await db.settings.update(DEVICE_ID, { onboardingComplete: true })
    const split = await instantiateTemplate('split-batman-7')
    const rest = split.days.find((d) => d.kind === 'rest')!
    await markRested(todayLocalDate(), rest.id, DEVICE_ID)

    renderAt('/settings/share')

    expect(await screen.findByText(/Nothing logged yet/)).toBeInTheDocument()
  })
})

describe('Calendar', () => {
  it('marks a day trained for a finished session, and not for a rest day', async () => {
    await createSettings({ deviceId: DEVICE_ID, deviceRole: 'writer' })
    await db.settings.update(DEVICE_ID, { onboardingComplete: true })
    await seedExercises()
    const split = await instantiateTemplate('split-batman-7')
    const rest = split.days.find((d) => d.kind === 'rest')!
    const training = split.days.find((d) => d.kind === 'training')!
    const today = todayLocalDate()
    await finishSession(addDays(today, -1), training.id, DEVICE_ID)
    await markRested(addDays(today, -2), rest.id, DEVICE_ID)
    await oldStyleMark(addDays(today, -3), rest.id)

    renderAt('/calendar')

    await screen.findByRole('heading', { name: 'Calendar', level: 1 })
    const day = (date: string) => screen.getByRole('button', { name: new RegExp(`^${date}:`) })
    await waitFor(() => expect(day(addDays(today, -1)).getAttribute('aria-label')).toMatch(/, trained$/))
    expect(day(addDays(today, -2)).getAttribute('aria-label')).not.toMatch(/trained/)
    expect(day(addDays(today, -3)).getAttribute('aria-label')).not.toMatch(/trained/)
  })
})
