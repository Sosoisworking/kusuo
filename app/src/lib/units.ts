import type { Units } from '../db/schema'

const LB_PER_KG = 2.2046226218

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG
}

/** Converts a stored (always-kg) weight into the unit the user reads in. */
export function fromKg(kg: number, units: Units): number {
  return units === 'kg' ? kg : kgToLb(kg)
}

/** Converts a weight the user typed back into the kg that gets stored. */
export function toKg(value: number, units: Units): number {
  return units === 'kg' ? value : lbToKg(value)
}

/**
 * Display string for a weight. Trailing zeros are dropped so 60kg reads "60",
 * not "60.0", while 2.5kg plate maths still survives.
 */
export function formatWeight(kg: number, units: Units): string {
  const value = fromKg(kg, units)
  const rounded = Math.round(value * 10) / 10
  return `${rounded}${units}`
}
