import { describe, expect, it } from 'vitest'
import { formatWeight, fromKg, toKg } from './units'

describe('unit conversion', () => {
  it('leaves kg alone in both directions', () => {
    expect(fromKg(100, 'kg')).toBe(100)
    expect(toKg(100, 'kg')).toBe(100)
  })

  it('converts kg to lb', () => {
    expect(fromKg(100, 'lb')).toBeCloseTo(220.462, 3)
  })

  it('round-trips a typed lb weight back to the same lb weight', () => {
    const typed = 225
    expect(fromKg(toKg(typed, 'lb'), 'lb')).toBeCloseTo(typed, 9)
  })
})

describe('formatWeight', () => {
  it('drops trailing zeros on a whole number', () => {
    expect(formatWeight(60, 'kg')).toBe('60kg')
  })

  it('keeps a half-plate increment', () => {
    expect(formatWeight(62.5, 'kg')).toBe('62.5kg')
  })

  it('rounds the converted value to one decimal', () => {
    expect(formatWeight(100, 'lb')).toBe('220.5lb')
  })
})
