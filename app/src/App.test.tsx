import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { seedExercises } from './db/exercises'
import { appendHabitEvent } from './db/events'
import { createHabit } from './db/habits'
import { db } from './db/schema'
import { createSettings } from './db/settings'
import { finishSession } from './db/sessions'
import { instantiateTemplate } from './db/splits'
import { todayLocalDate } from './lib/date'

const DEVICE_ID = 'test-device'

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
    expect(await screen.findByText(/Which device is this/i)).toBeInTheDocument()
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

    // Exact name, because the row's sibling edit button is "Edit Reading".
    const row = await screen.findByRole('button', { name: 'Reading' })
    expect(row).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(row)

    await waitFor(() => expect(screen.getByText('1 of 1 done today')).toBeInTheDocument())
    // Completing it adds the "1d" subtitle, so the name grows.
    expect(screen.getByRole('button', { name: /^Reading/ })).toHaveAttribute('aria-pressed', 'true')
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

  it('counts this week in the strip', async () => {
    await onboard()
    const habit = await createHabit({ name: 'Reading', frequencyType: 'daily', frequencyValue: 1 })
    await appendHabitEvent(habit.id, todayLocalDate(), 'complete', DEVICE_ID)
    renderAt('/')

    const strip = await screen.findByRole('region', { name: 'This week' })
    expect(within(strip).getByText('1')).toBeInTheDocument()
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
})
