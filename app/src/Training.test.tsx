import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { seedExercises } from './db/exercises'
import { eventsForHabit } from './db/events'
import { createHabit } from './db/habits'
import { db, type Split } from './db/schema'
import { allSessionEvents, finishSession, logSet } from './db/sessions'
import { createSettings, updateSettings } from './db/settings'
import { instantiateTemplate } from './db/splits'
import { todayLocalDate } from './lib/date'
import { exerciseRecords } from './logic/records'
import { liveSets } from './logic/sessions'

const DEVICE_ID = 'test-device'
const BENCH = 'ex-barbell-bench-press'

beforeEach(async () => {
  localStorage.clear()
  localStorage.setItem('kusuo-device-id', DEVICE_ID)
  await Promise.all([
    db.habits.clear(),
    db.habitEvents.clear(),
    db.settings.clear(),
    db.goals.clear(),
    db.reflections.clear(),
    db.exercises.clear(),
    db.splits.clear(),
    db.sessionEvents.clear(),
    db.sessionMarks.clear(),
  ])
})

async function onboard(role: 'writer' | 'reader' = 'writer') {
  await createSettings({ deviceId: DEVICE_ID, deviceRole: role, userName: 'Soso' })
  await db.settings.update(DEVICE_ID, { onboardingComplete: true })
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

/** A writer with the seeded directory and a Push / Pull / Legs split in place. */
async function withPpl() {
  await onboard()
  await seedExercises()
  return instantiateTemplate('split-ppl-3')
}

async function typeSet(weight: string, reps: string, setNumber = 1) {
  const weightField = await screen.findByLabelText(`Weight for set ${setNumber} in kg`)
  await userEvent.clear(weightField)
  await userEvent.type(weightField, weight)
  const repsField = screen.getByLabelText(`Reps for set ${setNumber}`)
  await userEvent.clear(repsField)
  await userEvent.type(repsField, reps)
}

describe('Train', () => {
  it('opens on the session rather than a tray', async () => {
    await withPpl()
    renderAt('/train')

    expect(await screen.findByRole('heading', { name: 'Push', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('Today · Day 1')).toBeInTheDocument()
    expect(screen.getByText('5 exercises · 16 sets')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Start session/ })).toBeInTheDocument()
  })

  it('lists the day and links each movement to its detail', async () => {
    const split = await withPpl()
    renderAt('/train')

    const row = await screen.findByRole('link', { name: /Barbell bench press/ })
    expect(row).toHaveAttribute('href', `/exercises/${BENCH}`)
    expect(row).toHaveTextContent('4 × 6')
    expect(split.days[0].entries).toHaveLength(5)
  })

  it('says what was lifted last time under a movement', async () => {
    const split = await withPpl()
    await logSet(
      { localDate: '2026-01-05', splitDayId: split.days[0].id, exerciseId: BENCH, setIndex: 0 },
      { weightKg: 82.5, reps: 6 },
      DEVICE_ID,
    )
    renderAt('/train')

    expect(await screen.findByRole('link', { name: /Barbell bench press/ })).toHaveTextContent(
      '4 × 6 · last 82.5 kg',
    )
  })

  it('lists finished sessions after the day', async () => {
    const split = await withPpl()
    const today = todayLocalDate()
    await logSet(
      { localDate: today, splitDayId: split.days[0].id, exerciseId: BENCH, setIndex: 0 },
      { weightKg: 80, reps: 6 },
      DEVICE_ID,
    )
    await finishSession(today, split.days[0].id, DEVICE_ID)
    renderAt('/train')

    const heading = await screen.findByRole('heading', { name: 'Recent sessions' })
    const list = heading.parentElement?.parentElement
    expect(within(list as HTMLElement).getByText('today')).toBeInTheDocument()
    expect(within(list as HTMLElement).getByText('1 sets · 480 kg')).toBeInTheDocument()
  })

  it('says what to do when no split is chosen', async () => {
    await onboard()
    renderAt('/train')

    expect(await screen.findByRole('link', { name: 'Pick one in Splits' })).toHaveAttribute(
      'href',
      '/splits',
    )
    expect(screen.queryByRole('button', { name: /Start session/ })).toBeNull()
  })

  it('offers a rest day as a day, not a gap, and does not tick the habit for it', async () => {
    await onboard()
    await seedExercises()
    const habit = await createHabit({ name: 'Training', frequencyType: 'daily', frequencyValue: 1 })
    await updateSettings(DEVICE_ID, { trainingHabitId: habit.id })
    const split = await instantiateTemplate('split-batman-7')
    // The Batman split's third day is a rest day; walk the cycle up to it.
    await finishSession('2026-01-01', split.days[0].id, DEVICE_ID)
    await finishSession('2026-01-02', split.days[1].id, DEVICE_ID)
    renderAt('/train')

    expect(await screen.findByText('A day in the split, not a gap in it.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Start session/ })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Mark the rest day done' }))

    // Marking it advances the cycle to the next day, and it is the split's own
    // day — the training habit is not ticked for a day spent resting.
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Legs / Core', level: 2 })).toBeInTheDocument(),
    )
    expect(await eventsForHabit(habit.id)).toHaveLength(0)
    expect(await db.sessionMarks.count()).toBe(3)
  })
})

describe('the session flow', () => {
  it('logs a set and keeps it across a reload', async () => {
    const split = await withPpl()
    const path = `/train/session/${split.days[0].id}`
    const view = renderAt(path)

    expect(await screen.findByRole('heading', { name: 'Barbell bench press', level: 1 }))
      .toBeInTheDocument()
    await typeSet('80', '6')
    await userEvent.click(screen.getByRole('button', { name: 'Log set 1' }))

    await waitFor(async () => expect(await db.sessionEvents.count()).toBe(1))
    view.unmount()

    renderAt(path)
    expect(await screen.findByRole('button', { name: 'Correct set 1' })).toBeInTheDocument()
    const sets = liveSets(await allSessionEvents())
    expect(sets).toHaveLength(1)
    expect(sets[0]).toMatchObject({ weightKg: 80, reps: 6, setIndex: 0 })
  })

  it('advances to the next set once a set is logged', async () => {
    const split = await withPpl()
    renderAt(`/train/session/${split.days[0].id}`)

    await typeSet('80', '6')
    await userEvent.click(await screen.findByRole('button', { name: 'Log set 1' }))

    expect(await screen.findByRole('button', { name: 'Log set 2' })).toBeInTheDocument()
    expect(screen.getByLabelText('Weight for set 2 in kg')).toHaveValue('80')
  })

  it('corrects a set instead of duplicating it', async () => {
    const split = await withPpl()
    renderAt(`/train/session/${split.days[0].id}`)

    await typeSet('80', '6')
    await userEvent.click(await screen.findByRole('button', { name: 'Log set 1' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Correct set 1' }))
    await typeSet('82.5', '6')
    await userEvent.click(screen.getByRole('button', { name: 'Save set 1' }))

    await waitFor(async () => expect(await db.sessionEvents.count()).toBe(2))
    const sets = liveSets(await allSessionEvents())
    expect(sets).toHaveLength(1)
    expect(sets[0].weightKg).toBe(82.5)
  })

  it('voids a set out of the records but not out of the log', async () => {
    const split = await withPpl()
    renderAt(`/train/session/${split.days[0].id}`)

    await typeSet('80', '6')
    await userEvent.click(await screen.findByRole('button', { name: 'Log set 1' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Correct set 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(async () => expect(await db.sessionEvents.count()).toBe(2))
    const events = await allSessionEvents()
    expect(events.map((e) => e.action).sort()).toEqual(['log', 'void'])
    expect(liveSets(events)).toHaveLength(0)
    expect(exerciseRecords(events, BENCH).totalSets).toBe(0)
  })

  it('ticks the training habit when the session is finished', async () => {
    const split = await withPpl()
    const habit = await createHabit({ name: 'Training', frequencyType: 'daily', frequencyValue: 1 })
    await updateSettings(DEVICE_ID, { trainingHabitId: habit.id })
    renderAt(`/train/session/${split.days[0].id}`)

    await typeSet('80', '6')
    await userEvent.click(await screen.findByRole('button', { name: 'Log set 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Finish and log the session' }))

    expect(await screen.findByRole('heading', { name: 'Train', level: 1 })).toBeInTheDocument()
    const ticks = await eventsForHabit(habit.id)
    expect(ticks).toHaveLength(1)
    expect(ticks[0]).toMatchObject({ action: 'complete', localDate: todayLocalDate() })
    expect(await db.sessionMarks.count()).toBe(1)
  })

  it('logs cardio by time rather than by load', async () => {
    await onboard()
    await seedExercises()
    const now = Date.now()
    const split: Split = {
      id: crypto.randomUUID(),
      name: 'Conditioning',
      days: [
        {
          id: 'cardio-day',
          label: 'Cardio',
          kind: 'training',
          entries: [{ exerciseId: 'ex-treadmill', sets: 1, repsMin: 0, repsMax: 0 }],
        },
      ],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }
    await db.splits.add(split)
    renderAt('/train/session/cardio-day')

    const minutes = await screen.findByLabelText('Minutes for set 1')
    expect(screen.queryByLabelText('Weight for set 1 in kg')).toBeNull()
    await userEvent.type(minutes, '20')
    await userEvent.click(screen.getByRole('button', { name: 'Log set 1' }))

    await waitFor(async () => expect(await db.sessionEvents.count()).toBe(1))
    const [event] = await allSessionEvents()
    expect(event).toMatchObject({ durationSec: 1200, weightKg: 0 })
  })

  it('has no rest timer anywhere on the screen', async () => {
    const split = await withPpl()
    renderAt(`/train/session/${split.days[0].id}`)

    await screen.findByRole('heading', { name: 'Barbell bench press', level: 1 })
    expect(screen.getByText(/No timer — rest as long as you like/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /timer|rest timer|start rest/i })).toBeNull()
  })

  it('sends a day with nothing to log back to Train', async () => {
    await withPpl()
    renderAt('/train/session/not-a-real-day')

    expect(await screen.findByRole('heading', { name: 'No session here', level: 1 }))
      .toBeInTheDocument()
  })
})

describe('Exercise detail', () => {
  it('states the records and the history plainly', async () => {
    const split = await withPpl()
    const day = split.days[0].id
    await logSet(
      { localDate: '2026-01-05', splitDayId: day, exerciseId: BENCH, setIndex: 0 },
      { weightKg: 80, reps: 6 },
      DEVICE_ID,
    )
    await logSet(
      { localDate: '2026-01-12', splitDayId: day, exerciseId: BENCH, setIndex: 0 },
      { weightKg: 92.5, reps: 6 },
      DEVICE_ID,
    )
    renderAt(`/exercises/${BENCH}`)

    expect(await screen.findByRole('heading', { name: 'Barbell bench press', level: 1 }))
      .toBeInTheDocument()
    expect(screen.getByText('Heaviest set')).toBeInTheDocument()
    expect(screen.getByText('92.5')).toBeInTheDocument()
    expect(screen.getByText('12 Jan')).toBeInTheDocument()
    expect(screen.getByText('92.5 kg × 6')).toBeInTheDocument()
  })

  it('says nothing is logged rather than showing empty records', async () => {
    await withPpl()
    renderAt(`/exercises/${BENCH}`)

    expect(
      await screen.findByText(/Nothing logged for this movement yet/),
    ).toBeInTheDocument()
    expect(screen.queryByText('Heaviest set')).toBeNull()
  })

  it('says so when the movement is gone', async () => {
    await withPpl()
    renderAt('/exercises/ex-not-here')

    expect(await screen.findByRole('heading', { name: 'Movement not found', level: 1 }))
      .toBeInTheDocument()
  })
})

describe('the Mac read-only build', () => {
  it('offers no way to start or change a session on Train', async () => {
    await seedExercises()
    await instantiateTemplate('split-ppl-3')
    await onboard('reader')
    renderAt('/train')

    expect(await screen.findByRole('heading', { name: 'Push', level: 2 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Start session/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Switch split' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mark the rest day done' })).toBeNull()
  })

  it('turns a session URL back into Train', async () => {
    await seedExercises()
    const split = await instantiateTemplate('split-ppl-3')
    await onboard('reader')
    renderAt(`/train/session/${split.days[0].id}`)

    expect(await screen.findByRole('heading', { name: 'Train', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log set 1' })).toBeNull()
  })

  it('reads exercise detail without offering a write', async () => {
    await seedExercises()
    const split = await instantiateTemplate('split-ppl-3')
    await logSet(
      { localDate: '2026-01-05', splitDayId: split.days[0].id, exerciseId: BENCH, setIndex: 0 },
      { weightKg: 80, reps: 6 },
      DEVICE_ID,
    )
    await onboard('reader')
    renderAt(`/exercises/${BENCH}`)

    expect(await screen.findByRole('heading', { name: 'Barbell bench press', level: 1 }))
      .toBeInTheDocument()
    expect(screen.getByText('Heaviest set')).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /Log|Save|Remove|Finish/ })).toHaveLength(0)
  })

  it('writes nothing to the database from any training screen', async () => {
    await seedExercises()
    const split = await instantiateTemplate('split-ppl-3')
    await onboard('reader')
    const eventsBefore = await db.sessionEvents.count()
    const marksBefore = await db.sessionMarks.count()

    for (const path of ['/train', `/train/session/${split.days[0].id}`, `/exercises/${BENCH}`]) {
      const view = renderAt(path)
      await screen.findByText('Viewing only — log on your iPhone.')
      view.unmount()
    }

    expect(await db.sessionEvents.count()).toBe(eventsBefore)
    expect(await db.sessionMarks.count()).toBe(marksBefore)
    expect(await db.habitEvents.count()).toBe(0)
  })
})
