import type { WeekStart } from '../db/schema'

/** "Saturday 29 August" — the date line at the top of Today. */
export function formatLongDate(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(y, m - 1, d))
}

/** "25 Aug" — the narrow date column in a history list. */
export function formatShortDate(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
    new Date(y, m - 1, d),
  )
}

/**
 * How a past date reads in a sentence: "today", "yesterday", the weekday inside
 * the last week, and the plain date beyond that. It states when, and nothing
 * about whether that was long enough ago.
 */
export function formatRelativeDay(localDate: string, today: string): string {
  if (localDate === today) return 'today'
  const [y, m, d] = localDate.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  const days = Math.round(
    (new Date(ty, tm - 1, td).getTime() - new Date(y, m - 1, d).getTime()) / 86_400_000,
  )
  if (days === 1) return 'yesterday'
  if (days > 1 && days < 7) {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(new Date(y, m - 1, d))
  }
  return formatShortDate(localDate)
}

/**
 * Time-of-day greeting. States the time of day and the name; it does not
 * cheer, congratulate, or comment on the record.
 */
export function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Up to two initials for the profile button. Empty when there is no name. */
export function initials(name: string | undefined): string {
  if (!name) return ''
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Column headings for a week, ordered to match the device's week start. Shared
 * by Today's week strip and the calendar grid so the two never disagree.
 */
export const WEEKDAY_INITIALS: Record<WeekStart, readonly string[]> = {
  monday: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  sunday: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
}
