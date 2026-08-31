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

/** First day of the calendar month containing localDate. */
export function startOfMonth(localDate: string): string {
  return `${localDate.slice(0, 7)}-01`
}

/** Shifts by whole months, clamping to the first of the month. */
export function addMonths(localDate: string, delta: number): string {
  const [y, m] = localDate.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return todayLocalDate(date)
}

export function daysInMonth(localDate: string): number {
  const [y, m] = localDate.split('-').map(Number)
  // Day 0 of the next month is the last day of this one.
  return new Date(y, m, 0).getDate()
}

/** Every localDate in the month containing localDate, in order. */
export function monthDays(localDate: string): string[] {
  const first = startOfMonth(localDate)
  return Array.from({ length: daysInMonth(localDate) }, (_, i) => addDays(first, i))
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function monthLabel(localDate: string): string {
  const [y, m] = localDate.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

/** Weekday index of a localDate under the given week start: 0 is the first column. */
export function weekdayIndex(localDate: string, weekStart: WeekStart = 'monday'): number {
  const [y, m, d] = localDate.split('-').map(Number)
  const day = new Date(y, m - 1, d).getDay() // Sun=0
  return weekStart === 'monday' ? (day + 6) % 7 : day
}
