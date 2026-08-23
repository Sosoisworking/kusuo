import { describe, expect, it } from 'vitest'
import type { ReflectionEntry } from '../db/schema'
import { latestReflectionForDate, latestReflectionsByDate } from './reflection'

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
