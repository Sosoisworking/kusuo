import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '../db/schema'
import {
  bestMonth,
  bestSessionVolume,
  bestStreak,
  estimatedOneRepMax,
  exerciseRecords,
  sessionTotals,
} from './records'
import { liveSets } from './sessions'

let clock = 1000
function makeEvent(overrides: Partial<SessionEvent> = {}): SessionEvent {
  return {
    id: crypto.randomUUID(),
    localDate: '2026-01-10',
    splitDayId: 'day1',
    exerciseId: 'ex-back-squat',
    setIndex: 0,
    weightKg: 100,
    reps: 5,
    action: 'log',
    timestamp: clock++,
    deviceId: 'dev1',
    ...overrides,
  }
}

describe('estimatedOneRepMax', () => {
  it('reports a single as itself rather than inflating it', () => {
    expect(estimatedOneRepMax(140, 1)).toBe(140)
    expect(estimatedOneRepMax(140, 0)).toBe(140)
  })

  it('applies Epley above one rep', () => {
    expect(estimatedOneRepMax(100, 5)).toBeCloseTo(116.667, 3)
    expect(estimatedOneRepMax(60, 10)).toBe(80)
  })
})

describe('exerciseRecords', () => {
  it('is empty for an exercise with no sets', () => {
    const records = exerciseRecords([], 'ex-back-squat')
    expect(records.totalSets).toBe(0)
    expect(records.heaviestSet).toBeUndefined()
    expect(records.repPrs).toEqual([])
  })

  it('finds the heaviest single set', () => {
    const records = exerciseRecords(
      [
        makeEvent({ setIndex: 0, weightKg: 100, reps: 5 }),
        makeEvent({ setIndex: 1, weightKg: 120, reps: 3 }),
        makeEvent({ setIndex: 2, weightKg: 110, reps: 4 }),
      ],
      'ex-back-squat',
    )
    expect(records.heaviestSet?.weightKg).toBe(120)
  })

  it('breaks a heaviest-set tie toward more reps', () => {
    const records = exerciseRecords(
      [
        makeEvent({ setIndex: 0, weightKg: 120, reps: 3 }),
        makeEvent({ setIndex: 1, weightKg: 120, reps: 6 }),
      ],
      'ex-back-squat',
    )
    expect(records.heaviestSet?.reps).toBe(6)
  })

  it('excludes a voided set from every record', () => {
    const records = exerciseRecords(
      [
        makeEvent({ setIndex: 0, weightKg: 100, reps: 5 }),
        makeEvent({ setIndex: 1, weightKg: 200, reps: 5 }),
        makeEvent({ setIndex: 1, weightKg: 200, reps: 5, action: 'void' }),
      ],
      'ex-back-squat',
    )
    expect(records.totalSets).toBe(1)
    expect(records.heaviestSet?.weightKg).toBe(100)
    expect(records.bestSetVolume?.volumeKg).toBe(500)
    expect(records.repPrs).toEqual([{ weightKg: 100, reps: 5 }])
  })

  it('ranks the best estimated 1RM by the estimate, not by raw weight', () => {
    const records = exerciseRecords(
      [
        makeEvent({ setIndex: 0, weightKg: 120, reps: 1 }),
        makeEvent({ setIndex: 1, weightKg: 100, reps: 10 }),
      ],
      'ex-back-squat',
    )
    expect(records.bestEstimatedOneRepMax?.set.weightKg).toBe(100)
    expect(records.bestEstimatedOneRepMax?.oneRepMaxKg).toBeCloseTo(133.333, 3)
  })

  it('keeps the highest reps at each weight, heaviest first', () => {
    const records = exerciseRecords(
      [
        makeEvent({ setIndex: 0, weightKg: 100, reps: 5 }),
        makeEvent({ setIndex: 1, weightKg: 100, reps: 8 }),
        makeEvent({ setIndex: 2, weightKg: 120, reps: 3 }),
      ],
      'ex-back-squat',
    )
    expect(records.repPrs).toEqual([
      { weightKg: 120, reps: 3 },
      { weightKg: 100, reps: 8 },
    ])
  })

  it('ignores sets belonging to another exercise', () => {
    const records = exerciseRecords(
      [
        makeEvent({ weightKg: 100 }),
        makeEvent({ exerciseId: 'ex-deadlift', weightKg: 200 }),
      ],
      'ex-back-squat',
    )
    expect(records.totalSets).toBe(1)
    expect(records.heaviestSet?.weightKg).toBe(100)
  })
})

describe('sessionTotals', () => {
  it('groups by date and split day, most recent first', () => {
    const sets = liveSets([
      makeEvent({ localDate: '2026-01-10', setIndex: 0, weightKg: 100, reps: 5 }),
      makeEvent({ localDate: '2026-01-10', setIndex: 1, weightKg: 100, reps: 5 }),
      makeEvent({ localDate: '2026-01-12', setIndex: 0, weightKg: 60, reps: 10 }),
    ])
    const totals = sessionTotals(sets)
    expect(totals.map((t) => t.localDate)).toEqual(['2026-01-12', '2026-01-10'])
    expect(totals[1].volumeKg).toBe(1000)
  })

  it('finds the heaviest session by volume', () => {
    const sets = liveSets([
      makeEvent({ localDate: '2026-01-10', setIndex: 0, weightKg: 100, reps: 5 }),
      makeEvent({ localDate: '2026-01-12', setIndex: 0, weightKg: 100, reps: 10 }),
    ])
    expect(bestSessionVolume(sets)?.localDate).toBe('2026-01-12')
  })

  it('has no best session when nothing is logged', () => {
    expect(bestSessionVolume([])).toBeUndefined()
  })
})

describe('bestStreak', () => {
  it('is zero with no completions', () => {
    expect(bestStreak(new Set())).toBe(0)
  })

  it('finds the longest run, not the most recent', () => {
    const dates = new Set([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
      '2026-01-10',
      '2026-01-11',
    ])
    expect(bestStreak(dates)).toBe(4)
  })

  it('counts a single isolated day as one', () => {
    expect(bestStreak(new Set(['2026-01-05']))).toBe(1)
  })

  it('crosses a month boundary', () => {
    expect(bestStreak(new Set(['2026-01-30', '2026-01-31', '2026-02-01']))).toBe(3)
  })
})

describe('bestMonth', () => {
  it('is undefined with no completions', () => {
    expect(bestMonth(new Set())).toBeUndefined()
  })

  it('picks the month with the most completions', () => {
    const dates = new Set(['2026-01-01', '2026-01-02', '2026-02-01'])
    expect(bestMonth(dates)).toEqual({ month: '2026-01', count: 2 })
  })

  it('breaks a tie toward the earlier month', () => {
    const dates = new Set(['2026-01-01', '2026-02-01'])
    expect(bestMonth(dates)).toEqual({ month: '2026-01', count: 1 })
  })
})
