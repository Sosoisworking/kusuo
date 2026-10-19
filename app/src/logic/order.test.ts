import { describe, expect, it } from 'vitest'
import { isLater } from './order'
import { completedDatesForHabit } from './derive'
import type { HabitEvent } from '../db/schema'

describe('isLater', () => {
  it('prefers the later timestamp', () => {
    expect(isLater({ timestamp: 2, deviceId: 'a' }, { timestamp: 1, deviceId: 'z' })).toBe(true)
  })

  it('breaks a tie on deviceId, the same way on every device', () => {
    expect(isLater({ timestamp: 1, deviceId: 'b' }, { timestamp: 1, deviceId: 'a' })).toBe(true)
    expect(isLater({ timestamp: 1, deviceId: 'a' }, { timestamp: 1, deviceId: 'b' })).toBe(false)
  })
})

describe('replay is independent of arrival order', () => {
  it('derives the same habit state from tied events in any order', () => {
    // Two devices, same millisecond, opposite answers for the same day.
    const events: HabitEvent[] = [
      { id: '1', habitId: 'h', localDate: '2026-01-05', action: 'complete', timestamp: 100, deviceId: 'phone' },
      { id: '2', habitId: 'h', localDate: '2026-01-05', action: 'uncomplete', timestamp: 100, deviceId: 'mac' },
    ]
    const results = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const shuffled = [...events].sort(() => Math.random() - 0.5)
      results.add([...completedDatesForHabit(shuffled, 'h')].join(','))
    }
    expect(results.size).toBe(1)
  })
})
