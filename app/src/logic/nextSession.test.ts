import { describe, expect, it } from 'vitest'
import type { Split } from '../db/schema'
import { dayForDate, formatPrescription, plannedSetCount } from './nextSession'

function split(labels: string[]): Split {
  return {
    id: 'split-1',
    name: 'Test split',
    days: labels.map((label, i) => ({
      id: `day-${i}`,
      label,
      kind: label === 'Rest' ? ('rest' as const) : ('training' as const),
      entries:
        label === 'Rest'
          ? []
          : [
              { exerciseId: 'ex-a', sets: 4, repsMin: 6, repsMax: 8 },
              { exerciseId: 'ex-b', sets: 3, repsMin: 10, repsMax: 10 },
            ],
    })),
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
  }
}

// 2026-01-05 is a Monday, so that week runs Mon 5th through Sun 11th.
const MON = '2026-01-05'
const TUE = '2026-01-06'
const WED = '2026-01-07'
const THU = '2026-01-08'
const SUN = '2026-01-11'

describe('dayForDate', () => {
  const week = split(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])

  it('puts the first day on the first day of the week', () => {
    expect(dayForDate(week, MON)?.label).toBe('Mon')
  })

  it('follows the calendar across the week', () => {
    expect(dayForDate(week, TUE)?.label).toBe('Tue')
    expect(dayForDate(week, WED)?.label).toBe('Wed')
    expect(dayForDate(week, SUN)?.label).toBe('Sun')
  })

  it('does not carry a missed day forward — Wednesday is still Wednesday', () => {
    // Nothing was done on Tuesday, and Wednesday is unaffected by that.
    expect(dayForDate(week, WED)?.label).toBe('Wed')
  })

  it('repeats a short split within the week', () => {
    const ppl = split(['Push', 'Pull', 'Legs'])
    expect(dayForDate(ppl, MON)?.label).toBe('Push')
    expect(dayForDate(ppl, TUE)?.label).toBe('Pull')
    expect(dayForDate(ppl, WED)?.label).toBe('Legs')
    expect(dayForDate(ppl, THU)?.label).toBe('Push')
  })

  it('shifts with the week-start setting', () => {
    // Under a Sunday week start, Sunday is column zero.
    expect(dayForDate(week, SUN, 'sunday')?.label).toBe('Mon')
    expect(dayForDate(week, MON, 'sunday')?.label).toBe('Tue')
  })

  it('lands on the rest days where the split puts them', () => {
    const batman = split(['D1', 'D2', 'Rest', 'D4', 'D5', 'D6', 'Rest'])
    expect(dayForDate(batman, WED)?.kind).toBe('rest')
    expect(dayForDate(batman, SUN)?.kind).toBe('rest')
    expect(dayForDate(batman, MON)?.kind).toBe('training')
  })

  it('has no day for a split with none', () => {
    expect(dayForDate({ ...split(['Push']), days: [] }, MON)).toBeUndefined()
  })
})

describe('plannedSetCount', () => {
  it('sums the sets across a day', () => {
    expect(plannedSetCount(split(['Push']).days[0])).toBe(7)
  })

  it('is zero for a rest day', () => {
    expect(plannedSetCount(split(['Rest']).days[0])).toBe(0)
  })
})

describe('formatPrescription', () => {
  it('states a range as a range', () => {
    expect(formatPrescription({ exerciseId: 'a', sets: 3, repsMin: 6, repsMax: 8 })).toBe('3 × 6-8')
  })

  it('collapses a fixed target to one number', () => {
    expect(formatPrescription({ exerciseId: 'a', sets: 3, repsMin: 10, repsMax: 10 })).toBe('3 × 10')
  })

  it('says nothing for cardio, which has no sets or reps to state', () => {
    expect(formatPrescription({ exerciseId: 'a', sets: 1, repsMin: 0, repsMax: 0 }, 'cardio')).toBe('')
  })
})
