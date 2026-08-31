import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  daysInMonth,
  monthDays,
  monthLabel,
  startOfMonth,
  startOfWeek,
  todayLocalDate,
  weekdayIndex,
} from './date'

describe('todayLocalDate', () => {
  it('formats device-local date, no early-morning special case', () => {
    expect(todayLocalDate(new Date(2026, 0, 5, 0, 3))).toBe('2026-01-05')
    expect(todayLocalDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('pads single-digit month/day', () => {
    expect(todayLocalDate(new Date(2026, 2, 7))).toBe('2026-03-07')
  })
})

describe('addDays', () => {
  it('adds and subtracts across month/year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
  })
})

describe('startOfWeek', () => {
  it('returns Monday for any day in that week', () => {
    // 2026-01-05 is a Monday
    expect(startOfWeek('2026-01-05')).toBe('2026-01-05')
    expect(startOfWeek('2026-01-06')).toBe('2026-01-05') // Tue
    expect(startOfWeek('2026-01-11')).toBe('2026-01-05') // Sun
    expect(startOfWeek('2026-01-12')).toBe('2026-01-12') // next Mon
  })

  it('defaults to Monday, matching the stored default setting', () => {
    expect(startOfWeek('2026-01-08')).toBe(startOfWeek('2026-01-08', 'monday'))
  })

  it('returns Sunday when the week starts on Sunday', () => {
    // 2026-01-04 is a Sunday
    expect(startOfWeek('2026-01-04', 'sunday')).toBe('2026-01-04')
    expect(startOfWeek('2026-01-05', 'sunday')).toBe('2026-01-04') // Mon
    expect(startOfWeek('2026-01-10', 'sunday')).toBe('2026-01-04') // Sat
    expect(startOfWeek('2026-01-11', 'sunday')).toBe('2026-01-11') // next Sun
  })

  it('puts a Sunday in different weeks under the two settings', () => {
    expect(startOfWeek('2026-01-11', 'monday')).toBe('2026-01-05')
    expect(startOfWeek('2026-01-11', 'sunday')).toBe('2026-01-11')
  })
})

describe('month helpers', () => {
  it('finds the first of the month', () => {
    expect(startOfMonth('2026-08-31')).toBe('2026-08-01')
  })

  it('counts days including a leap February', () => {
    expect(daysInMonth('2026-02-10')).toBe(28)
    expect(daysInMonth('2024-02-10')).toBe(29)
    expect(daysInMonth('2026-08-01')).toBe(31)
  })

  it('steps months and clamps to the first', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01')
  })

  it('lists every day of the month in order', () => {
    const days = monthDays('2026-02-05')
    expect(days).toHaveLength(28)
    expect(days[0]).toBe('2026-02-01')
    expect(days[27]).toBe('2026-02-28')
  })

  it('labels the month', () => {
    expect(monthLabel('2026-08-31')).toBe('August 2026')
  })

  it('places a day in the right grid column under each week start', () => {
    // 2026-01-05 is a Monday, 2026-01-04 a Sunday.
    expect(weekdayIndex('2026-01-05', 'monday')).toBe(0)
    expect(weekdayIndex('2026-01-04', 'monday')).toBe(6)
    expect(weekdayIndex('2026-01-04', 'sunday')).toBe(0)
    expect(weekdayIndex('2026-01-05', 'sunday')).toBe(1)
  })
})
