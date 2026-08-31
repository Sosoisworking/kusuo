import { describe, expect, it } from 'vitest'
import type { SessionMark } from '../db/schema'
import { addDays, startOfWeek } from '../lib/date'
import type { LoggedSet } from './sessions'
import {
  historyByDate,
  lastCompletedDate,
  lastSessionSets,
  recentSessions,
  summariseSets,
  topSetWeeks,
} from './trainingHistory'

let clock = 1000

function set(overrides: Partial<LoggedSet> = {}): LoggedSet {
  return {
    localDate: '2026-08-25',
    splitDayId: 'day1',
    exerciseId: 'ex-barbell-bench-press',
    setIndex: 0,
    weightKg: 80,
    reps: 6,
    timestamp: clock++,
    ...overrides,
  }
}

function mark(overrides: Partial<SessionMark> = {}): SessionMark {
  return {
    id: crypto.randomUUID(),
    localDate: '2026-08-25',
    splitDayId: 'day1',
    action: 'complete',
    timestamp: clock++,
    deviceId: 'dev1',
    ...overrides,
  }
}

describe('historyByDate', () => {
  it('groups by day, newest day first, sets in order', () => {
    const days = historyByDate([
      set({ localDate: '2026-08-18', setIndex: 1 }),
      set({ localDate: '2026-08-25', setIndex: 1, weightKg: 85 }),
      set({ localDate: '2026-08-25', setIndex: 0, weightKg: 90 }),
    ])
    expect(days.map((d) => d.localDate)).toEqual(['2026-08-25', '2026-08-18'])
    expect(days[0].sets.map((s) => s.weightKg)).toEqual([90, 85])
  })

  it('is empty for a movement never trained', () => {
    expect(historyByDate([])).toEqual([])
  })
})

describe('lastSessionSets', () => {
  it('returns the most recent day', () => {
    const sets = lastSessionSets([
      set({ localDate: '2026-08-18' }),
      set({ localDate: '2026-08-25', weightKg: 90 }),
    ])
    expect(sets).toHaveLength(1)
    expect(sets[0].weightKg).toBe(90)
  })

  it('skips today when asked for what came before it', () => {
    const sets = lastSessionSets(
      [set({ localDate: '2026-08-18' }), set({ localDate: '2026-08-25', weightKg: 90 })],
      '2026-08-25',
    )
    expect(sets[0].weightKg).toBe(80)
  })

  it('returns nothing when there is no earlier day', () => {
    expect(lastSessionSets([set({ localDate: '2026-08-25' })], '2026-08-25')).toEqual([])
  })
})

describe('summariseSets', () => {
  it('collapses sets that shared a weight', () => {
    const sets = [
      set({ setIndex: 0, weightKg: 45, reps: 8 }),
      set({ setIndex: 1, weightKg: 45, reps: 8 }),
      set({ setIndex: 2, weightKg: 45, reps: 7 }),
    ]
    expect(summariseSets(sets, 'kg')).toBe('45 kg × 8, 8, 7')
  })

  it('lists each set when the weight moved', () => {
    const sets = [
      set({ setIndex: 0, weightKg: 92.5, reps: 6 }),
      set({ setIndex: 1, weightKg: 85, reps: 8 }),
    ]
    expect(summariseSets(sets, 'kg')).toBe('92.5 × 6 · 85 × 8')
  })

  it('converts to pounds when that is the setting', () => {
    expect(summariseSets([set({ weightKg: 100, reps: 5 })], 'lb')).toBe('220.5 lb × 5')
  })

  it('reports cardio as time', () => {
    const sets = [set({ weightKg: 0, reps: 0, durationSec: 600 })]
    expect(summariseSets(sets, 'kg', true)).toBe('10 min')
  })

  it('says nothing about an empty day', () => {
    expect(summariseSets([], 'kg')).toBe('')
  })
})

describe('topSetWeeks', () => {
  const today = '2026-08-31'

  it('returns one column per week, including the empty ones', () => {
    const weeks = topSetWeeks([], today, 12)
    expect(weeks).toHaveLength(12)
    expect(weeks.every((w) => w.topKg === 0)).toBe(true)
  })

  it('puts this week last and holds the heaviest set of the week', () => {
    const weeks = topSetWeeks(
      [set({ localDate: today, weightKg: 80 }), set({ localDate: today, weightKg: 92.5 })],
      today,
      12,
    )
    expect(weeks.at(-1)).toEqual({ weekStart: startOfWeek(today), topKg: 92.5 })
  })

  it('leaves a gap where nothing was logged', () => {
    const eightWeeksBack = addDays(startOfWeek(today), -8 * 7)
    const weeks = topSetWeeks([set({ localDate: eightWeeksBack, weightKg: 70 })], today, 12)
    expect(weeks[3].topKg).toBe(70)
    expect(weeks[4].topKg).toBe(0)
  })

  it('follows a Sunday week start when that is the setting', () => {
    const weeks = topSetWeeks([], today, 4, 'sunday')
    expect(weeks.at(-1)?.weekStart).toBe(startOfWeek(today, 'sunday'))
  })
})

describe('lastCompletedDate', () => {
  it('finds the most recent finished date for a day', () => {
    const marks = [
      mark({ localDate: '2026-08-18' }),
      mark({ localDate: '2026-08-25' }),
      mark({ localDate: '2026-08-26', splitDayId: 'day2' }),
    ]
    expect(lastCompletedDate(marks, 'day1')).toBe('2026-08-25')
  })

  it('forgets a session that was un-finished', () => {
    const marks = [
      mark({ localDate: '2026-08-25' }),
      mark({ localDate: '2026-08-25', action: 'uncomplete' }),
    ]
    expect(lastCompletedDate(marks, 'day1')).toBeUndefined()
  })
})

describe('recentSessions', () => {
  it('lists finished sessions newest first, capped', () => {
    const marks = [
      mark({ localDate: '2026-08-18' }),
      mark({ localDate: '2026-08-25' }),
      mark({ localDate: '2026-08-26', splitDayId: 'day2' }),
    ]
    expect(recentSessions(marks, 2).map((s) => s.localDate)).toEqual(['2026-08-26', '2026-08-25'])
  })

  it('drops an un-finished session', () => {
    const marks = [
      mark({ localDate: '2026-08-25' }),
      mark({ localDate: '2026-08-25', action: 'uncomplete' }),
    ]
    expect(recentSessions(marks, 5)).toEqual([])
  })
})
