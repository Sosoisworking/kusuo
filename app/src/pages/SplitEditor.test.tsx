import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { seedExercises } from '../db/exercises'
import { resetDatabase } from '../test/setup'
import { db, type Split } from '../db/schema'
import { createSettings } from '../db/settings'
import { instantiateTemplate } from '../db/splits'
import { SPLIT_TEMPLATES } from '../lib/splitTemplates'

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

async function openEditor(templateId = 'split-ppl-3'): Promise<Split> {
  await onboard()
  await seedExercises()
  const split = await instantiateTemplate(templateId)
  renderAt(`/splits/${split.id}/edit`)
  await screen.findByRole('heading', { level: 1 })
  return split
}

function entryIds(split: Split | undefined, dayIndex = 0): string[] {
  return split?.days[dayIndex].entries.map((e) => e.exerciseId) ?? []
}

describe('the split editor', () => {
  it('edits the user’s own copy and leaves the template constant alone', async () => {
    const template = SPLIT_TEMPLATES.find((t) => t.id === 'split-ppl-3')
    const before = template?.days[0].entries.map((e) => e.exerciseId).join(',')

    const split = await openEditor()
    const handle = await screen.findByRole('button', { name: /^Reorder Barbell bench press/ })
    handle.focus()
    await userEvent.keyboard('{ArrowDown}')

    await waitFor(async () => {
      expect(entryIds(await db.splits.get(split.id))[0]).toBe('ex-incline-dumbbell-press')
    })

    const stored = await db.splits.get(split.id)
    expect(stored?.seededFrom).toBe('split-ppl-3')
    // The template constant is shared by every future instantiation, so a
    // reorder leaking into it would silently rewrite everyone else's copy.
    expect(template?.days[0].entries.map((e) => e.exerciseId).join(',')).toBe(before)
  })

  it('persists a reorder made with the keyboard', async () => {
    const split = await openEditor()
    const handle = await screen.findByRole('button', { name: /^Reorder Overhead press/ })
    handle.focus()
    await userEvent.keyboard('{ArrowUp}')

    await waitFor(async () => {
      expect(entryIds(await db.splits.get(split.id))).toEqual([
        'ex-barbell-bench-press',
        'ex-overhead-press',
        'ex-incline-dumbbell-press',
        'ex-lateral-raise',
        'ex-triceps-pushdown',
      ])
    })
  })

  it('persists a removal made without a pointer', async () => {
    const split = await openEditor()
    await userEvent.click(await screen.findByRole('button', { name: /^Barbell bench press/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Remove from Push' }))

    await waitFor(async () => {
      expect(entryIds(await db.splits.get(split.id))).not.toContain('ex-barbell-bench-press')
    })
    expect(entryIds(await db.splits.get(split.id))).toHaveLength(4)
  })

  it('reveals Remove on a left swipe and takes the row out', async () => {
    const split = await openEditor()
    const remove = await screen.findByLabelText('Remove Barbell bench press')
    expect(remove).toHaveAttribute('aria-hidden', 'true')

    const row = remove.closest('li')
    if (!row) throw new Error('row missing')
    fireEvent.pointerDown(row, { clientX: 300, clientY: 100 })
    fireEvent.pointerMove(row, { clientX: 230, clientY: 100 })
    fireEvent.pointerUp(row, { clientX: 230, clientY: 100 })

    await waitFor(() => expect(remove).toHaveAttribute('aria-hidden', 'false'))
    await userEvent.click(remove)

    await waitFor(async () => {
      expect(entryIds(await db.splits.get(split.id))).not.toContain('ex-barbell-bench-press')
    })
  })

  it('keeps one row swiped at a time', async () => {
    await openEditor()
    const first = await screen.findByLabelText('Remove Barbell bench press')
    const second = await screen.findByLabelText('Remove Overhead press')

    const firstRow = first.closest('li')
    const secondRow = second.closest('li')
    if (!firstRow || !secondRow) throw new Error('rows missing')

    fireEvent.pointerDown(firstRow, { clientX: 300, clientY: 100 })
    fireEvent.pointerMove(firstRow, { clientX: 220, clientY: 100 })
    fireEvent.pointerUp(firstRow, { clientX: 220, clientY: 100 })
    await waitFor(() => expect(first).toHaveAttribute('aria-hidden', 'false'))

    fireEvent.pointerDown(secondRow, { clientX: 300, clientY: 200 })
    fireEvent.pointerMove(secondRow, { clientX: 220, clientY: 200 })
    fireEvent.pointerUp(secondRow, { clientX: 220, clientY: 200 })

    await waitFor(() => expect(second).toHaveAttribute('aria-hidden', 'false'))
    expect(first).toHaveAttribute('aria-hidden', 'true')
  })

  it('lets you clear a number field and type a new one', async () => {
    const split = await openEditor()
    await userEvent.click(await screen.findByRole('button', { name: /^Barbell bench press/ }))

    // Clearing used to snap straight back to the floor of 1, so typing 12 over
    // an emptied field gave 112.
    const sets = screen.getByLabelText('Sets')
    fireEvent.change(sets, { target: { value: '' } })
    expect(sets).toHaveValue(null)
    fireEvent.change(sets, { target: { value: '12' } })
    fireEvent.blur(sets)

    await waitFor(async () => {
      expect((await db.splits.get(split.id))?.days[0].entries[0].sets).toBe(12)
    })
  })

  it('sets both ends of a rep range', async () => {
    const split = await openEditor()
    await userEvent.click(await screen.findByRole('button', { name: /^Barbell bench press/ }))

    // Typed, then left — the field holds text while you are in it and commits
    // a number when you leave, so a floor of 1 cannot fight you mid-keystroke.
    const from = screen.getByLabelText('Reps from')
    fireEvent.change(from, { target: { value: '5' } })
    fireEvent.blur(from)
    const to = screen.getByLabelText('Reps to')
    fireEvent.change(to, { target: { value: '9' } })
    fireEvent.blur(to)

    await waitFor(async () => {
      const entry = (await db.splits.get(split.id))?.days[0].entries[0]
      expect(entry?.repsMin).toBe(5)
      expect(entry?.repsMax).toBe(9)
    })
  })

  it('asks for no rep target on a cardio movement', async () => {
    await openEditor('split-batman-7')
    await userEvent.click(await screen.findByRole('button', { name: /^Kettlebell 1/ }))

    expect(
      screen.getByText('Cardio is logged by time, so it carries no set or rep target.'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Reps from')).toBeNull()
  })

  it('offers nothing to add on a rest day', async () => {
    await openEditor('split-batman-7')
    await userEvent.click(screen.getByRole('tab', { name: 'Rest' }))

    expect(await screen.findByText(/A rest day/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add an exercise' })).toBeNull()
  })

  it('counts the day as it stands', async () => {
    await openEditor()
    expect(await screen.findByText('5 exercises · 16 sets')).toBeInTheDocument()
  })

  it('opens on the day the date calls for, not on day one', async () => {
    // The suite is pinned to a Monday, where day one is also the day due — the
    // two answers have to differ for this to mean anything, so this one runs on
    // the Wednesday, when a 3-day split is on Legs.
    vi.setSystemTime(new Date(2026, 0, 7, 9, 0, 0))
    await onboard()
    await seedExercises()
    const split = await instantiateTemplate('split-ppl-3')

    renderAt(`/splits/${split.id}/edit`)

    expect(await screen.findByRole('heading', { name: 'Edit Legs', level: 1 })).toBeInTheDocument()
  })

  it('opens on the day it was asked for', async () => {
    await onboard()
    await seedExercises()
    const split = await instantiateTemplate('split-ppl-3')

    renderAt(`/splits/${split.id}/edit?day=${split.days[1].id}`)

    expect(await screen.findByRole('heading', { name: 'Edit Pull', level: 1 })).toBeInTheDocument()
  })

  it('puts a removed movement back where it was', async () => {
    const split = await openEditor()
    await userEvent.click(await screen.findByRole('button', { name: /^Barbell bench press/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Remove from Push' }))
    await waitFor(async () => {
      expect(entryIds(await db.splits.get(split.id))).not.toContain('ex-barbell-bench-press')
    })

    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }))

    await waitFor(async () => {
      expect(entryIds(await db.splits.get(split.id))[0]).toBe('ex-barbell-bench-press')
    })
    expect(entryIds(await db.splits.get(split.id))).toHaveLength(5)
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('offers the same undo after a swipe', async () => {
    const split = await openEditor()
    const remove = await screen.findByLabelText('Remove Barbell bench press')
    const row = remove.closest('li')
    if (!row) throw new Error('row missing')
    fireEvent.pointerDown(row, { clientX: 300, clientY: 100 })
    fireEvent.pointerMove(row, { clientX: 230, clientY: 100 })
    fireEvent.pointerUp(row, { clientX: 230, clientY: 100 })
    await waitFor(() => expect(remove).toHaveAttribute('aria-hidden', 'false'))
    await userEvent.click(remove)

    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }))

    await waitFor(async () => {
      expect(entryIds(await db.splits.get(split.id))).toContain('ex-barbell-bench-press')
    })
  })

  it('asks before it takes a day out of the split', async () => {
    const split = await openEditor()

    await userEvent.click(await screen.findByRole('button', { name: 'Remove day' }))
    expect((await db.splits.get(split.id))?.days).toHaveLength(3)
    expect(screen.getByText('Remove Push from Push / Pull / Legs?')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    expect((await db.splits.get(split.id))?.days).toHaveLength(3)

    await userEvent.click(screen.getByRole('button', { name: 'Remove day' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove Push' }))

    await waitFor(async () => expect((await db.splits.get(split.id))?.days).toHaveLength(2))
  })
})

describe('the Mac read-only build', () => {
  it('never reaches the split editor', async () => {
    await seedExercises()
    const split = await instantiateTemplate('split-ppl-3')
    const before = JSON.stringify(await db.splits.get(split.id))
    await db.exercises.clear()
    await onboard('reader')

    renderAt(`/splits/${split.id}/edit`)

    expect(await screen.findByRole('heading', { name: 'Splits', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull()
    expect(JSON.stringify(await db.splits.get(split.id))).toBe(before)
  })

  it('offers no Edit on the active split', async () => {
    await seedExercises()
    await instantiateTemplate('split-ppl-3')
    await db.exercises.clear()
    await onboard('reader')

    renderAt('/splits')
    const card = await screen.findByRole('region', { name: 'Active split' })
    expect(within(card).queryByRole('link', { name: 'Edit' })).toBeNull()
  })
})
