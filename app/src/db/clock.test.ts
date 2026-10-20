import { describe, expect, it, vi } from 'vitest'

// The clock reads its persisted value when the module loads, so each case
// imports a fresh copy after arranging what storage holds.
async function freshClock() {
  vi.resetModules()
  return import('./clock')
}

describe('the device clock', () => {
  it('never goes backwards, even when the wall clock does', async () => {
    const { nextTimestamp } = await freshClock()
    const first = nextTimestamp()
    vi.setSystemTime(new Date(Date.now() - 60 * 60 * 1000))
    expect(nextTimestamp()).toBeGreaterThan(first)
  })

  it('remembers across a relaunch', async () => {
    const before = await freshClock()
    const last = before.nextTimestamp()
    // A relaunch with the wall clock set an hour back.
    vi.setSystemTime(new Date(Date.now() - 60 * 60 * 1000))
    const after = await freshClock()
    expect(after.nextTimestamp()).toBeGreaterThan(last)
  })

  it('moves past a stamp that arrived from elsewhere', async () => {
    const { nextTimestamp, observeTimestamp } = await freshClock()
    const ahead = Date.now() + 10 * 60 * 1000
    observeTimestamp(ahead)
    expect(nextTimestamp()).toBeGreaterThan(ahead)
  })

  it('ignores a stamp that is not a number', async () => {
    const { nextTimestamp, observeTimestamp } = await freshClock()
    observeTimestamp(Number.NaN)
    expect(Number.isFinite(nextTimestamp())).toBe(true)
  })
})
