import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { seedExercises } from '../db/exercises'
import { db } from '../db/schema'
import { logSet } from '../db/sessions'
import { createSettings } from '../db/settings'
import { instantiateTemplate } from '../db/splits'
import { resetDatabase } from '../test/setup'

const DEVICE_ID = 'test-device'
const BENCH = 'ex-barbell-bench-press'

beforeEach(async () => {
  localStorage.clear()
  localStorage.setItem('kusuo-device-id', DEVICE_ID)
  await resetDatabase()
})

async function withOneWeekLogged() {
  await createSettings({ deviceId: DEVICE_ID, deviceRole: 'writer', userName: 'Soso' })
  await db.settings.update(DEVICE_ID, { onboardingComplete: true })
  await seedExercises()
  const split = await instantiateTemplate('split-ppl-3')
  await logSet(
    { localDate: '2026-01-05', splitDayId: split.days[0].id, exerciseId: BENCH, setIndex: 0 },
    { weightKg: 92.5, reps: 6 },
    DEVICE_ID,
  )
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={[`/exercises/${BENCH}`]}>
      <App />
    </MemoryRouter>,
  )
}

describe('Exercise detail', () => {
  it('gives the twelve-week chart a scale, a floor and its ends', async () => {
    await withOneWeekLogged()
    renderDetail()

    // One logged week used to draw a single column against the container's
    // right edge with no number anywhere near it — a shape, not a fact.
    expect(await screen.findByText('Top set, twelve weeks')).toBeInTheDocument()
    const plot = screen.getByRole('img', { name: /Heaviest set in each of the last 12 weeks/ })
    const chart = plot.closest('section') as HTMLElement
    expect(within(chart).getByText('92.5 kg')).toBeInTheDocument()
    expect(within(chart).getByText('0')).toBeInTheDocument()
    // Both ends of the axis: the oldest week by date, and the newest by name.
    expect(within(chart).getByText('20 Oct')).toBeInTheDocument()
    expect(within(chart).getByText('this week')).toBeInTheDocument()
  })

  it('capitalises the category beside the muscle group and the equipment', async () => {
    await withOneWeekLogged()
    renderDetail()

    expect(await screen.findByText('Push')).toBeInTheDocument()
    expect(screen.queryByText('push')).toBeNull()
  })
})
