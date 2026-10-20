import { describe, expect, it } from 'vitest'
import type { Split, WeekStart } from '../db/schema'
import { addDays, weekdayIndex } from '../lib/date'
import { dayForDate } from './nextSession'
import { scheduledOn, sessionFor, weekFromOrder } from './schedule'

/**
 * The rule as it was written before plans existed, kept here as the oracle:
 * the day at the date's column in the week, wrapping when the split is shorter
 * than seven.
 */
function oldDayForDate(split: Split, localDate: string, weekStart: WeekStart) {
  if (split.days.length === 0) return undefined
  return split.days[weekdayIndex(localDate, weekStart) % split.days.length]
}

/** A split of `length` days where the bits of `restMask` say which are rest days. */
function splitOf(length: number, restMask: number): Split {
  return {
    id: `split-${length}-${restMask}`,
    name: 'Test',
    days: Array.from({ length }, (_, i) => {
      const rest = (restMask >> i) & 1
      return {
        id: `day-${i}`,
        // Labels repeat on purpose: a split with two "Push" days is common,
        // and nothing may be looked up by label.
        label: rest ? 'Rest' : i % 2 ? 'Pull' : 'Push',
        kind: rest ? ('rest' as const) : ('training' as const),
        entries: rest ? [] : [{ exerciseId: 'ex-a', sets: 3, repsMin: 6, repsMax: 8 }],
      }
    }),
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
  }
}

// Three weeks across a month and a year boundary, so every weekday comes up
// three times and the date arithmetic meets both edges.
const DATES = Array.from({ length: 21 }, (_, i) => addDays('2025-12-22', i))

describe('the week a plan makes', () => {
  it('names the same day as the old rule — every weekday, both week starts, 1 to 10 days, every placement of rest days', () => {
    let compared = 0
    for (let length = 1; length <= 10; length++) {
      for (let restMask = 0; restMask < 2 ** length; restMask++) {
        const split = splitOf(length, restMask)
        for (const weekStart of ['monday', 'sunday'] as const) {
          for (const date of DATES) {
            expect(dayForDate(split, date, weekStart)).toBe(oldDayForDate(split, date, weekStart))
            compared++
          }
        }
      }
    }
    // 2046 splits × 2 week starts × 21 dates: nothing skipped by accident.
    expect(compared).toBe(2046 * 2 * 21)
  })

  it('names nothing for a plan with no days, as before', () => {
    const empty = splitOf(0, 0)
    for (const date of DATES) {
      expect(dayForDate(empty, date, 'monday')).toBeUndefined()
      expect(scheduledOn(weekFromOrder([], 'monday'), date)).toEqual([])
    }
  })

  it('has one routine on every weekday while plans have one order', () => {
    for (let length = 1; length <= 10; length++) {
      const ids = Array.from({ length }, (_, i) => `r-${i}`)
      for (const weekStart of ['monday', 'sunday'] as const) {
        const week = weekFromOrder(ids, weekStart)
        expect(week).toHaveLength(7)
        for (const day of week) expect(day).toHaveLength(1)
      }
    }
  })

  it('starts on the first day of the week', () => {
    const ids = ['push', 'pull', 'legs']
    // 5 January 2026 is a Monday, 4 January a Sunday.
    expect(scheduledOn(weekFromOrder(ids, 'monday'), '2026-01-05')).toEqual(['push'])
    expect(scheduledOn(weekFromOrder(ids, 'sunday'), '2026-01-04')).toEqual(['push'])
    expect(scheduledOn(weekFromOrder(ids, 'sunday'), '2026-01-05')).toEqual(['pull'])
  })
})

describe('the session on a date', () => {
  const order = ['mon', 'tue', 'wed', 'thu']

  it('is what the schedule names until something is worked', () => {
    expect(sessionFor(['wed'], order, new Set())).toEqual(['wed'])
  })

  it('is the routine actually being done when it is not the scheduled one', () => {
    expect(sessionFor(['wed'], order, new Set(['mon']))).toEqual(['mon'])
  })

  it('holds every routine worked that day, the scheduled one first', () => {
    expect(sessionFor(['wed'], order, new Set(['thu', 'mon', 'wed']))).toEqual(['wed', 'mon', 'thu'])
  })

  it('lists a routine once, even when the schedule and the plan both name it', () => {
    expect(sessionFor(['wed', 'wed'], order, new Set(['wed']))).toEqual(['wed'])
  })

  it('ignores work against a routine the plan does not hold', () => {
    expect(sessionFor(['wed'], order, new Set(['elsewhere']))).toEqual(['wed'])
  })

  it('is empty for a plan with nothing in it', () => {
    expect(sessionFor([], [], new Set())).toEqual([])
  })
})
