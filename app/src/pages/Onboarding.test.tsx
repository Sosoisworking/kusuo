import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { db } from '../db/schema'

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
    db.bodyweight.clear(),
  ])
})

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
}

/** Welcome → this iPhone → the "you" step. */
async function toYouStep() {
  renderApp()
  await userEvent.click(await screen.findByRole('button', { name: 'Set it up' }))
  await userEvent.click(await screen.findByRole('button', { name: 'This is my iPhone' }))
  await screen.findByRole('heading', { name: 'A little about you' })
}

describe('onboarding', () => {
  it('opens on the welcome screen and says what the app is', async () => {
    renderApp()
    expect(
      await screen.findByRole('heading', { name: /Habits, and the training that goes with them/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(/no account, no server/i)).toBeInTheDocument()
  })

  it('takes a name and weight units together', async () => {
    await toYouStep()

    // Two text fields now: the name and the first weigh-in.
    await userEvent.type(screen.getByRole('textbox', { name: /call you/i }), 'Soso')
    await userEvent.click(screen.getByRole('button', { name: 'Pounds' }))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(async () => {
      const s = await db.settings.get(DEVICE_ID)
      expect(s?.userName).toBe('Soso')
      expect(s?.units).toBe('lb')
    })
  })

  it('lets the whole step be skipped', async () => {
    await toYouStep()

    await userEvent.click(screen.getByRole('button', { name: /Skip/ }))

    await screen.findByRole('heading', { name: /habits/i })
    const s = await db.settings.get(DEVICE_ID)
    expect(s?.userName).toBeUndefined()
    expect(s?.units).toBe('kg')
  })

  it('ends by picking a split, which a fresh install never used to do', async () => {
    await toYouStep()
    await userEvent.click(screen.getByRole('button', { name: /Skip/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Get started' }))

    await screen.findByRole('heading', { name: /Which split are you running/ })
    const ppl = (await screen.findAllByRole('button')).find((b) =>
      b.textContent?.startsWith('Push / Pull / Legs'),
    )
    await userEvent.click(ppl as HTMLElement)

    await waitFor(async () => expect(await db.splits.count()).toBe(1))
    const split = (await db.splits.toArray())[0]
    expect(split.seededFrom).toBe('split-ppl-3')
    expect(split.isActive).toBe(true)
    expect((await db.settings.get(DEVICE_ID))?.onboardingComplete).toBe(true)
  })

  it('lets the split be skipped without leaving onboarding unfinished', async () => {
    await toYouStep()
    await userEvent.click(screen.getByRole('button', { name: /Skip/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Get started' }))

    await screen.findByRole('heading', { name: /Which split are you running/ })
    await userEvent.click(screen.getByRole('button', { name: /not lifting yet/ }))

    await waitFor(async () =>
      expect((await db.settings.get(DEVICE_ID))?.onboardingComplete).toBe(true),
    )
    expect(await db.splits.count()).toBe(0)
  })

  it('seeds the movement directory as soon as the device is a writer', async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Set it up' }))
    await userEvent.click(await screen.findByRole('button', { name: 'This is my iPhone' }))

    await waitFor(async () => expect(await db.exercises.count()).toBeGreaterThan(0))
  })

  it('does not ask a Mac for habits or a split', async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Set it up' }))
    await userEvent.click(await screen.findByRole('button', { name: 'This is my Mac' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Sounds right' }))

    await waitFor(async () =>
      expect((await db.settings.get(DEVICE_ID))?.onboardingComplete).toBe(true),
    )
    expect(await db.habits.count()).toBe(0)
    expect(await db.exercises.count()).toBe(0)
  })
})
