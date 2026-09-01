import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { allHabitEvents, appendHabitEvent } from '../db/events'
import { listActiveHabits } from '../db/habits'
import type { Habit, HabitEvent, Settings, Split, SplitDay } from '../db/schema'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import { getActiveSplit } from '../db/splits'
import ProfileMenu from '../components/ProfileMenu'
import { WEEKDAY_INITIALS, formatLongDate, greeting } from '../lib/format'
import { todayLocalDate } from '../lib/date'
import { completedDatesForHabit } from '../logic/derive'
import { dayForDate, plannedSetCount } from '../logic/nextSession'
import { countInWeekOf, completionsByDate, weekDays } from '../logic/week'
import { dailyStreak } from '../logic/streaks'

interface Row {
  habit: Habit
  isDone: boolean
  subtitle: string | null
}

/**
 * The line under a habit's name. Daily habits show the run they are on, N-per-week
 * habits show progress against this week's target, and the training habit says
 * which session is next instead — a plain fact in each case, never a nudge.
 */
function subtitleFor(
  habit: Habit,
  completedDates: Set<string>,
  today: string,
  weekStart: Settings['weekStart'],
  trainingDay: SplitDay | undefined,
  isTrainingHabit: boolean,
): string | null {
  if (isTrainingHabit && trainingDay) return `Up next · ${trainingDay.label}`
  if (habit.frequencyType === 'daily') {
    const streak = dailyStreak(completedDates, today)
    return streak > 0 ? `${streak}d` : null
  }
  const done = countInWeekOf(completedDates, today, weekStart)
  return `${done} of ${habit.frequencyValue} this week`
}

/**
 * Three states, one control. Nocturne carries no green, so completion is not a
 * different hue — it is the accent arriving: a dim accent fill, a hairline
 * accent ring, and a bright accent tick. An untouched habit gets a neutral
 * ring, and the next thing to do gets the accent ring with no fill.
 */
function CheckMark({ isDone, isNext }: { isDone: boolean; isNext: boolean }) {
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
      style={{
        background: isDone ? 'var(--color-complete-fill)' : 'transparent',
        boxShadow: `inset 0 0 0 1px ${
          isDone || isNext ? 'var(--color-complete-ring)' : 'var(--color-incomplete-ring)'
        }`,
      }}
      aria-hidden="true"
    >
      {isDone && (
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="var(--color-complete-mark)"
          strokeWidth={2}
        >
          <path d="M3 8.5L6.5 12L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}

function HabitRow({
  row,
  readOnly,
  isNext,
  onToggle,
  onOpen,
}: {
  row: Row
  readOnly: boolean
  isNext: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  const { habit, isDone, subtitle } = row
  const body = (
    <>
      <CheckMark isDone={isDone} isNext={isNext} />
      <span className="flex flex-1 flex-col text-left">
        <span
          className="text-base font-medium"
          style={{
            color: isDone ? 'var(--color-text-done)' : 'var(--color-text-primary)',
            textDecoration: isDone ? 'line-through' : 'none',
          }}
        >
          {habit.name}
        </span>
        {subtitle && <span className="text-xs text-[var(--color-text-secondary)]">{subtitle}</span>}
      </span>
    </>
  )

  const rule = { borderBottom: '1px solid var(--color-divider)' }

  if (readOnly) {
    return (
      <div className="flex min-h-11 items-center gap-3 py-2" style={rule}>
        {body}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2" style={rule}>
      <button
        onClick={onToggle}
        aria-pressed={isDone}
        className="flex min-h-11 flex-1 items-center gap-3 py-2 text-left transition-transform duration-100 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      >
        {body}
      </button>
      <button
        onClick={onOpen}
        aria-label={`Edit ${habit.name}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <path d="M13.5 3.5l3 3L6 17H3v-3L13.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}

/** Bottom-of-Today card standing in for a screen that used to have a tab. */
function FoldedCard({ to, title, summary }: { to: string; title: string; summary: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
    >
      <span className="flex flex-col">
        <span className="text-base text-[var(--color-text-primary)]">{title}</span>
        <span className="text-xs text-[var(--color-text-secondary)]">{summary}</span>
      </span>
      <span aria-hidden="true" className="text-[var(--color-text-secondary)]">
        ›
      </span>
    </Link>
  )
}

export default function Today() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings | undefined>()
  const [habits, setHabits] = useState<Habit[]>([])
  const [events, setEvents] = useState<HabitEvent[]>([])
  const [split, setSplit] = useState<Split | undefined>()
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
    const [s, h, e, sp] = await Promise.all([
      getSettings(deviceId),
      listActiveHabits(),
      allHabitEvents(),
      getActiveSplit(),
    ])
    setSettings(s)
    setHabits(h)
    setEvents(e)
    setSplit(sp)
  }

  async function toggle(habit: Habit, isDone: boolean) {
    if (!settings || settings.deviceRole !== 'writer') return
    setError(null)
    try {
      await appendHabitEvent(habit.id, today, isDone ? 'uncomplete' : 'complete', settings.deviceId)
      setEvents(await allHabitEvents())
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
  const weekStart = settings.weekStart
  const trainingDay = split ? dayForDate(split, today, weekStart) : undefined

  const rows: Row[] = habits.map((habit) => {
    const completedDates = completedDatesForHabit(events, habit.id)
    return {
      habit,
      isDone: completedDates.has(today),
      subtitle: subtitleFor(
        habit,
        completedDates,
        today,
        weekStart,
        trainingDay,
        habit.id === settings.trainingHabitId,
      ),
    }
  })
  const doneCount = rows.filter((r) => r.isDone).length
  const remaining = rows.length - doneCount
  // The accent ring marks the habit with a session waiting — the same row that
  // reads "Up next · Push". One signal, not two competing ones.
  const queuedHabitId = trainingDay ? settings.trainingHabitId : undefined

  const days = weekDays(today, weekStart)
  const dayCounts = completionsByDate(habits, events, days)
  const reflectionSummary = 'Open tonight’s note'
  const goalsSummary = 'Track what the habits are for'

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-5 pb-28 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-[var(--color-text-secondary)]">{formatLongDate(today)}</span>
          <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">
            {settings.userName
              ? `${greeting(new Date().getHours())}, ${settings.userName}`
              : greeting(new Date().getHours())}
          </h1>
        </div>
        <ProfileMenu name={settings.userName} />
      </header>

      {error && (
        <p role="alert" className="text-xs text-[var(--color-text-secondary)]">
          {error}
        </p>
      )}

      <section aria-label="This week" className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          const count = dayCounts.get(date) ?? 0
          const isToday = date === today
          return (
            <div
              key={date}
              className="flex flex-col items-center gap-1 rounded-[var(--radius-sm)] py-1.5"
              style={{ background: isToday ? 'var(--color-surface)' : 'transparent' }}
            >
              <span
                className="text-sm"
                style={{
                  color: count > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                }}
              >
                {count > 0 ? count : '·'}
              </span>
              <span className="text-[10px] text-[var(--color-text-secondary)]">
                {WEEKDAY_INITIALS[weekStart][index]}
              </span>
            </div>
          )
        })}
      </section>

      {trainingDay && (
        <section className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-4">
          <span className="text-xs text-[var(--color-text-secondary)]">Next up</span>
          <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
            {split?.name} · {trainingDay.label}
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {trainingDay.entries.length} exercises · {plannedSetCount(trainingDay)} sets
            {settings.trainingHabitId ? ' · logging it ticks the habit' : ''}
          </p>
          <Link
            to="/train"
            className="mt-1 flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-accent)] px-5 py-3 text-sm text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            Open the session
          </Link>
        </section>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-5">
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
        <section className="flex flex-col">
          <p className="pb-2 text-sm text-[var(--color-text-secondary)]">
            {doneCount} of {rows.length} done today
            {remaining > 0 && ` · ${remaining} left`}
          </p>
          {rows.map((row) => (
            <HabitRow
              key={row.habit.id}
              row={row}
              readOnly={isReader}
              isNext={row.habit.id === queuedHabitId}
              onToggle={() => toggle(row.habit, row.isDone)}
              onOpen={() => navigate(`/habits/${row.habit.id}/edit`)}
            />
          ))}
          {!isReader && (
            <button
              onClick={() => navigate('/habits/new')}
              className="mt-3 min-h-11 self-start text-sm text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            >
              + Add habit
            </button>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <FoldedCard to="/reflection" title="Reflect" summary={reflectionSummary} />
        <FoldedCard to="/goals" title="Goals" summary={goalsSummary} />
      </section>
    </main>
  )
}
