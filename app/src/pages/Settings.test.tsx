import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { seedExercises } from '../db/exercises'
import { createHabit } from '../db/habits'
import { db } from '../db/schema'
import { createSettings } from '../db/settings'
import { logSet } from '../db/sessions'
import { instantiateTemplate } from '../db/splits'

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

describe('Settings', () => {
  it('switches weight units and keeps them', async () => {
    await onboard()
    renderAt('/settings')

    await userEvent.click(await screen.findByRole('button', { name: 'Pounds' }))

    await waitFor(async () => expect((await db.settings.get(DEVICE_ID))?.units).toBe('lb'))
    expect(screen.getByRole('button', { name: 'Pounds' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Kilograms' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('switches the week start', async () => {
    await onboard()
    renderAt('/settings')

    await userEvent.click(await screen.findByRole('button', { name: 'Sunday' }))
    await waitFor(async () => expect((await db.settings.get(DEVICE_ID))?.weekStart).toBe('sunday'))
  })

  it('changes the sets a new exercise starts with', async () => {
    await onboard()
    renderAt('/settings')

    const group = (await screen.findByText('Sets per new exercise')).closest('fieldset')
    await userEvent.click(within(group as HTMLElement).getByRole('button', { name: '5' }))
    await waitFor(async () => expect((await db.settings.get(DEVICE_ID))?.defaultSets).toBe(5))
  })

  it('uses that default when a movement is added from the directory', async () => {
    await onboard()
    await seedExercises()
    const split = await instantiateTemplate('split-ppl-3')
    await db.settings.update(DEVICE_ID, { defaultSets: 5 })

    renderAt(`/exercises?splitId=${split.id}&dayId=${split.days[0].id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Add Machine pec deck' }))

    await waitFor(async () => {
      const entries = (await db.splits.get(split.id))?.days[0].entries ?? []
      expect(entries.at(-1)?.sets).toBe(5)
    })
  })

  it('points the training habit at a habit of your choosing', async () => {
    await onboard()
    const habit = await createHabit({ name: 'Fitness', frequencyType: 'weekly', frequencyValue: 3 })
    renderAt('/settings')

    await userEvent.click(await screen.findByRole('button', { name: /Fitness/ }))
    await waitFor(async () =>
      expect((await db.settings.get(DEVICE_ID))?.trainingHabitId).toBe(habit.id),
    )
  })

  it('keeps the destructive things on their own screen', async () => {
    await onboard()
    renderAt('/settings')

    await screen.findByRole('heading', { name: 'Settings', level: 1 })
    expect(screen.queryByRole('button', { name: /Reset all data/ })).toBeNull()
    expect(screen.getByRole('link', { name: /Your data/ })).toHaveAttribute(
      'href',
      '/settings/data',
    )
  })

  it('offers a reader no preference it cannot act on', async () => {
    await onboard('reader')
    renderAt('/settings')

    await screen.findByRole('heading', { name: 'Settings', level: 1 })
    expect(screen.queryByText('Sets per new exercise')).toBeNull()
    expect(screen.queryByText('Training habit')).toBeNull()
    // Reading preferences still apply on a Mac.
    expect(screen.getByRole('button', { name: 'Pounds' })).toBeInTheDocument()
  })
})

describe('Your data', () => {
  it('gathers export, import and reset behind one door', async () => {
    await onboard()
    renderAt('/settings/data')

    expect(await screen.findByRole('heading', { name: 'Your data', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export as JSON' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pick a file' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset all data…' })).toBeInTheDocument()
  })

  it('asks for RESET in full before it will erase anything', async () => {
    await onboard()
    await createHabit({ name: 'Reading', frequencyType: 'daily', frequencyValue: 1 })
    renderAt('/settings/data')

    await userEvent.click(await screen.findByRole('button', { name: 'Reset all data…' }))
    const confirm = await screen.findByRole('button', { name: 'Reset all data' })
    expect(confirm).toBeDisabled()

    await userEvent.type(screen.getByRole('textbox'), 'reset')
    expect(screen.getByRole('button', { name: 'Reset all data' })).toBeDisabled()
    expect(await db.habits.count()).toBe(1)
  })

  it('offers an export on the way to erasing', async () => {
    await onboard()
    renderAt('/settings/data')

    await userEvent.click(await screen.findByRole('button', { name: 'Reset all data…' }))
    expect(screen.getByRole('button', { name: 'Export first' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep my data' })).toBeInTheDocument()
  })

  it('gives a reader nothing that writes', async () => {
    await onboard('reader')
    renderAt('/settings/data')

    await screen.findByRole('heading', { name: 'Your data', level: 1 })
    expect(screen.queryByRole('button', { name: 'Pick a file' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Reset all data/ })).toBeNull()
    // Exporting is a read, so a Mac keeps it.
    expect(screen.getByRole('button', { name: 'Export as JSON' })).toBeInTheDocument()
  })
})

describe('Records', () => {
  async function withLift() {
    await seedExercises()
    const split = await instantiateTemplate('split-ppl-3')
    const day = split.days[0].id
    const at = { localDate: '2026-01-05', splitDayId: day, exerciseId: 'ex-barbell-bench-press' }
    await logSet({ ...at, setIndex: 0 }, { weightKg: 80, reps: 5 }, DEVICE_ID)
    await logSet({ ...at, setIndex: 1 }, { weightKg: 85, reps: 3 }, DEVICE_ID)
  }

  it('opens on habits and keeps lifts behind the toggle', async () => {
    await onboard()
    await withLift()
    renderAt('/records')

    // The heading is in the skeleton too, so wait for the toggle itself.
    expect(await screen.findByRole('button', { name: 'Habits' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.queryByText('Barbell bench press')).toBeNull()
  })

  it('states a lift plainly once you switch to training', async () => {
    await onboard()
    await withLift()
    renderAt('/records')

    await userEvent.click(await screen.findByRole('button', { name: 'Training' }))

    expect(await screen.findByText('Barbell bench press')).toBeInTheDocument()
    // Heaviest single set, and the derived figures beside it.
    expect(screen.getByText('85')).toBeInTheDocument()
    expect(screen.getByText('Est. 1RM')).toBeInTheDocument()
    expect(screen.getByText('Best set volume')).toBeInTheDocument()
  })

  it('converts every weight when the unit is switched', async () => {
    await onboard()
    await withLift()
    renderAt('/records')

    await userEvent.click(await screen.findByRole('button', { name: 'Training' }))
    await userEvent.click(await screen.findByRole('button', { name: 'lb' }))

    await waitFor(async () => expect((await db.settings.get(DEVICE_ID))?.units).toBe('lb'))
    // 85 kg is 187.4 lb, so the kg figure is gone.
    expect(screen.queryByText('85')).toBeNull()
  })

  it('says so when nothing has been lifted', async () => {
    await onboard()
    renderAt('/records')

    await userEvent.click(await screen.findByRole('button', { name: 'Training' }))
    expect(
      await screen.findByText(/A movement appears here the first time you put a weight on it/),
    ).toBeInTheDocument()
  })
})
