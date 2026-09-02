import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { seedExercises } from './db/exercises'
import { appendHabitEvent } from './db/events'
import { createHabit } from './db/habits'
import { resetDatabase } from './test/setup'
import { db, type Habit } from './db/schema'
import { createSettings } from './db/settings'
import { archiveGoal, completeGoal, createGoal } from './db/goals'
import { appendReflection } from './db/reflections'
import { finishSession, logSet } from './db/sessions'
import { instantiateTemplate } from './db/splits'
import { addDays, todayLocalDate } from './lib/date'
import { dayForDate, plannedSetCount } from './logic/nextSession'

const DEVICE_ID = 'test-device'

beforeEach(async () => {
  localStorage.clear()
  localStorage.setItem('kusuo-device-id', DEVICE_ID)
  await resetDatabase()
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

describe('the six-tab shell', () => {
  it('offers every tab from Today', async () => {
    await onboard()
    renderAt('/')

    const nav = await screen.findByRole('navigation', { name: 'Primary' })
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent)
    expect(labels).toEqual(['Today', 'Train', 'Splits', 'Calendar', 'Records', 'Settings'])
  })

  it('navigates from Today to Train by tapping the tab', async () => {
    await onboard()
    renderAt('/')
    await screen.findByRole('navigation', { name: 'Primary' })

    const nav = screen.getByRole('navigation', { name: 'Primary' })
    await userEvent.click(within(nav).getByRole('link', { name: 'Train' }))

    expect(await screen.findByRole('heading', { name: 'Train', level: 1 })).toBeInTheDocument()
  })

  it('renders each tab route without crashing', async () => {
    await onboard()
    for (const [path, title] of [
      ['/train', 'Train'],
      ['/splits', 'Splits'],
      ['/calendar', 'Calendar'],
      ['/records', 'Records'],
    ] as const) {
      const view = renderAt(path)
      expect(await screen.findByRole('heading', { name: title, level: 1 })).toBeInTheDocument()
      view.unmount()
    }
  })

  it('sends a device that has not onboarded to onboarding', async () => {
    renderAt('/')
    // Onboarding opens on the welcome screen now, not the device question.
    expect(await screen.findByText(/Habits, and the training that goes with them/i)).toBeInTheDocument()
  })
})

describe('Today', () => {
  it('shows the greeting, the date and the count', async () => {
    await onboard()
    await createHabit({ name: 'Reading', frequencyType: 'daily', frequencyValue: 1 })
    await createHabit({ name: 'Japanese', frequencyType: 'daily', frequencyValue: 1 })
    renderAt('/')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/Soso$/)
    expect(await screen.findByText('0 of 2 done today · 2 left')).toBeInTheDocument()
  })

  it('completes a habit and keeps the new count', async () => {
    await onboard()
    await createHabit({ name: 'Reading', frequencyType: 'daily', frequencyValue: 1 })
    renderAt('/')

    // Exact name, because the row's sibling name button is "Open Reading".
    const tick = await screen.findByRole('button', { name: 'Reading' })
    expect(tick).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(tick)

    await waitFor(() => expect(screen.getByText('1 of 1 done today')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Reading' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('folds Reflect and Goals into cards instead of tabs', async () => {
    await onboard()
    renderAt('/')

    // The tab bar renders before Today resolves, so wait for the card itself.
    const reflect = await screen.findByRole('link', { name: /Reflect/ })
    expect(reflect).toHaveAttribute('href', '/reflection')
    expect(screen.getByRole('link', { name: /Goals/ })).toHaveAttribute('href', '/goals')

    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(within(nav).queryByRole('link', { name: 'Reflect' })).toBeNull()
    expect(within(nav).queryByRole('link', { name: 'Goals' })).toBeNull()
  })

  it('names the next session once a split is active', async () => {
    await onboard()
    await seedExercises()
    await instantiateTemplate('split-ppl-3')
    renderAt('/')

    expect(await screen.findByText(/Push \/ Pull \/ Legs · Push/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open the session' })).toHaveAttribute('href', '/train')
  })

  it('shows no next-session card when no split is chosen', async () => {
    await onboard()
    renderAt('/')

    // Wait for Today to actually resolve — asserting an absence against the
    // loading skeleton would pass for the wrong reason.
    await screen.findByRole('link', { name: /Reflect/ })
    expect(screen.queryByText('Next up')).toBeNull()
  })

  it('opens the habit when its name is tapped, and ticks nothing', async () => {
    await onboard()
    await createHabit({ name: 'Reading', frequencyType: 'daily', frequencyValue: 1 })
    renderAt('/')

    await userEvent.click(await screen.findByRole('button', { name: 'Open Reading' }))

    expect(await screen.findByRole('heading', { name: 'Reading', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Daily')).toBeInTheDocument()
    // The reason this row was split in two: reading a habit must not log one.
    expect(await db.habitEvents.count()).toBe(0)
  })

  it('lists habits oldest first, with names breaking a tie', async () => {
    await onboard()
    // The exact shape of the fresh install that read Japanese, Fitness,
    // Reading: onboarding wrote the batch inside one millisecond, so createdAt
    // tied and Dexie handed them back in primary-key order. The keys are
    // written out here so key order and the order Today owes are provably
    // different — nothing about this can pass by luck.
    function seeded(id: string, name: string, createdAt: number): Habit {
      return { id, name, frequencyType: 'daily', frequencyValue: 1, isActive: true, createdAt, updatedAt: createdAt }
    }
    await db.habits.bulkAdd([
      seeded('habit-1', 'Japanese', 100),
      seeded('habit-2', 'Fitness', 100),
      seeded('habit-3', 'Reading', 200),
    ])
    renderAt('/')

    await screen.findByRole('button', { name: 'Open Fitness' })
    const order = screen
      .getAllByRole('button', { name: /^Open / })
      .map((button) => button.getAttribute('aria-label'))
    expect(order).toEqual(['Open Fitness', 'Open Japanese', 'Open Reading'])
  })

  it('counts this week in the strip', async () => {
    await onboard()
    const habit = await createHabit({ name: 'Reading', frequencyType: 'daily', frequencyValue: 1 })
    await appendHabitEvent(habit.id, todayLocalDate(), 'complete', DEVICE_ID)
    renderAt('/')

    const strip = await screen.findByRole('region', { name: 'This week' })
    expect(within(strip).getByText('1')).toBeInTheDocument()
  })

  it('does not spend the calendar dot on a day with nothing on it', async () => {
    await onboard()
    await createHabit({ name: 'Reading', frequencyType: 'daily', frequencyValue: 1 })
    renderAt('/')

    const strip = await screen.findByRole('region', { name: 'This week' })
    // The calendar spends '·' to mean a habit was done; zero cannot use it too.
    expect(within(strip).queryByText('·')).toBeNull()
    expect(within(strip).getAllByText(/of 1 done$/)).toHaveLength(7)
  })
})

describe('Today and the day that is already under way', () => {
  async function activeSplitDay() {
    await seedExercises()
    const split = await instantiateTemplate('split-ppl-3')
    const day = dayForDate(split, todayLocalDate())
    if (!day) throw new Error('the seeded split has no day for today')
    return day
  }

  it('says a session is under way once sets are logged', async () => {
    await onboard()
    const day = await activeSplitDay()
    const today = todayLocalDate()
    await logSet(
      { localDate: today, splitDayId: day.id, exerciseId: day.entries[0].exerciseId, setIndex: 0 },
      { weightKg: 60, reps: 10 },
      DEVICE_ID,
    )

    renderAt('/')

    // Train said "Continue session · 3 of 32 logged" while Today still said
    // "Next up". Both now replay the same log.
    expect(await screen.findByText('In progress')).toBeInTheDocument()
    expect(screen.getByText(`1 of ${plannedSetCount(day)} sets logged`)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue the session' })).toHaveAttribute(
      'href',
      '/train',
    )
  })

  it('says the session is done once it is finished', async () => {
    await onboard()
    const day = await activeSplitDay()
    const today = todayLocalDate()
    await logSet(
      { localDate: today, splitDayId: day.id, exerciseId: day.entries[0].exerciseId, setIndex: 0 },
      { weightKg: 60, reps: 10 },
      DEVICE_ID,
    )
    await finishSession(today, day.id, DEVICE_ID)

    renderAt('/')

    expect(await screen.findByText('Done today')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review the session' })).toBeInTheDocument()
  })

  it('states a rest day instead of offering a session', async () => {
    await onboard()
    // One rest day repeats across the whole week, so today is a rest day
    // whichever day the suite runs on.
    await db.splits.add({
      id: 'split-rest-only',
      name: 'Deload',
      days: [{ id: 'rest-day', label: 'Rest', kind: 'rest', entries: [] }],
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    })

    renderAt('/')

    expect(await screen.findByText('A day in the split, not a gap in it.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /session/i })).toBeNull()
  })

  it('stops saying a session is up next once the training habit is ticked', async () => {
    await onboard()
    const habit = await createHabit({ name: 'Fitness', frequencyType: 'daily', frequencyValue: 1 })
    await db.settings.update(DEVICE_ID, { trainingHabitId: habit.id })
    const day = await activeSplitDay()

    renderAt('/')

    expect(await screen.findByText(`Up next · ${day.label}`)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Fitness' }))

    await waitFor(() => expect(screen.queryByText(`Up next · ${day.label}`)).toBeNull())
    expect(screen.getByText('1d')).toBeInTheDocument()
  })
})

describe('the screens that had no way in', () => {
  it('sends the retired /progress path home', async () => {
    await onboard()
    renderAt('/progress')

    expect(await screen.findByRole('link', { name: /Reflect/ })).toBeInTheDocument()
  })

  it('sends an unknown path home rather than rendering nothing', async () => {
    await onboard()
    renderAt('/does-not-exist')

    // The SPA fallback now delivers unknown paths to the router, so "nothing
    // matched" has to mean something.
    expect(await screen.findByRole('link', { name: /Reflect/ })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
  })

  it('lets a real route outrank the catch-all', async () => {
    await onboard()
    for (const [path, title] of [
      ['/records', 'Records'],
      ['/splits', 'Splits'],
      ['/exercises', 'Directory'],
    ] as const) {
      const view = renderAt(path)
      expect(await screen.findByRole('heading', { name: title, level: 1 })).toBeInTheDocument()
      view.unmount()
    }
  })

  it('still sends an un-onboarded device to onboarding from an unknown path', async () => {
    renderAt('/does-not-exist')

    expect(
      await screen.findByText(/Habits, and the training that goes with them/i),
    ).toBeInTheDocument()
  })
})

describe('the Mac read-only build', () => {
  it('offers no way to complete a habit', async () => {
    await onboard('reader')
    await createHabit({ name: 'Reading', frequencyType: 'daily', frequencyValue: 1 })
    renderAt('/')

    expect(await screen.findByText('Viewing only — log on your iPhone.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reading/ })).toBeNull()
    expect(screen.queryByRole('button', { name: '+ Add habit' })).toBeNull()
  })

  it('offers no way to change the split', async () => {
    await onboard('reader')
    renderAt('/splits')

    await screen.findByRole('heading', { name: 'Splits', level: 1 })
    expect(screen.queryByRole('button', { name: /^Use / })).toBeNull()
  })

  it('carries the viewing-only line on every tab, once', async () => {
    await onboard('reader')
    for (const path of ['/', '/train', '/splits', '/calendar', '/records']) {
      const view = renderAt(path)
      const notices = await screen.findAllByText('Viewing only — log on your iPhone.')
      expect(notices).toHaveLength(1)
      view.unmount()
    }
  })

  it('writes nothing to the database when a reader opens every screen', async () => {
    await onboard('reader')
    for (const path of ['/', '/train', '/splits', '/calendar', '/records']) {
      const view = renderAt(path)
      // Wait for the screen's own content, not just the shared tab bar.
      await screen.findByText('Viewing only — log on your iPhone.')
      view.unmount()
    }

    expect(await db.habits.count()).toBe(0)
    expect(await db.habitEvents.count()).toBe(0)
    expect(await db.exercises.count()).toBe(0)
    expect(await db.splits.count()).toBe(0)
    expect(await db.sessionEvents.count()).toBe(0)
    expect(await db.sessionMarks.count()).toBe(0)
  })
})

describe('Splits', () => {
  it('activates a template and shows it as the active split', async () => {
    await onboard()
    await seedExercises()
    renderAt('/splits')

    // The canvas makes the whole programme row the control; there is no
    // separate "Use this" button beside it.
    await userEvent.click(await screen.findByRole('button', { name: 'Use Push / Pull / Legs' }))

    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument())
    expect(await db.splits.count()).toBe(1)
  })

  it('re-activates an existing copy rather than duplicating it', async () => {
    await onboard()
    await seedExercises()
    const first = await instantiateTemplate('split-ppl-3')
    await instantiateTemplate('split-upper-lower-4')
    renderAt('/splits')

    await userEvent.click(await screen.findByRole('button', { name: 'Use Push / Pull / Legs' }))

    await waitFor(async () => {
      expect((await db.splits.get(first.id))?.isActive).toBe(true)
    })
    expect(await db.splits.count()).toBe(2)
  })
})

describe('Calendar', () => {
  it('marks a day you trained, not only a day you ticked habits', async () => {
    await onboard()
    const today = todayLocalDate()
    const habit = await createHabit({ name: 'Reading', frequencyType: 'daily', frequencyValue: 1 })
    await appendHabitEvent(habit.id, today, 'complete', DEVICE_ID)
    await finishSession(today, 'day-1', DEVICE_ID)

    renderAt('/calendar')

    const cell = await screen.findByLabelText(new RegExp(`^${today}:`))
    expect(cell.getAttribute('aria-label')).toMatch(/1 of 1 done, trained$/)
  })

  it('says nothing about training on a day with none', async () => {
    await onboard()
    const today = todayLocalDate()
    renderAt('/calendar')

    const cell = await screen.findByLabelText(new RegExp(`^${today}:`))
    expect(cell.getAttribute('aria-label')).not.toMatch(/trained/)
  })

  it('marks a day with sets logged and no finish, without calling it trained', async () => {
    await onboard()
    await seedExercises()
    const split = await instantiateTemplate('split-ppl-3')
    const today = todayLocalDate()
    await logSet(
      {
        localDate: today,
        splitDayId: split.days[0].id,
        exerciseId: 'ex-barbell-bench-press',
        setIndex: 0,
      },
      { weightKg: 80, reps: 6 },
      DEVICE_ID,
    )

    renderAt('/calendar')

    // The grid was blank for this day while the detail below held the sets.
    const cell = await screen.findByLabelText(new RegExp(`^${today}:`))
    expect(cell.getAttribute('aria-label')).toMatch(/sets logged, session not finished$/)
    expect(cell.getAttribute('aria-label')).not.toMatch(/trained/)
  })
})

describe('Goals and reflections have somewhere to live', () => {
  it('reads back the reflection written on the day you pick', async () => {
    await onboard()
    const today = todayLocalDate()
    await appendReflection(today, 'Slept badly, trained anyway.', DEVICE_ID)

    renderAt('/calendar')
    await userEvent.click(await screen.findByLabelText(new RegExp(`^${today}:`)))
    await userEvent.click(await screen.findByRole('tab', { name: 'Reflection' }))

    expect(await screen.findByText('Slept badly, trained anyway.')).toBeInTheDocument()
  })

  it('says plainly when nothing was written that day', async () => {
    await onboard()
    const today = todayLocalDate()

    renderAt('/calendar')
    await userEvent.click(await screen.findByLabelText(new RegExp(`^${today}:`)))
    await userEvent.click(await screen.findByRole('tab', { name: 'Reflection' }))

    expect(await screen.findByText('Nothing written that day.')).toBeInTheDocument()
  })

  it('holds a day\'s training, reflection and goals in three tabs', async () => {
    await onboard()
    const today = todayLocalDate()
    await createGoal({ title: 'Read 24 books', description: 'Two a month', targetDate: '2026-12-31' })

    renderAt('/calendar')
    // The tabs belong to a day, so they appear once one is chosen.
    expect(screen.queryByRole('tab', { name: 'Goals' })).toBeNull()
    await userEvent.click(await screen.findByLabelText(new RegExp(`^${today}:`)))

    // Training leads, and each answer is whole rather than stacked behind another.
    expect(await screen.findByRole('tab', { name: 'Training' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(await screen.findByText('No sets logged that day.')).toBeInTheDocument()
    expect(screen.queryByText('Read 24 books')).toBeNull()

    await userEvent.click(screen.getByRole('tab', { name: 'Goals' }))
    expect(await screen.findByText('Read 24 books')).toBeInTheDocument()
    expect(screen.getByText('Two a month')).toBeInTheDocument()
    expect(screen.queryByText('No sets logged that day.')).toBeNull()
  })

  it('moves a reached goal into Records, and leaves an abandoned one out', async () => {
    await onboard()
    const reached = await createGoal({ title: 'Bench bodyweight' })
    const abandoned = await createGoal({ title: 'Run a marathon' })
    await completeGoal(reached.id)
    await archiveGoal(abandoned.id)

    renderAt('/records')

    expect(await screen.findByText('Bench bodyweight')).toBeInTheDocument()
    expect(screen.queryByText('Run a marathon')).toBeNull()
  })

  it('lists what was written in Records too', async () => {
    await onboard()
    await appendReflection(todayLocalDate(), 'A quiet week.', DEVICE_ID)

    renderAt('/records')
    expect(await screen.findByText('A quiet week.')).toBeInTheDocument()
  })
})

describe('Reflection', () => {
  it('shows today in the history, so a saved entry does not look lost', async () => {
    await onboard()
    renderAt('/reflection')

    await userEvent.click(await screen.findByRole('button', { name: 'Energy: 4 of 5' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'What went well?' }), 'Trained early')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    const past = await screen.findByText(/· today$/)
    expect(past).toBeInTheDocument()
    expect(await screen.findByText(/Went well: Trained early/)).toBeInTheDocument()
  })

  it('does not carry yesterday into today', async () => {
    await onboard()
    await appendReflection(addDays(todayLocalDate(), -1), { text: 'Yesterday.' }, DEVICE_ID)
    renderAt('/reflection')

    const note = await screen.findByRole('textbox', { name: 'Anything else' })
    expect(note).toHaveValue('')
    // Yesterday is still readable, just not loaded into today's form.
    expect(screen.getByText('Yesterday.')).toBeInTheDocument()
  })

  it('continues today rather than starting a second entry', async () => {
    await onboard()
    await appendReflection(todayLocalDate(), { text: 'First pass.' }, DEVICE_ID)
    renderAt('/reflection')

    const note = await screen.findByRole('textbox', { name: 'Anything else' })
    expect(note).toHaveValue('First pass.')
    // Saved and unchanged says so in words. The button comes back — reading
    // "Update today" — the moment an answer differs from what was stored.
    expect(screen.getByText('Saved for today. Change an answer to update it.')).toBeInTheDocument()
    await userEvent.type(note, ' Second thought.')
    expect(await screen.findByRole('button', { name: 'Update today' })).toBeInTheDocument()
  })

  it('refuses to save nothing', async () => {
    await onboard()
    renderAt('/reflection')

    expect(await screen.findByRole('button', { name: 'Save' })).toBeDisabled()
  })
})

describe('the calendar day detail', () => {
  it('leads with the summary and then what you did', async () => {
    await onboard()
    await seedExercises()
    const split = await instantiateTemplate('split-ppl-3')
    const today = todayLocalDate()
    const at = { localDate: today, splitDayId: split.days[0].id, exerciseId: 'ex-barbell-bench-press' }
    await logSet({ ...at, setIndex: 0 }, { weightKg: 80, reps: 6 }, DEVICE_ID)
    await logSet({ ...at, setIndex: 1 }, { weightKg: 80, reps: 5 }, DEVICE_ID)
    await finishSession(today, split.days[0].id, DEVICE_ID)

    renderAt('/calendar')
    await userEvent.click(await screen.findByLabelText(new RegExp(`^${today}:`)))

    // Summary: 80x6 + 80x5 = 880 kg across 2 sets of 1 movement. It appears
    // twice — once as the day total, once as this movement's own volume. The
    // summary stays above the tabs; Training is the tab a day opens on.
    expect(await screen.findAllByText('880kg')).toHaveLength(2)
    expect(screen.getByRole('tab', { name: 'Training' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Barbell bench press')).toBeInTheDocument()
    // Every weight on the screen carries its unit, the set lines included.
    expect(screen.getByText('80kg × 6 · 80kg × 5')).toBeInTheDocument()
  })

  it('shows a circuit as time rather than as a weight', async () => {
    await onboard()
    await seedExercises()
    const split = await instantiateTemplate('split-batman-7')
    const today = todayLocalDate()
    await logSet(
      { localDate: today, splitDayId: split.days[0].id, exerciseId: 'ex-kettlebell-1', setIndex: 0 },
      { weightKg: 0, reps: 0, durationSec: 1200 },
      DEVICE_ID,
    )

    renderAt('/calendar')
    await userEvent.click(await screen.findByLabelText(new RegExp(`^${today}:`)))

    expect(await screen.findByText('Kettlebell 1')).toBeInTheDocument()
    expect(screen.getByText('20 min')).toBeInTheDocument()
  })

  it('says nothing about training on a day with none', async () => {
    await onboard()
    const today = todayLocalDate()
    renderAt('/calendar')
    await userEvent.click(await screen.findByLabelText(new RegExp(`^${today}:`)))

    // The tab is still there — a day with no sets says so rather than hiding
    // the question, which is what made an empty day ambiguous before.
    await screen.findByText('No sets logged that day.')
    expect(screen.queryByText('Barbell bench press')).toBeNull()
  })
})
