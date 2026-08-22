import { describe, expect, it } from 'vitest'
import type { HabitEvent } from '../db/schema'
import { completedDatesForHabit, isCompleteOnDate } from './derive'

function ev(partial: Partial<HabitEvent> & Pick<HabitEvent, 'habitId' | 'localDate' | 'action' | 'timestamp'>): HabitEvent {
  return { id: crypto.randomUUID(), deviceId: 'd1', ...partial }
}

describe('isCompleteOnDate', () => {
  it('is false with no events', () => {
    expect(isCompleteOnDate([], 'h1', '2026-01-05')).toBe(false)
  })

  it('is true after a complete event', () => {
    const events = [ev({ habitId: 'h1', localDate: '2026-01-05', action: 'complete', timestamp: 1 })]
    expect(isCompleteOnDate(events, 'h1', '2026-01-05')).toBe(true)
  })

  it('double-complete is idempotent', () => {
    const events = [
      ev({ habitId: 'h1', localDate: '2026-01-05', action: 'complete', timestamp: 1 }),
      ev({ habitId: 'h1', localDate: '2026-01-05', action: 'complete', timestamp: 2 }),
    ]
    expect(isCompleteOnDate(events, 'h1', '2026-01-05')).toBe(true)
  })

  it('un-completing appends an uncomplete event that wins by timestamp', () => {
    const events = [
      ev({ habitId: 'h1', localDate: '2026-01-05', action: 'complete', timestamp: 1 }),
      ev({ habitId: 'h1', localDate: '2026-01-05', action: 'uncomplete', timestamp: 2 }),
    ]
    expect(isCompleteOnDate(events, 'h1', '2026-01-05')).toBe(false)
  })

  it('out-of-order insertion still resolves by timestamp, not array order', () => {
    const events = [
      ev({ habitId: 'h1', localDate: '2026-01-05', action: 'uncomplete', timestamp: 5 }),
      ev({ habitId: 'h1', localDate: '2026-01-05', action: 'complete', timestamp: 3 }),
    ]
    expect(isCompleteOnDate(events, 'h1', '2026-01-05')).toBe(false)
  })

  it('ignores events for other habits or other dates', () => {
    const events = [
      ev({ habitId: 'h2', localDate: '2026-01-05', action: 'complete', timestamp: 1 }),
      ev({ habitId: 'h1', localDate: '2026-01-06', action: 'complete', timestamp: 1 }),
    ]
    expect(isCompleteOnDate(events, 'h1', '2026-01-05')).toBe(false)
  })
})

describe('completedDatesForHabit', () => {
  it('returns only dates whose last event is complete', () => {
    const events = [
      ev({ habitId: 'h1', localDate: '2026-01-05', action: 'complete', timestamp: 1 }),
      ev({ habitId: 'h1', localDate: '2026-01-06', action: 'complete', timestamp: 1 }),
      ev({ habitId: 'h1', localDate: '2026-01-06', action: 'uncomplete', timestamp: 2 }),
      ev({ habitId: 'h2', localDate: '2026-01-05', action: 'complete', timestamp: 1 }),
    ]
    expect(completedDatesForHabit(events, 'h1')).toEqual(new Set(['2026-01-05']))
  })
})
