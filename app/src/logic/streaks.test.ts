import { describe, expect, it } from 'vitest'
import { dailyStreak, weeklyStreak } from './streaks'

describe('dailyStreak', () => {
  it('is 0 with no completions', () => {
    expect(dailyStreak(new Set(), '2026-01-10')).toBe(0)
  })

  it('counts consecutive days ending today', () => {
    const dates = new Set(['2026-01-08', '2026-01-09', '2026-01-10'])
    expect(dailyStreak(dates, '2026-01-10')).toBe(3)
  })

  it('unfinished today does not break the streak', () => {
    const dates = new Set(['2026-01-08', '2026-01-09'])
    expect(dailyStreak(dates, '2026-01-10')).toBe(2)
  })

  it('a gap breaks the streak', () => {
    const dates = new Set(['2026-01-08', '2026-01-10'])
    expect(dailyStreak(dates, '2026-01-10')).toBe(1)
  })

  it('missed yesterday and today resets to 0', () => {
    const dates = new Set(['2026-01-05'])
    expect(dailyStreak(dates, '2026-01-10')).toBe(0)
  })
})

describe('weeklyStreak', () => {
  // Weeks are Mon-Sun. 2026-01-05 is a Monday.
  it('is 0 with no completions', () => {
    expect(weeklyStreak(new Set(), 3, '2026-01-10')).toBe(0)
  })

  it('counts consecutive weeks meeting frequency, current week complete', () => {
    const dates = new Set([
      '2026-01-05', '2026-01-06', '2026-01-07', // week 1: 3
      '2026-01-12', '2026-01-13', '2026-01-14', // week 2: 3
    ])
    expect(weeklyStreak(dates, 3, '2026-01-14')).toBe(2)
  })

  it('unfinished current week does not break the streak yet', () => {
    const dates = new Set([
      '2026-01-05', '2026-01-06', '2026-01-07', // week 1: 3, met
      '2026-01-12', // week 2 (current, in progress): 1, not yet met
    ])
    expect(weeklyStreak(dates, 3, '2026-01-13')).toBe(1)
  })

  it('a fully-elapsed week that missed target breaks the streak', () => {
    const dates = new Set([
      '2026-01-05', '2026-01-06', '2026-01-07', // week 1: 3, met
      '2026-01-12', // week 2: 1, elapsed and missed
      '2026-01-19', '2026-01-20', '2026-01-21', // week 3: 3, met
    ])
    expect(weeklyStreak(dates, 3, '2026-01-21')).toBe(1)
  })

  it('follows the Sunday week boundary when the setting says so', () => {
    // Sun 2026-01-04 through Sat 2026-01-10, then Sun 11th through Sat 17th.
    const dates = new Set([
      '2026-01-04', '2026-01-05', '2026-01-06',
      '2026-01-11', '2026-01-12', '2026-01-13',
    ])
    expect(weeklyStreak(dates, 3, '2026-01-13', 'sunday')).toBe(2)
  })

  it('splits one run of days differently under each week start', () => {
    // Sat 10th and Sun 11th. Monday weeks hold both, meeting a 2x target;
    // Sunday weeks put the Sunday into a fresh week, so neither week meets it.
    const dates = new Set(['2026-01-10', '2026-01-11'])
    expect(weeklyStreak(dates, 2, '2026-01-11', 'monday')).toBe(1)
    expect(weeklyStreak(dates, 2, '2026-01-11', 'sunday')).toBe(0)
  })
})
