import { describe, expect, it } from 'vitest'
import type { SessionEvent, SessionMark } from '../db/schema'
import {
  dayBreakdown,
  isSessionComplete,
  liveSets,
  setsOnDate,
  trainingDates,
  volume,
  workedOn,
} from './sessions'

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

function makeMark(overrides: Partial<SessionMark> = {}): SessionMark {
  return {
    id: crypto.randomUUID(),
    localDate: '2026-01-10',
    splitDayId: 'day1',
    action: 'complete',
    timestamp: clock++,
    deviceId: 'dev1',
    ...overrides,
  }
}

describe('liveSets', () => {
  it('returns nothing for an empty log', () => {
    expect(liveSets([])).toEqual([])
  })

  it('keeps one set per slot', () => {
    const sets = liveSets([makeEvent({ setIndex: 0 }), makeEvent({ setIndex: 1 })])
    expect(sets).toHaveLength(2)
    expect(sets.map((s) => s.setIndex)).toEqual([0, 1])
  })

  it('lets a later log correct an earlier one in the same slot', () => {
    const first = makeEvent({ weightKg: 200, reps: 5 })
    const corrected = makeEvent({ weightKg: 100, reps: 5 })
    const sets = liveSets([first, corrected])
    expect(sets).toHaveLength(1)
    expect(sets[0].weightKg).toBe(100)
  })

  it('drops a slot whose last event is a void', () => {
    const logged = makeEvent()
    const voided = makeEvent({ action: 'void' })
    expect(liveSets([logged, voided])).toEqual([])
  })

  it('brings a slot back when it is logged again after a void', () => {
    const events = [makeEvent(), makeEvent({ action: 'void' }), makeEvent({ weightKg: 105 })]
    const sets = liveSets(events)
    expect(sets).toHaveLength(1)
    expect(sets[0].weightKg).toBe(105)
  })

  it('is order-independent — replay depends on timestamp, not array order', () => {
    const early = makeEvent({ weightKg: 200 })
    const late = makeEvent({ weightKg: 100 })
    expect(liveSets([late, early])[0].weightKg).toBe(100)
    expect(liveSets([early, late])[0].weightKg).toBe(100)
  })

  it('keeps the same exercise on different days apart', () => {
    const events = [makeEvent({ localDate: '2026-01-10' }), makeEvent({ localDate: '2026-01-12' })]
    expect(liveSets(events)).toHaveLength(2)
    expect(setsOnDate(events, '2026-01-12')).toHaveLength(1)
  })
})

describe('volume', () => {
  it('sums weight times reps', () => {
    const sets = liveSets([
      makeEvent({ setIndex: 0, weightKg: 100, reps: 5 }),
      makeEvent({ setIndex: 1, weightKg: 60, reps: 10 }),
    ])
    expect(volume(sets)).toBe(1100)
  })

  it('excludes a voided set', () => {
    const sets = liveSets([
      makeEvent({ setIndex: 0, weightKg: 100, reps: 5 }),
      makeEvent({ setIndex: 1, weightKg: 60, reps: 10 }),
      makeEvent({ setIndex: 1, weightKg: 60, reps: 10, action: 'void' }),
    ])
    expect(volume(sets)).toBe(500)
  })
})

describe('isSessionComplete', () => {
  it('is false with no marks', () => {
    expect(isSessionComplete([], '2026-01-10', 'day1')).toBe(false)
  })

  it('is true after a complete mark', () => {
    expect(isSessionComplete([makeMark()], '2026-01-10', 'day1')).toBe(true)
  })

  it('is false again after an uncomplete mark', () => {
    const marks = [makeMark(), makeMark({ action: 'uncomplete' })]
    expect(isSessionComplete(marks, '2026-01-10', 'day1')).toBe(false)
  })

  it('does not leak between split days on the same date', () => {
    const marks = [makeMark({ splitDayId: 'day1' })]
    expect(isSessionComplete(marks, '2026-01-10', 'day2')).toBe(false)
  })
})

describe('trainingDates', () => {
  it('collects dates with a finished session', () => {
    const marks = [makeMark({ localDate: '2026-01-10' }), makeMark({ localDate: '2026-01-12' })]
    expect(trainingDates(marks)).toEqual(new Set(['2026-01-10', '2026-01-12']))
  })

  it('drops a date that was un-finished', () => {
    const marks = [
      makeMark({ localDate: '2026-01-10' }),
      makeMark({ localDate: '2026-01-10', action: 'uncomplete' }),
    ]
    expect(trainingDates(marks)).toEqual(new Set())
  })

  it('keeps a date where one of two sessions is still finished', () => {
    const marks = [
      makeMark({ localDate: '2026-01-10', splitDayId: 'day1' }),
      makeMark({ localDate: '2026-01-10', splitDayId: 'day2' }),
      makeMark({ localDate: '2026-01-10', splitDayId: 'day1', action: 'uncomplete' }),
    ]
    expect(trainingDates(marks)).toEqual(new Set(['2026-01-10']))
  })
})

describe('trainingDates and rest days', () => {
  it('leaves out a rest day marked done', () => {
    const marks = [
      makeMark({ localDate: '2026-01-10', kind: 'training' }),
      makeMark({ localDate: '2026-01-11', splitDayId: 'rest', kind: 'rest' }),
    ]
    expect(trainingDates(marks)).toEqual(new Set(['2026-01-10']))
  })

  it('judges a mark from before marks said what they were by its routine', () => {
    const marks = [makeMark({ localDate: '2026-01-11', splitDayId: 'rest' })]
    expect(trainingDates(marks, new Set(['rest']))).toEqual(new Set())
    expect(trainingDates(marks, new Set())).toEqual(new Set(['2026-01-11']))
  })

  it('believes the mark over the routine, whose kind may have changed since', () => {
    // Sunday was a rest day when it was rested, and a training day now.
    const rested = [makeMark({ localDate: '2026-01-11', splitDayId: 'sunday', kind: 'rest' })]
    expect(trainingDates(rested, new Set())).toEqual(new Set())
    // And the other way: trained on, then turned into a rest day.
    const trained = [makeMark({ localDate: '2026-01-04', splitDayId: 'sunday', kind: 'training' })]
    expect(trainingDates(trained, new Set(['sunday']))).toEqual(new Set(['2026-01-04']))
  })
})

describe('workedOn', () => {
  it('holds the routines with a set logged or a finished mark that day', () => {
    const events = [
      makeEvent({ localDate: '2026-01-10', splitDayId: 'push' }),
      makeEvent({ localDate: '2026-01-09', splitDayId: 'legs' }),
    ]
    const marks = [makeMark({ localDate: '2026-01-10', splitDayId: 'pull' })]
    expect(workedOn(events, marks, '2026-01-10')).toEqual(new Set(['push', 'pull']))
  })

  it('does not count a set taken back out, or a session un-finished', () => {
    const set = makeEvent({ localDate: '2026-01-10', splitDayId: 'push', setId: 's1' })
    const events = [set, makeEvent({ ...set, id: 'void', action: 'void', timestamp: clock++ })]
    const marks = [
      makeMark({ localDate: '2026-01-10', splitDayId: 'pull' }),
      makeMark({ localDate: '2026-01-10', splitDayId: 'pull', action: 'uncomplete' }),
    ]
    expect(workedOn(events, marks, '2026-01-10')).toEqual(new Set())
  })
})

describe('dayBreakdown', () => {
  it('is empty for a day with nothing logged', () => {
    expect(dayBreakdown([], '2026-01-05')).toEqual([])
  })

  it('groups a day by movement, in the order each was first logged', () => {
    const events = [
      makeEvent({ exerciseId: 'ex-squat', setIndex: 0, weightKg: 100, reps: 5 }),
      makeEvent({ exerciseId: 'ex-rdl', setIndex: 0, weightKg: 80, reps: 8 }),
      makeEvent({ exerciseId: 'ex-squat', setIndex: 1, weightKg: 100, reps: 5 }),
    ]
    const rows = dayBreakdown(events, '2026-01-10')
    expect(rows.map((r) => r.exerciseId)).toEqual(['ex-squat', 'ex-rdl'])
    expect(rows[0].sets).toHaveLength(2)
    expect(rows[0].volumeKg).toBe(1000)
    expect(rows[1].volumeKg).toBe(640)
  })

  it('leaves a voided set out of the day', () => {
    const events = [
      makeEvent({ exerciseId: 'ex-squat', setIndex: 0, weightKg: 100, reps: 5 }),
      makeEvent({ exerciseId: 'ex-squat', setIndex: 1, weightKg: 999, reps: 1 }),
      makeEvent({ exerciseId: 'ex-squat', setIndex: 1, weightKg: 999, reps: 1, action: 'void' }),
    ]
    const rows = dayBreakdown(events, '2026-01-10')
    expect(rows[0].sets).toHaveLength(1)
    expect(rows[0].volumeKg).toBe(500)
  })

  it('keeps a different day out of it', () => {
    const events = [
      makeEvent({ localDate: '2026-01-10', exerciseId: 'ex-squat', weightKg: 100, reps: 5 }),
      makeEvent({ localDate: '2026-01-11', exerciseId: 'ex-squat', weightKg: 110, reps: 5 }),
    ]
    expect(dayBreakdown(events, '2026-01-10')[0].volumeKg).toBe(500)
  })
})
