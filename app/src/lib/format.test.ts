import { describe, expect, it } from 'vitest'
import { formatLongDate, greeting, initials } from './format'

describe('formatLongDate', () => {
  it('reads as weekday, day, month', () => {
    expect(formatLongDate('2026-08-29')).toBe('Saturday 29 August')
  })

  it('handles the first of a month without padding the day', () => {
    expect(formatLongDate('2026-02-01')).toBe('Sunday 1 February')
  })
})

describe('greeting', () => {
  it('changes with the time of day', () => {
    expect(greeting(6)).toBe('Good morning')
    expect(greeting(11)).toBe('Good morning')
    expect(greeting(12)).toBe('Good afternoon')
    expect(greeting(17)).toBe('Good afternoon')
    expect(greeting(18)).toBe('Good evening')
    expect(greeting(23)).toBe('Good evening')
  })

  it('treats midnight as morning', () => {
    expect(greeting(0)).toBe('Good morning')
  })
})

describe('initials', () => {
  it('takes the first letter of one name', () => {
    expect(initials('Soso')).toBe('S')
  })

  it('takes two letters from two names', () => {
    expect(initials('Maya Khan')).toBe('MK')
  })

  it('stops at two even with more names', () => {
    expect(initials('Ada Byron Lovelace')).toBe('AB')
  })

  it('is empty when there is no name', () => {
    expect(initials(undefined)).toBe('')
    expect(initials('   ')).toBe('')
  })
})
