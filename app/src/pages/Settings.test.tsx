import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { seedExercises } from '../db/exercises'
import { createHabit } from '../db/habits'
import { resetDatabase } from '../test/setup'
import { db } from '../db/schema'
import { allTables, clearEverything, clearRecord } from '../db/tables'
import { createSettings } from '../db/settings'
import { logSet } from '../db/sessions'
import { instantiateTemplate } from '../db/splits'
import { encodeWorkout } from '../lib/share'

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

describe('the profile menu', () => {
  it('opens from the initials and reaches what lost a tab', async () => {
    await onboard()
    renderAt('/')

    const button = await screen.findByRole('button', { name: 'Your profile' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(button)

    const menu = await screen.findByRole('menu')
    for (const label of ['Settings', 'Your data', 'Share', 'Reflect', 'Goals']) {
      expect(within(menu).getByRole('menuitem', { name: label })).toBeInTheDocument()
    }
    expect(within(menu).getByText(/holds the only copy/)).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    await onboard()
    renderAt('/')

    await userEvent.click(await screen.findByRole('button', { name: 'Your profile' }))
    await screen.findByRole('menu')
    await userEvent.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('is on Train as well as Today', async () => {
    await onboard()
    renderAt('/train')

    expect(await screen.findByRole('button', { name: 'Your profile' })).toBeInTheDocument()
  })
})

describe('sharing a workout', () => {
  it('refuses a message with no code in it', async () => {
    await onboard()
    await seedExercises()
    await instantiateTemplate('split-ppl-3')
    renderAt('/settings/data')

    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Paste a shared workout' }),
      'just a normal message',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Add to my split' }))

    expect(await screen.findByText(/No Kusuo code in that/)).toBeInTheDocument()
  })

  it('adds a pasted workout as a new day without touching the others', async () => {
    await onboard()
    await seedExercises()
    const split = await instantiateTemplate('split-ppl-3')
    const before = split.days.length
    const code = encodeWorkout({
      v: 2,
      label: 'Arms',
      entries: [{ name: 'Barbell curl', sets: 3, repsMin: 8, repsMax: 10 }],
    })
    renderAt('/settings/data')

    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Paste a shared workout' }),
      `try this{Enter}{Enter}${code}`,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Add to my split' }))

    expect(await screen.findByText(/Added "Arms \(shared\)"/)).toBeInTheDocument()
    const after = await db.splits.get(split.id)
    expect(after?.days).toHaveLength(before + 1)
    expect(after?.days.slice(0, before)).toEqual(split.days)
  })

  it('gives a reader no way to import one', async () => {
    await onboard('reader')
    renderAt('/settings/data')

    await screen.findByRole('heading', { name: 'Your data', level: 1 })
    expect(screen.queryByRole('textbox', { name: 'Paste a shared workout' })).toBeNull()
  })
})

describe('bodyweight', () => {
  it('logs a weigh-in and reads it back', async () => {
    await onboard()
    renderAt('/records')

    await userEvent.click(await screen.findByRole('button', { name: 'Training' }))
    await userEvent.type(await screen.findByRole('textbox', { name: /bodyweight in kg/i }), '82.5')
    await userEvent.click(screen.getByRole('button', { name: 'Log' }))

    await waitFor(async () => expect(await db.bodyweight.count()).toBe(1))
    expect(await screen.findByText(/82.5kg on/)).toBeInTheDocument()
  })

  it('records it in the sender\'s units', async () => {
    await onboard()
    await db.settings.update(DEVICE_ID, { units: 'lb' })
    renderAt('/records')

    await userEvent.click(await screen.findByRole('button', { name: 'Training' }))
    await userEvent.type(await screen.findByRole('textbox', { name: /bodyweight in lb/i }), '180')
    await userEvent.click(screen.getByRole('button', { name: 'Log' }))

    await waitFor(async () => expect(await db.bodyweight.count()).toBe(1))
    // Stored in kg regardless of what was typed.
    const stored = (await db.bodyweight.toArray())[0]
    expect(stored.weightKg).toBeCloseTo(81.6, 1)
  })
})

describe('reset covers everything', () => {
  it('empties every table Dexie knows about, whatever gets added later', async () => {
    await onboard()
    await seedExercises()
    await instantiateTemplate('split-ppl-3')
    await createHabit({ name: 'Reading', frequencyType: 'daily', frequencyValue: 1 })
    await db.bodyweight.add({
      id: 'w1',
      localDate: '2026-01-05',
      weightKg: 80,
      timestamp: 1,
      deviceId: DEVICE_ID,
    })

    const populated = []
    for (const table of allTables()) {
      if ((await table.count()) > 0) populated.push(table.name)
    }
    expect(populated.length).toBeGreaterThan(3)

    await clearEverything()

    // Enumerated from the schema, so a table added tomorrow is covered by this
    // assertion without anyone remembering to extend it.
    for (const table of allTables()) {
      expect({ table: table.name, rows: await table.count() }).toEqual({
        table: table.name,
        rows: 0,
      })
    }
  })

  it('leaves this device its settings when only the record is cleared', async () => {
    await onboard()
    await createHabit({ name: 'Reading', frequencyType: 'daily', frequencyValue: 1 })

    await clearRecord()

    expect(await db.habits.count()).toBe(0)
    // The device role, units and id belong to the phone, not the history.
    expect((await db.settings.get(DEVICE_ID))?.deviceRole).toBe('writer')
  })
})
