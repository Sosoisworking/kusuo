import { describe, expect, it } from 'vitest'
import type { SessionMark, Split } from '../db/schema'
import { nextSplitDay, plannedSetCount } from './nextSession'

function split(dayCount = 3): Split {
  return {
    id: 'split-1',
    name: 'Push / Pull / Legs',
    days: Array.from({ length: dayCount }, (_, i) => ({
      id: `day-${i}`,
      label: ['Push', 'Pull', 'Legs'][i] ?? `Day ${i}`,
      kind: 'training' as const,
      entries: [
        { exerciseId: 'ex-a', sets: 4, repsMin: 6, repsMax: 8 },
        { exerciseId: 'ex-b', sets: 3, repsMin: 10, repsMax: 10 },
      ],
    })),
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
  }
}

let clock = 1000
function mark(splitDayId: string, localDate: string, action: SessionMark['action'] = 'complete'): SessionMark {
  return { id: crypto.randomUUID(), localDate, splitDayId, action, timestamp: clock++, deviceId: 'dev1' }
}

describe('nextSplitDay', () => {
  it('starts at the first day when nothing has been finished', () => {
    expect(nextSplitDay(split(), [])?.label).toBe('Push')
  })

  it('advances to the day after the last finished one', () => {
    expect(nextSplitDay(split(), [mark('day-0', '2026-01-10')])?.label).toBe('Pull')
  })

  it('wraps at the end of the cycle', () => {
    const marks = [mark('day-0', '2026-01-10'), mark('day-1', '2026-01-12'), mark('day-2', '2026-01-14')]
    expect(nextSplitDay(split(), marks)?.label).toBe('Push')
  })

  it('does not advance for a session that was un-finished', () => {
    const marks = [mark('day-0', '2026-01-10'), mark('day-0', '2026-01-10', 'uncomplete')]
    expect(nextSplitDay(split(), marks)?.label).toBe('Push')
  })

  it('follows the latest finish, not array order', () => {
    const first = mark('day-0', '2026-01-10')
    const second = mark('day-1', '2026-01-12')
    expect(nextSplitDay(split(), [second, first])?.label).toBe('Legs')
  })

  it('ignores marks belonging to a different split', () => {
    expect(nextSplitDay(split(), [mark('someone-elses-day', '2026-01-10')])?.label).toBe('Push')
  })

  it('has no next day for a split with no days', () => {
    expect(nextSplitDay({ ...split(), days: [] }, [])).toBeUndefined()
  })
})

describe('plannedSetCount', () => {
  it('sums the sets across a day', () => {
    expect(plannedSetCount(split().days[0])).toBe(7)
  })

  it('is zero for an empty day', () => {
    expect(plannedSetCount({ id: 'd', label: 'Empty', kind: 'training', entries: [] })).toBe(0)
  })
})
