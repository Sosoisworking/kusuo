import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { allHabitEvents, appendHabitEvent } from '../db/events'
import { listActiveHabits } from '../db/habits'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import type { Habit, HabitEvent, Settings } from '../db/schema'
import { todayLocalDate } from '../lib/date'
import { completedDatesForHabit } from '../logic/derive'
import { dailyStreak, weeklyStreak } from '../logic/streaks'

function streakFor(habit: Habit, completedDates: Set<string>, today: string): number {
  return habit.frequencyType === 'daily'
    ? dailyStreak(completedDates, today)
    : weeklyStreak(completedDates, habit.frequencyValue, today)
}

function streakLabel(habit: Habit, streak: number): string | null {
  if (streak === 0) return null
  return habit.frequencyType === 'daily' ? `${streak}-day streak` : `${streak}-week streak`
}

interface HabitRowProps {
  habit: Habit
  isDone: boolean
  streak: number
  onToggle: () => void
  onEdit: () => void
  readOnly: boolean
}

function HabitRow({ habit, isDone, streak, onToggle, onEdit, readOnly }: HabitRowProps) {
  const label = streakLabel(habit, streak)
  const content = (
    <>
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border"
        style={{
          borderColor: isDone ? 'var(--color-complete)' : 'var(--color-border)',
          background: isDone ? 'var(--color-complete)' : 'transparent',
        }}
        aria-hidden="true"
      >
        {isDone && (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="var(--color-bg)" strokeWidth={2}>
            <path d="M3 8.5L6.5 12L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="flex flex-1 flex-col text-left">
        <span className="text-base font-medium text-[var(--color-text-primary)]">{habit.name}</span>
        {label && <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>}
      </span>
    </>
  )

  if (readOnly) {
    return (
      <div className="flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 opacity-75">
        {content}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggle}
        aria-pressed={isDone}
        className="flex min-h-11 flex-1 items-center gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-left transition-transform duration-100 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        style={{ borderColor: isDone ? 'var(--color-complete)' : 'var(--color-border)' }}
      >
        {content}
      </button>
      <button
        onClick={onEdit}
        aria-label={`Edit ${habit.name}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <path
            d="M13.5 3.5l3 3L6 17H3v-3L13.5 3.5z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}

export default function Today() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings | undefined>()
  const [habits, setHabits] = useState<Habit[]>([])
  const [events, setEvents] = useState<HabitEvent[]>([])
  const [today, setToday] = useState(todayLocalDate)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    load().then(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function refreshToday() {
      const now = todayLocalDate()
      setToday((prev) => (prev === now ? prev : now))
    }
    document.addEventListener('visibilitychange', refreshToday)
    window.addEventListener('focus', refreshToday)
    return () => {
      document.removeEventListener('visibilitychange', refreshToday)
      window.removeEventListener('focus', refreshToday)
    }
  }, [])

  async function load() {
    const deviceId = getOrCreateDeviceId()
    const [s, h, e] = await Promise.all([getSettings(deviceId), listActiveHabits(), allHabitEvents()])
    setSettings(s)
    setHabits(h)
    setEvents(e)
  }

  async function toggle(habit: Habit, isDone: boolean) {
    if (!settings || settings.deviceRole !== 'writer') return
    setError(null)
    try {
      await appendHabitEvent(habit.id, today, isDone ? 'uncomplete' : 'complete', settings.deviceId)
      const fresh = await allHabitEvents()
      setEvents(fresh)
    } catch {
      setError("Couldn't save that — give it another tap.")
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6">
        <div className="h-6 w-32 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface)]" />
        <div className="h-4 w-24 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface)]" />
      </main>
    )
  }
  if (!settings || !settings.onboardingComplete) return <Navigate to="/onboarding" replace />

  const isReader = settings.deviceRole === 'reader'
  const rows = habits.map((habit) => {
    const completedDates = completedDatesForHabit(events, habit.id)
    return { habit, isDone: completedDates.has(today), streak: streakFor(habit, completedDates, today) }
  })
  const doneCount = rows.filter((r) => r.isDone).length

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-6 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">
          {settings.userName ? `Hi, ${settings.userName}` : 'Kusuo'}
        </h1>
        {habits.length > 0 && (
          <p className="text-sm text-[var(--color-text-secondary)]">
            {doneCount} of {habits.length} done today
          </p>
        )}
        {isReader && (
          <p className="text-xs text-[var(--color-text-secondary)]">Viewing only — log on your iPhone.</p>
        )}
        {error && (
          <p role="alert" className="text-xs text-[var(--color-text-secondary)]">
            {error}
          </p>
        )}
      </header>

      {habits.length === 0 ? (
        <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-4 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">No habits yet.</p>
          {!isReader && (
            <button
              onClick={() => navigate('/habits/new')}
              className="min-h-11 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-base font-medium text-[var(--color-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            >
              Add your first habit
            </button>
          )}
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-xs flex-col gap-3">
          {rows.map(({ habit, isDone, streak }) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              isDone={isDone}
              streak={streak}
              readOnly={isReader}
              onToggle={() => toggle(habit, isDone)}
              onEdit={() => navigate(`/habits/${habit.id}/edit`)}
            />
          ))}
          {!isReader && (
            <button
              onClick={() => navigate('/habits/new')}
              className="min-h-11 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            >
              + Add habit
            </button>
          )}
        </div>
      )}
    </main>
  )
}
