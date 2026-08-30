import type { WeekStart } from '../db/schema'

/** Device-local calendar date as 'YYYY-MM-DD'. Local midnight is the day boundary — no early-morning special case. */
export function todayLocalDate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(localDate: string, delta: number): string {
  const [y, m, d] = localDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + delta)
  return todayLocalDate(date)
}

/**
 * First day of the calendar week containing localDate. Defaults to Monday,
 * which is what every stored Settings row holds until the user changes it —
 * callers with a Settings object in hand should pass its `weekStart` through.
 */
export function startOfWeek(localDate: string, weekStart: WeekStart = 'monday'): string {
  const [y, m, d] = localDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  // getDay(): Sun=0 .. Sat=6.
  const offset = weekStart === 'monday' ? (date.getDay() + 6) % 7 : date.getDay()
  date.setDate(date.getDate() - offset)
  return todayLocalDate(date)
}
