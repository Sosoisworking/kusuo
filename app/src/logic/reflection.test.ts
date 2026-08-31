import { describe, expect, it } from 'vitest'
import type { ReflectionEntry } from '../db/schema'
import { isBlank, latestReflectionForDate, latestReflectionsByDate, reflectionSummary } from './reflection'

function entry(partial: Partial<ReflectionEntry> & Pick<ReflectionEntry, 'localDate' | 'text' | 'timestamp'>): ReflectionEntry {
  return { id: crypto.randomUUID(), deviceId: 'd1', ...partial }
}

describe('latestReflectionForDate', () => {
  it('returns undefined with no entries', () => {
    expect(latestReflectionForDate([], '2026-01-05')).toBeUndefined()
  })

  it('returns undefined when the date has no entries', () => {
    const entries = [entry({ localDate: '2026-01-06', text: 'other', timestamp: 1 })]
    expect(latestReflectionForDate(entries, '2026-01-05')).toBeUndefined()
  })

  it('last-wins by timestamp on multiple entries for the same date', () => {
    const entries = [
      entry({ localDate: '2026-01-05', text: 'first', timestamp: 1 }),
      entry({ localDate: '2026-01-05', text: 'second', timestamp: 2 }),
      entry({ localDate: '2026-01-05', text: 'third', timestamp: 3 }),
    ]
    expect(latestReflectionForDate(entries, '2026-01-05')?.text).toBe('third')
  })

  it('resolves by timestamp, not array order (out-of-order input)', () => {
    const entries = [
      entry({ localDate: '2026-01-05', text: 'later', timestamp: 5 }),
      entry({ localDate: '2026-01-05', text: 'earlier', timestamp: 3 }),
    ]
    expect(latestReflectionForDate(entries, '2026-01-05')?.text).toBe('later')
  })

  it('ignores entries for unrelated dates', () => {
    const entries = [
      entry({ localDate: '2026-01-06', text: 'other', timestamp: 10 }),
      entry({ localDate: '2026-01-05', text: 'mine', timestamp: 1 }),
    ]
    expect(latestReflectionForDate(entries, '2026-01-05')?.text).toBe('mine')
  })
})

describe('latestReflectionsByDate', () => {
  it('returns an empty map for empty input', () => {
    expect(latestReflectionsByDate([])).toEqual(new Map())
  })

  it('keeps only the last entry per distinct date', () => {
    const entries = [
      entry({ localDate: '2026-01-05', text: 'first', timestamp: 1 }),
      entry({ localDate: '2026-01-05', text: 'second', timestamp: 2 }),
      entry({ localDate: '2026-01-06', text: 'other-date', timestamp: 1 }),
    ]
    const byDate = latestReflectionsByDate(entries)
    expect(byDate.size).toBe(2)
    expect(byDate.get('2026-01-05')?.text).toBe('second')
    expect(byDate.get('2026-01-06')?.text).toBe('other-date')
  })

  it('resolves by timestamp, not array order (out-of-order input)', () => {
    const entries = [
      entry({ localDate: '2026-01-05', text: 'later', timestamp: 5 }),
      entry({ localDate: '2026-01-05', text: 'earlier', timestamp: 3 }),
    ]
    expect(latestReflectionsByDate(entries).get('2026-01-05')?.text).toBe('later')
  })

  it('leaves unrelated dates untouched', () => {
    const entries = [
      entry({ localDate: '2026-01-05', text: 'a', timestamp: 1 }),
      entry({ localDate: '2026-01-06', text: 'b', timestamp: 1 }),
      entry({ localDate: '2026-01-07', text: 'c', timestamp: 1 }),
    ]
    const byDate = latestReflectionsByDate(entries)
    expect(Array.from(byDate.keys()).sort()).toEqual(['2026-01-05', '2026-01-06', '2026-01-07'])
  })
})

describe('reflectionSummary', () => {
  const base = { id: 'r1', localDate: '2026-08-31', text: '', timestamp: 1, deviceId: 'dev1' }

  it('states the scores it has and omits the one it does not', () => {
    expect(reflectionSummary({ ...base, energy: 4 })).toBe('energy 4/5')
    expect(reflectionSummary({ ...base, energy: 4, mood: 2 })).toBe('energy 4/5 · mood 2/5')
  })

  it('labels the prompts and keeps the free note unlabelled', () => {
    const out = reflectionSummary({
      ...base,
      energy: 3,
      wentWell: 'Trained early',
      gotInTheWay: 'Slept badly',
      text: 'Quiet day otherwise.',
    })
    expect(out).toBe(
      'energy 3/5\nWent well: Trained early\nGot in the way: Slept badly\nQuiet day otherwise.',
    )
  })

  it('omits a prompt left blank rather than showing an empty label', () => {
    expect(reflectionSummary({ ...base, wentWell: '   ', text: 'Just this.' })).toBe('Just this.')
  })

  it('reads back an entry written before the prompts existed', () => {
    expect(reflectionSummary({ ...base, text: 'An old note.' })).toBe('An old note.')
  })
})

describe('isBlank', () => {
  it('is true when nothing was answered', () => {
    expect(isBlank({ text: '', energy: undefined, mood: undefined })).toBe(true)
    expect(isBlank({ text: '   ' })).toBe(true)
  })

  it('is false once any one prompt is answered', () => {
    expect(isBlank({ text: '', energy: 1 })).toBe(false)
    expect(isBlank({ text: '', wentWell: 'x' })).toBe(false)
  })
})
