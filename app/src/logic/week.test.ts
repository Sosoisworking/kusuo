import { describe, expect, it } from 'vitest'
import type { Habit, HabitEvent } from '../db/schema'
import { completionsByDate, countInWeekOf, weekDays } from './week'

function habit(id: string): Habit {
  return {
    id,
    name: id,
    frequencyType: 'daily',
    frequencyValue: 1,
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
  }
}

let clock = 1000
function event(habitId: string, localDate: string, action: HabitEvent['action'] = 'complete'): HabitEvent {
  return { id: crypto.randomUUID(), habitId, localDate, action, timestamp: clock++, deviceId: 'dev1' }
}

describe('weekDays', () => {
  it('returns seven consecutive days starting Monday', () => {
    // 2026-01-05 is a Monday.
    expect(weekDays('2026-01-08')).toEqual([
      '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08',
      '2026-01-09', '2026-01-10', '2026-01-11',
    ])
  })

  it('starts on Sunday when the setting says so', () => {
    const days = weekDays('2026-01-08', 'sunday')
    expect(days[0]).toBe('2026-01-04')
    expect(days[6]).toBe('2026-01-10')
  })

  it('crosses a month boundary', () => {
    expect(weekDays('2026-02-01', 'monday')[0]).toBe('2026-01-26')
  })
})

describe('countInWeekOf', () => {
  it('counts only completions inside the week', () => {
    const dates = new Set(['2026-01-04', '2026-01-05', '2026-01-07', '2026-01-12'])
    expect(countInWeekOf(dates, '2026-01-08', 'monday')).toBe(2)
  })

  it('moves a Sunday between weeks with the setting', () => {
    const dates = new Set(['2026-01-11'])
    expect(countInWeekOf(dates, '2026-01-08', 'monday')).toBe(1)
    expect(countInWeekOf(dates, '2026-01-08', 'sunday')).toBe(0)
  })
})

describe('completionsByDate', () => {
  it('gives every requested date an entry, including zeroes', () => {
    const counts = completionsByDate([], [], ['2026-01-05', '2026-01-06'])
    expect([...counts.entries()]).toEqual([['2026-01-05', 0], ['2026-01-06', 0]])
  })

  it('counts habits completed per day', () => {
    const habits = [habit('a'), habit('b')]
    const events = [
      event('a', '2026-01-05'),
      event('b', '2026-01-05'),
      event('a', '2026-01-06'),
    ]
    const counts = completionsByDate(habits, events, ['2026-01-05', '2026-01-06', '2026-01-07'])
    expect(counts.get('2026-01-05')).toBe(2)
    expect(counts.get('2026-01-06')).toBe(1)
    expect(counts.get('2026-01-07')).toBe(0)
  })

  it('excludes a habit that was un-completed', () => {
    const events = [event('a', '2026-01-05'), event('a', '2026-01-05', 'uncomplete')]
    const counts = completionsByDate([habit('a')], events, ['2026-01-05'])
    expect(counts.get('2026-01-05')).toBe(0)
  })
})
