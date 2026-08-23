import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { PrimaryButton, SecondaryButton } from '../components/Button'
import { eventsForHabit } from '../db/events'
import { getHabit } from '../db/habits'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import type { Habit, HabitEvent, Settings } from '../db/schema'
import { todayLocalDate } from '../lib/date'
import { completedDatesForHabit } from '../logic/derive'
import { dailyStreak, weeklyStreak } from '../logic/streaks'

interface MonthCursor {
  year: number
  month: number // 1-indexed
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function localDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** Monday-start 6-week grid; leading/trailing cells outside the month are null. */
function monthGrid(year: number, month: number): (string | null)[] {
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const total = daysInMonth(year, month)
  const cells: (string | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push(localDate(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function shiftMonth(cursor: MonthCursor, delta: number): MonthCursor {
  let month = cursor.month + delta
  let year = cursor.year
  if (month < 1) {
    month = 12
    year -= 1
  } else if (month > 12) {
    month = 1
    year += 1
  }
  return { year, month }
}

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function HabitDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings | undefined>()
  const [habit, setHabit] = useState<Habit | undefined>()
  const [events, setEvents] = useState<HabitEvent[]>([])
  const [notFound, setNotFound] = useState(false)
  const [cursor, setCursor] = useState<MonthCursor>(() => {
    const [year, month] = todayLocalDate().split('-').map(Number)
    return { year, month }
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      const deviceId = getOrCreateDeviceId()
      const s = await getSettings(deviceId)
      if (cancelled) return
      setSettings(s)
      if (!id) {
        setNotFound(true)
        setLoading(false)
        return
      }
      const h = await getHabit(id)
      if (cancelled) return
      if (!h) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setHabit(h)
      const e = await eventsForHabit(id)
      if (cancelled) return
      setEvents(e)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 pb-28">
        <div className="h-6 w-32 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface)]" />
        <div className="h-4 w-24 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface)]" />
      </main>
    )
  }
  if (!settings || !settings.onboardingComplete) return <Navigate to="/onboarding" replace />
  if (notFound || !habit) return <Navigate to="/" replace />

  const todayStr = todayLocalDate()
  const completedDates = completedDatesForHabit(events, habit.id)
  const streak =
    habit.frequencyType === 'daily'
      ? dailyStreak(completedDates, todayStr)
      : weeklyStreak(completedDates, habit.frequencyValue, todayStr)
  const streakText =
    streak === 0 ? null : habit.frequencyType === 'daily' ? `${streak}-day streak` : `${streak}-week streak`
  const frequencyText = habit.frequencyType === 'daily' ? 'Daily' : `${habit.frequencyValue}×/week`

  const [todayYear, todayMonth] = todayStr.split('-').map(Number)
  const isCurrentMonth = cursor.year === todayYear && cursor.month === todayMonth
  const grid = monthGrid(cursor.year, cursor.month)

  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 px-6 pb-28 pt-[max(3rem,env(safe-area-inset-top))] text-center">
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="flex h-11 w-11 shrink-0 items-center justify-center self-start rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M12.5 4.5L6 11l6.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">{habit.name}</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">{frequencyText}</p>
        {habit.category && <p className="text-sm text-[var(--color-text-secondary)]">{habit.category}</p>}
      </div>

      <div className="flex w-full max-w-xs gap-3">
        <div className="flex flex-1 flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-left">
          <span className="text-xs text-[var(--color-text-secondary)]">Streak</span>
          <span className="text-lg font-medium text-[var(--color-text-primary)]">{streakText ?? '—'}</span>
        </div>
        <div className="flex flex-1 flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-left">
          <span className="text-xs text-[var(--color-text-secondary)]">Total</span>
          <span className="text-lg font-medium text-[var(--color-text-primary)]">{completedDates.size} done</span>
        </div>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setCursor((c) => shiftMonth(c, -1))}
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            ‹
          </button>
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {monthLabel(cursor.year, cursor.month)}
          </span>
          <button
            type="button"
            aria-label="Next month"
            disabled={isCurrentMonth}
            onClick={() => setCursor((c) => shiftMonth(c, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_LABELS.map((label, i) => (
            <span key={i} className="text-xs text-[var(--color-text-secondary)]" aria-hidden="true">
              {label}
            </span>
          ))}
          {grid.map((date, i) => {
            const done = date ? completedDates.has(date) : false
            const isToday = date === todayStr
            return (
              <div
                key={i}
                title={date ?? undefined}
                className="flex aspect-square items-center justify-center rounded-[var(--radius-sm)] text-xs"
                style={{
                  background: done ? 'var(--color-complete)' : date ? 'var(--color-surface)' : 'transparent',
                  color: done ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                  boxShadow: isToday ? 'inset 0 0 0 1px var(--color-accent)' : undefined,
                }}
              >
                {date ? Number(date.slice(-2)) : ''}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <PrimaryButton onClick={() => navigate(`/habits/${habit.id}/edit`)}>Edit habit</PrimaryButton>
        <SecondaryButton onClick={() => navigate('/progress')}>Back to Progress</SecondaryButton>
      </div>
    </main>
  )
}
