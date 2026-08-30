import { describe, expect, it } from 'vitest'
import { addDays, startOfWeek, todayLocalDate } from './date'

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
