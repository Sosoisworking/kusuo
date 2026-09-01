import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { seedExercises } from '../db/exercises'
import { db } from '../db/schema'
import { createSettings } from '../db/settings'
import { instantiateTemplate } from '../db/splits'
import { SPLIT_TEMPLATES } from '../lib/splitTemplates'

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

describe('the Splits screen', () => {
  it('leads with the active split and its days', async () => {
    await onboard()
    await seedExercises()
    const split = await instantiateTemplate('split-ppl-3')
    renderAt('/splits')

    const card = await screen.findByRole('region', { name: 'Active split' })
    expect(within(card).getByRole('heading', { name: 'Push / Pull / Legs' })).toBeInTheDocument()
    expect(within(card).getByText(/3 days · 15 exercises · updated/)).toBeInTheDocument()
    // Kusuo's split is a cycle, not a timetable, so the first day is what is
    // next rather than what is scheduled for today.
    expect(within(card).getByText('16 sets · next')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      `/splits/${split.id}/edit`,
    )
  })

  it('lists only the programmes you are not running', async () => {
    await onboard()
    await seedExercises()
    await instantiateTemplate('split-ppl-3')
    renderAt('/splits')

    await screen.findByRole('region', { name: 'Active split' })
    expect(screen.queryByRole('button', { name: 'Use Push / Pull / Legs' })).toBeNull()
    expect(screen.getAllByRole('button', { name: /^Use / })).toHaveLength(
      SPLIT_TEMPLATES.length - 1,
    )
  })

  it('marks a rest day as a rest day rather than an empty one', async () => {
    await onboard()
    await seedExercises()
    await instantiateTemplate('split-batman-7')
    renderAt('/splits')

    const card = await screen.findByRole('region', { name: 'Active split' })
    // Day 3 only. Day 7 is active recovery — it has a circuit in it, so calling
    // it rest would have the split claim you did nothing.
    expect(within(card).getAllByText('rest')).toHaveLength(1)
  })

  it('says what to do when no split is chosen', async () => {
    await onboard()
    renderAt('/splits')

    expect(
      await screen.findByText('No split chosen yet. Pick one below and it becomes yours to edit.'),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Use / })).toHaveLength(SPLIT_TEMPLATES.length)
  })

  it('takes a copy of a template and opens its editor', async () => {
    await onboard()
    await seedExercises()
    renderAt('/splits')

    await userEvent.click(await screen.findByRole('button', { name: 'Use Full body' }))
    const card = await screen.findByRole('region', { name: 'Active split' })
    const edit = within(card).getByRole('link', { name: 'Edit' })
    await userEvent.click(edit)

    expect(await screen.findByRole('heading', { name: 'Edit Full body A' })).toBeInTheDocument()
    const stored = await db.splits.toArray()
    expect(stored).toHaveLength(1)
    expect(stored[0].seededFrom).toBe('split-full-body-3')
  })
})

describe('opening a day', () => {
  it('expands into that day\'s exercises', async () => {
    await onboard()
    await seedExercises()
    await instantiateTemplate('split-batman-7')
    renderAt('/splits')

    const chip = await screen.findByRole('button', { name: /Chest \/ Shoulders \/ Biceps/ })
    expect(chip).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Machine pec deck')).toBeNull()

    await userEvent.click(chip)

    const panel = await screen.findByRole('region', {
      name: 'Chest / Shoulders / Biceps exercises',
    })
    expect(within(panel).getByText('Machine pec deck')).toBeInTheDocument()
    expect(within(panel).getByText('2 × 12-15')).toBeInTheDocument()
    expect(chip).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes again when the same day is tapped', async () => {
    await onboard()
    await seedExercises()
    await instantiateTemplate('split-batman-7')
    renderAt('/splits')

    const chip = await screen.findByRole('button', { name: /Chest \/ Shoulders \/ Biceps/ })
    await userEvent.click(chip)
    await screen.findByRole('region', { name: 'Chest / Shoulders / Biceps exercises' })
    await userEvent.click(chip)

    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Chest / Shoulders / Biceps exercises' }),
      ).toBeNull(),
    )
  })

  it('says a rest day is a rest day rather than showing an empty list', async () => {
    await onboard()
    await seedExercises()
    await instantiateTemplate('split-batman-7')
    renderAt('/splits')

    await userEvent.click(await screen.findByRole('button', { name: /^Rest/ }))

    const panel = await screen.findByRole('region', { name: 'Rest exercises' })
    expect(within(panel).getByText('A rest day. Nothing scheduled.')).toBeInTheDocument()
  })

  it('gives a circuit its length instead of a rep target', async () => {
    await onboard()
    await seedExercises()
    await instantiateTemplate('split-batman-7')
    renderAt('/splits')

    await userEvent.click(await screen.findByRole('button', { name: /Active recovery/ }))

    const panel = await screen.findByRole('region', { name: 'Active recovery exercises' })
    expect(within(panel).getByText('Kettlebell 3')).toBeInTheDocument()
    expect(within(panel).getByText('20 min')).toBeInTheDocument()
  })

  it('counts one set as a set', async () => {
    await onboard()
    await seedExercises()
    await instantiateTemplate('split-batman-7')
    renderAt('/splits')

    const chip = await screen.findByRole('button', { name: /Active recovery/ })
    expect(chip.textContent).toContain('1 set')
    expect(chip.textContent).not.toContain('1 sets')
  })
})
