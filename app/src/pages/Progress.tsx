import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { allHabitEvents } from '../db/events'
import { listActiveHabits } from '../db/habits'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import type { Habit, HabitEvent, Settings } from '../db/schema'
import { addDays, todayLocalDate } from '../lib/date'
import { completedDatesForHabit } from '../logic/derive'
import { dailyStreak, weeklyStreak } from '../logic/streaks'

const RECENT_DAYS = 7

function streakFor(habit: Habit, completedDates: Set<string>, today: string): number {
  return habit.frequencyType === 'daily'
    ? dailyStreak(completedDates, today)
    : weeklyStreak(completedDates, habit.frequencyValue, today)
}

function streakLabel(habit: Habit, streak: number): string | null {
  if (streak === 0) return null
  return habit.frequencyType === 'daily' ? `${streak}-day streak` : `${streak}-week streak`
}

interface ProgressRowProps {
  habit: Habit
  streak: number
  recentDates: string[]
  completedDates: Set<string>
  onOpen: () => void
}

function ProgressRow({ habit, streak, recentDates, completedDates, onOpen }: ProgressRowProps) {
  const label = streakLabel(habit, streak)
  const doneCount = recentDates.filter((d) => completedDates.has(d)).length

  return (
    <button
      onClick={onOpen}
      className="flex min-h-11 flex-col gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-base font-medium text-[var(--color-text-primary)]">{habit.name}</span>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {label ?? `${doneCount}/${RECENT_DAYS} this week`}
        </span>
      </div>
      <div className="flex gap-1.5" aria-hidden="true">
        {recentDates.map((d) => (
          <span
            key={d}
            className="h-2 w-2 rounded-full"
            style={{
              background: completedDates.has(d) ? 'var(--color-complete)' : 'var(--color-surface)',
              border: `1px solid ${completedDates.has(d) ? 'var(--color-complete)' : 'var(--color-border)'}`,
            }}
          />
        ))}
      </div>
      <span className="sr-only">
        {doneCount} of {RECENT_DAYS} recent days completed
      </span>
    </button>
  )
}

export default function Progress() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings | undefined>()
  const [habits, setHabits] = useState<Habit[]>([])
  const [events, setEvents] = useState<HabitEvent[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const deviceId = getOrCreateDeviceId()
      const [s, h, e] = await Promise.all([getSettings(deviceId), listActiveHabits(), allHabitEvents()])
      if (cancelled) return
      setSettings(s)
      setHabits(h)
      setEvents(e)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6">
        <div className="h-6 w-32 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface)]" />
        <div className="h-4 w-24 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface)]" />
      </main>
    )
  }
  if (!settings || !settings.onboardingComplete) return <Navigate to="/onboarding" replace />

  const today = todayLocalDate()
  const recentDates = Array.from({ length: RECENT_DAYS }, (_, i) => addDays(today, i - (RECENT_DAYS - 1)))

  const rows = habits.map((habit) => {
    const completedDates = completedDatesForHabit(events, habit.id)
    return { habit, streak: streakFor(habit, completedDates, today), completedDates }
  })

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-6 pb-28 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">Progress</h1>
        {habits.length > 0 && (
          <p className="text-sm text-[var(--color-text-secondary)]">How your habits are holding up</p>
        )}
      </header>

      {habits.length === 0 ? (
        <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-2 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">No habits yet — add one from Today.</p>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-xs flex-col gap-3">
          {rows.map(({ habit, streak, completedDates }) => (
            <ProgressRow
              key={habit.id}
              habit={habit}
              streak={streak}
              recentDates={recentDates}
              completedDates={completedDates}
              onOpen={() => navigate(`/habits/${habit.id}`)}
            />
          ))}
        </div>
      )}
    </main>
  )
}
