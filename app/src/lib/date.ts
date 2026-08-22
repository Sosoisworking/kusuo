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

/** Monday of the calendar week containing localDate. */
export function startOfWeek(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const mondayOffset = (date.getDay() + 6) % 7 // Mon=0 .. Sun=6
  date.setDate(date.getDate() - mondayOffset)
  return todayLocalDate(date)
}
