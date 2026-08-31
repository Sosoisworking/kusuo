import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { seedExercises } from '../db/exercises'
import { db, type Split } from '../db/schema'
import { logSet } from '../db/sessions'
import { createSettings } from '../db/settings'
import { instantiateTemplate } from '../db/splits'

const DEVICE_ID = 'test-device'

beforeEach(async () => {
  localStorage.clear()
  localStorage.setItem('kusuo-device-id', DEVICE_ID)
  await Promise.all([
    db.habits.clear(),
    db.habitEvents.clear(),
    db.settings.clear(),
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

/** Opens the directory as the split editor does: adding to the Push day. */
async function openDirectory(query = ''): Promise<Split> {
  await onboard()
  await seedExercises()
  const split = await instantiateTemplate('split-ppl-3')
  const day = split.days[0]
  renderAt(`/exercises?splitId=${split.id}&dayId=${day.id}${query}`)
  await screen.findByRole('heading', { name: 'Directory', level: 1 })
  return split
}

describe('the directory', () => {
  it('credits ExRx.net without implying affiliation', async () => {
    await openDirectory()
    expect(
      screen.getByText(
        'Movement categories follow the ExRx.net exercise directory. Not affiliated with or endorsed by ExRx.net.',
      ),
    ).toBeInTheDocument()
  })

  it('narrows by text search', async () => {
    await openDirectory()
    await userEvent.type(screen.getByLabelText('Search exercises'), 'bench')

    await waitFor(() => expect(screen.queryByText('Back squat')).toBeNull())
    expect(screen.getByText('Barbell bench press')).toBeInTheDocument()
  })

  it('narrows by category', async () => {
    await openDirectory()
    await userEvent.click(screen.getByRole('button', { name: 'Legs' }))

    await waitFor(() => expect(screen.queryByText('Barbell bench press')).toBeNull())
    expect(screen.getByText('Back squat')).toBeInTheDocument()
  })

  it('narrows by muscle group and by equipment', async () => {
    await openDirectory()
    await userEvent.selectOptions(screen.getByLabelText('Muscle group'), 'Chest')

    await waitFor(() => expect(screen.queryByText('Back squat')).toBeNull())
    expect(screen.getByText('Barbell bench press')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Equipment'), 'Dumbbell')
    await waitFor(() => expect(screen.queryByText('Barbell bench press')).toBeNull())
    expect(screen.getByText('Dumbbell bench press')).toBeInTheDocument()
  })

  it('narrows to what has actually been logged', async () => {
    await onboard()
    await seedExercises()
    const split = await instantiateTemplate('split-ppl-3')
    await logSet(
      {
        localDate: '2026-08-30',
        splitDayId: split.days[0].id,
        exerciseId: 'ex-back-squat',
        setIndex: 0,
      },
      { weightKg: 100, reps: 5 },
      DEVICE_ID,
    )
    renderAt(`/exercises?splitId=${split.id}&dayId=${split.days[0].id}`)
    await screen.findByRole('heading', { name: 'Directory', level: 1 })

    await userEvent.click(screen.getByRole('button', { name: 'Recent' }))

    await waitFor(() => expect(screen.queryByText('Barbell bench press')).toBeNull())
    expect(screen.getByText('Back squat')).toBeInTheDocument()
  })

  it('adds the chosen movement to the day', async () => {
    const split = await openDirectory()
    await userEvent.click(await screen.findByRole('button', { name: 'Add Back squat' }))

    await waitFor(async () => {
      const stored = await db.splits.get(split.id)
      expect(stored?.days[0].entries.map((e) => e.exerciseId)).toContain('ex-back-squat')
    })
    const stored = await db.splits.get(split.id)
    expect(stored?.days[0].entries).toHaveLength(6)
  })

  it('swaps the row it was opened from, keeping its place and its sets', async () => {
    await onboard()
    await seedExercises()
    const split = await instantiateTemplate('split-ppl-3')
    renderAt(`/exercises?splitId=${split.id}&dayId=${split.days[0].id}&swap=0`)
    await screen.findByRole('heading', { name: 'Directory', level: 1 })

    await userEvent.click(await screen.findByRole('button', { name: 'Swap in Push-up' }))

    await waitFor(async () => {
      const entries = (await db.splits.get(split.id))?.days[0].entries ?? []
      expect(entries[0].exerciseId).toBe('ex-push-up')
      expect(entries[0].sets).toBe(4)
      expect(entries).toHaveLength(5)
    })
  })

  it('says what to do when nothing matches', async () => {
    await openDirectory()
    await userEvent.type(screen.getByLabelText('Search exercises'), 'zzzz')

    expect(
      await screen.findByText('No movement matches those filters. Clear them, or add one of your own.'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(await screen.findByText('Barbell bench press')).toBeInTheDocument()
  })
})

describe('adding a custom exercise', () => {
  it('writes it and shows it under Mine', async () => {
    await openDirectory()
    await userEvent.click(screen.getByRole('button', { name: 'New exercise' }))

    const sheet = await screen.findByRole('dialog', { name: 'New exercise' })
    await userEvent.type(within(sheet).getByLabelText('Name'), 'Landmine press')
    await userEvent.type(within(sheet).getByLabelText('Muscle group'), 'Shoulders')
    await userEvent.type(within(sheet).getByLabelText('Equipment'), 'Barbell')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add exercise' }))

    await waitFor(async () => {
      const custom = await db.exercises.filter((e) => e.isCustom).toArray()
      expect(custom.map((e) => e.name)).toEqual(['Landmine press'])
    })

    // The sheet closes onto the directory filtered to "Mine", so the movement
    // just added is the one thing on screen rather than one of seventy-one.
    expect(screen.getByRole('button', { name: 'Mine' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText('Landmine press')).toBeInTheDocument()
    expect(screen.queryByText('Barbell bench press')).toBeNull()
  })

  it('refuses a nameless movement rather than saving a blank one', async () => {
    await openDirectory()
    await userEvent.click(screen.getByRole('button', { name: 'New exercise' }))
    const sheet = await screen.findByRole('dialog', { name: 'New exercise' })
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add exercise' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A name is the one field this needs.')
    expect(await db.exercises.filter((e) => e.isCustom).count()).toBe(0)
  })
})

describe('the Mac read-only build', () => {
  it('never reaches the directory', async () => {
    await seedExercises()
    const split = await instantiateTemplate('split-ppl-3')
    const before = JSON.stringify(await db.splits.get(split.id))
    const exerciseCount = await db.exercises.count()
    await onboard('reader')

    renderAt(`/exercises?splitId=${split.id}&dayId=${split.days[0].id}`)

    expect(await screen.findByRole('heading', { name: 'Splits', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New exercise' })).toBeNull()
    expect(JSON.stringify(await db.splits.get(split.id))).toBe(before)
    expect(await db.exercises.count()).toBe(exerciseCount)
  })
})
