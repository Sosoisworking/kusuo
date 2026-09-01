import { describe, expect, it } from 'vitest'
import type { Exercise, SplitDay } from '../db/schema'
import {
  decodeWorkout,
  encodeWorkout,
  findWorkoutCode,
  formatSessionText,
  InvalidWorkoutCodeError,
  workoutFromDay,
  type SharedWorkout,
} from './share'

function exercise(id: string, name: string): Exercise {
  return {
    id,
    name,
    category: 'push',
    muscleGroup: 'Chest',
    equipment: 'Barbell',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
  }
}

const WORKOUT: SharedWorkout = {
  v: 2,
  label: 'Push',
  entries: [
    { name: 'Barbell bench press', sets: 3, repsMin: 6, repsMax: 8 },
    { name: "Hibah's cris cross", sets: 3, repsMin: 12, repsMax: 15 },
  ],
}

describe('the KUS2 code', () => {
  it('round-trips a workout', () => {
    expect(decodeWorkout(encodeWorkout(WORKOUT))).toEqual(WORKOUT)
  })

  it('survives an apostrophe and other non-ASCII', () => {
    const withUnicode: SharedWorkout = {
      v: 2,
      label: 'Push — day one',
      entries: [{ name: 'Around the world halos (R/L)', sets: 1, repsMin: 10, repsMax: 10 }],
    }
    expect(decodeWorkout(encodeWorkout(withUnicode))).toEqual(withUnicode)
  })

  it('is found inside a whole message', () => {
    const message = `here's yesterday's session, give it a go\n\n${encodeWorkout(WORKOUT)}\n\nlet me know`
    const code = findWorkoutCode(message)
    expect(code).toBeDefined()
    expect(decodeWorkout(code as string)).toEqual(WORKOUT)
  })

  it('finds nothing in a message that has no code', () => {
    expect(findWorkoutCode('just a normal message')).toBeUndefined()
  })

  it('refuses a code that was cut short rather than half-importing it', () => {
    const truncated = encodeWorkout(WORKOUT).slice(0, 20)
    expect(() => decodeWorkout(truncated)).toThrow(InvalidWorkoutCodeError)
  })

  it('refuses valid base64 that is not a workout', () => {
    expect(() => decodeWorkout(`KUS2:${btoa('{"hello":"world"}')}`)).toThrow(InvalidWorkoutCodeError)
  })

  it('refuses a version it does not know', () => {
    const future = btoa(JSON.stringify({ ...WORKOUT, v: 3 }))
    expect(() => decodeWorkout(`KUS2:${future}`)).toThrow(InvalidWorkoutCodeError)
  })
})

describe('workoutFromDay', () => {
  it('travels by name, not by id', () => {
    const day: SplitDay = {
      id: 'day-1',
      label: 'Push',
      kind: 'training',
      entries: [{ exerciseId: 'ex-bench', sets: 3, repsMin: 6, repsMax: 8 }],
    }
    const byId = new Map([['ex-bench', exercise('ex-bench', 'Barbell bench press')]])
    expect(workoutFromDay(day, byId)).toEqual({
      v: 2,
      label: 'Push',
      entries: [{ name: 'Barbell bench press', sets: 3, repsMin: 6, repsMax: 8 }],
    })
  })
})

describe('formatSessionText', () => {
  const byId = new Map([['ex-bench', exercise('ex-bench', 'Barbell bench press')]])
  const rows = [
    {
      exerciseId: 'ex-bench',
      volumeKg: 880,
      sets: [
        { localDate: '2026-01-05', splitDayId: 'd', exerciseId: 'ex-bench', setIndex: 0, weightKg: 80, reps: 6, timestamp: 1 },
        { localDate: '2026-01-05', splitDayId: 'd', exerciseId: 'ex-bench', setIndex: 1, weightKg: 80, reps: 5, timestamp: 2 },
      ],
    },
  ]

  it('reads as plain text to someone who has never used Kusuo', () => {
    const text = formatSessionText('2026-01-05', 'Push', rows, byId, 'kg')
    expect(text).toContain('Push · Monday 5 January')
    expect(text).toContain('Barbell bench press  80×6, 80×5')
    expect(text).toContain('2 sets · 880kg')
  })

  it('states the sender\'s units, since a bare number is ambiguous', () => {
    const text = formatSessionText('2026-01-05', 'Push', rows, byId, 'lb')
    expect(text).toContain('lb')
    expect(text).not.toContain('80×6')
  })

  it('writes a circuit as time', () => {
    const cardio = [
      {
        exerciseId: 'ex-kb',
        volumeKg: 0,
        sets: [
          { localDate: '2026-01-05', splitDayId: 'd', exerciseId: 'ex-kb', setIndex: 0, weightKg: 0, reps: 0, durationSec: 1200, timestamp: 1 },
        ],
      },
    ]
    const text = formatSessionText('2026-01-05', 'Push', cardio, new Map([['ex-kb', exercise('ex-kb', 'Kettlebell 1')]]), 'kg')
    expect(text).toContain('Kettlebell 1  20 min')
  })
})
