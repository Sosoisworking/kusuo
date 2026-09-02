import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { createGoal } from '../db/goals'
import { db } from '../db/schema'
import { createSettings } from '../db/settings'
import { resetDatabase } from '../test/setup'

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

describe('Goals', () => {
  it('reads like every other screen: an eyebrow, then the title', async () => {
    await onboard()
    await createGoal({ title: 'Deadlift 140 kg' })
    renderAt('/goals')

    expect(await screen.findByRole('heading', { name: 'Goals', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('1 active')).toBeInTheDocument()
  })

  it('says nothing is active rather than leaving the eyebrow blank', async () => {
    await onboard()
    renderAt('/goals')

    expect(await screen.findByText('Nothing active')).toBeInTheDocument()
  })

  it('shows the target date field as a date field, not an empty box', async () => {
    await onboard()
    renderAt('/goals')

    // iOS draws an unset date input as nothing at all. The picker is still the
    // native control — the label points at it — but what you read is ours.
    const field = await screen.findByLabelText('Target date (optional)')
    expect(field).toHaveAttribute('type', 'date')
    expect(screen.getByText('Choose a date')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('What are you working toward?'), 'Deadlift 140 kg')
    await userEvent.clear(field)
    await userEvent.type(field, '2026-12-24')

    expect(await screen.findByText('December 24, 2026')).toBeInTheDocument()
    expect(screen.queryByText('Choose a date')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Add goal' }))

    await waitFor(async () => {
      const [goal] = await db.goals.toArray()
      expect(goal?.targetDate).toBe('2026-12-24')
    })
  })

  it('lets a chosen date be taken back off', async () => {
    await onboard()
    renderAt('/goals')

    const field = await screen.findByLabelText('Target date (optional)')
    await userEvent.type(field, '2026-12-24')
    await userEvent.click(await screen.findByRole('button', { name: 'Clear' }))

    expect(await screen.findByText('Choose a date')).toBeInTheDocument()
  })

  it('gives a reader no form, only the record', async () => {
    await onboard('reader')
    await createGoal({ title: 'Deadlift 140 kg' })
    renderAt('/goals')

    expect(await screen.findByText('Deadlift 140 kg')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add goal' })).toBeNull()
  })
})
