import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { allHabitEvents, appendHabitEvent } from '../db/events'
import { listActiveHabits } from '../db/habits'
import type { Habit, HabitEvent, SessionEvent, SessionMark, Settings, Split } from '../db/schema'
import { allSessionEvents, allSessionMarks } from '../db/sessions'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import { getActiveSplit } from '../db/splits'
import ProfileMenu from '../components/ProfileMenu'
import { WEEKDAY_INITIALS, formatLongDate, formatShortDate, greeting } from '../lib/format'
import { todayLocalDate } from '../lib/date'
import { completedDatesForHabit } from '../logic/derive'
import { dayForDate, plannedSetCount } from '../logic/nextSession'
import { isSessionComplete, setsOnDate } from '../logic/sessions'
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
 *
 * `trainingNote` is only passed for the training habit, and only while there is
 * genuinely a session waiting. Once the habit is ticked there is nothing up
 * next, so the row falls back to the run it is on rather than keeping a
 * promise it has already kept.
 */
function subtitleFor(
  habit: Habit,
  completedDates: Set<string>,
  today: string,
  weekStart: Settings['weekStart'],
  isDone: boolean,
  trainingNote: string | null,
): string | null {
  if (trainingNote && !isDone) return trainingNote
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
  const name = (
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
  )

  const rule = { borderBottom: '1px solid var(--color-divider)' }
  // The tick sits in its own 44pt column, flush left, so the mark keeps the
  // list's left edge while the target reaches past it.
  const tickColumn = 'flex h-11 w-11 shrink-0 items-center justify-start'

  if (readOnly) {
    return (
      <div className="flex min-h-11 items-center gap-3 py-2" style={rule}>
        <span className={tickColumn}>
          <CheckMark isDone={isDone} isNext={isNext} />
        </span>
        {name}
      </div>
    )
  }

  return (
    // Two targets, two intentions. Tapping a habit's name used to tick it, so
    // reading the list changed it; the tick is now its own control and the name
    // opens the habit. The tick stays first and full height, because the
    // morning tap is the one that has to stay fast.
    <div className="flex items-center gap-3" style={rule}>
      <button
        onClick={onToggle}
        aria-pressed={isDone}
        aria-label={habit.name}
        className={`${tickColumn} transition-transform duration-100 active:scale-[0.94] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]`}
      >
        <CheckMark isDone={isDone} isNext={isNext} />
      </button>
      <button
        onClick={onOpen}
        aria-label={`Open ${habit.name}`}
        className="flex min-h-11 flex-1 items-center py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      >
        {name}
      </button>
    </div>
  )
}

/**
 * The order the list reads in. Dexie returns habits in primary-key order and
 * the keys are UUIDs, so without this the list is shuffled — a fresh install
 * read Japanese, Fitness, Reading, which is not the order onboarding offered
 * them in. Oldest first, so a habit keeps its place for good and a new one
 * joins the end; name breaks the ties, which is every habit created in the
 * same millisecond during onboarding.
 */
function orderedHabits(habits: Habit[]): Habit[] {
  return [...habits].sort(
    (a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
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
  const [sessionEvents, setSessionEvents] = useState<SessionEvent[]>([])
  const [marks, setMarks] = useState<SessionMark[]>([])
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
    // The session log is read here for the same reason Train reads it: a
    // half-logged session is a fact about today, and Today is the screen that
    // is supposed to say what today is.
    const [s, h, e, sp, se, m] = await Promise.all([
      getSettings(deviceId),
      listActiveHabits(),
      allHabitEvents(),
      getActiveSplit(),
      allSessionEvents(),
      allSessionMarks(),
    ])
    setSettings(s)
    setHabits(h)
    setEvents(e)
    setSplit(sp)
    setSessionEvents(se)
    setMarks(m)
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

  // Today's training state, derived from the same two logs Train replays, so
  // the two screens cannot disagree about whether a session is under way.
  const isRestDay = trainingDay?.kind === 'rest'
  const plannedSets = trainingDay ? plannedSetCount(trainingDay) : 0
  const loggedSets = trainingDay
    ? setsOnDate(sessionEvents, today).filter((s) => s.splitDayId === trainingDay.id).length
    : 0
  const sessionFinished = trainingDay ? isSessionComplete(marks, today, trainingDay.id) : false
  const sessionWaiting = Boolean(trainingDay) && !isRestDay && !sessionFinished
  const trainingNote = sessionWaiting && trainingDay ? `Up next · ${trainingDay.label}` : null

  const rows: Row[] = orderedHabits(habits).map((habit) => {
    const completedDates = completedDatesForHabit(events, habit.id)
    const isDone = completedDates.has(today)
    return {
      habit,
      isDone,
      subtitle: subtitleFor(
        habit,
        completedDates,
        today,
        weekStart,
        isDone,
        habit.id === settings.trainingHabitId ? trainingNote : null,
      ),
    }
  })
  const doneCount = rows.filter((r) => r.isDone).length
  const remaining = rows.length - doneCount
  // The accent ring marks the habit with a session still waiting — the same row
  // that reads "Up next · Push". One signal, not two competing ones.
  const queuedHabitId = sessionWaiting ? settings.trainingHabitId : undefined

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
              {/* A day with nothing on it reads as a hairline, not a dot: the
                  calendar spends a dot to mean a habit was done, and the same
                  mark cannot also mean none were. */}
              <span
                aria-hidden="true"
                className="text-sm"
                style={{
                  color: count > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                }}
              >
                {count > 0 ? count : '–'}
              </span>
              <span aria-hidden="true" className="text-[10px] text-[var(--color-text-secondary)]">
                {WEEKDAY_INITIALS[weekStart][index]}
              </span>
              <span className="sr-only">
                {formatShortDate(date)}: {count} of {rows.length} done
              </span>
            </div>
          )
        })}
      </section>

      {trainingDay && (
        <section className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-4">
          <span className="text-xs text-[var(--color-text-secondary)]">
            {isRestDay ? 'Today' : sessionFinished ? 'Done today' : loggedSets > 0 ? 'In progress' : 'Next up'}
          </span>
          <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
            {split?.name} · {trainingDay.label}
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {isRestDay
              ? 'A day in the split, not a gap in it.'
              : loggedSets > 0 || sessionFinished
                ? `${loggedSets} of ${plannedSets} sets logged`
                : `${trainingDay.entries.length} exercises · ${plannedSets} sets${
                    settings.trainingHabitId ? ' · logging it ticks the habit' : ''
                  }`}
          </p>
          {/* A rest day is a day in the split, so it is worth saying — but the
              only thing to do about it is on Train, and Today does not need a
              second door to the same write. */}
          {!isRestDay && (
            <Link
              to="/train"
              className="mt-1 flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-accent)] px-5 py-3 text-sm text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            >
              {sessionFinished
                ? 'Review the session'
                : loggedSets > 0
                  ? 'Continue the session'
                  : 'Open the session'}
            </Link>
          )}
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
              isNext={row.habit.id === queuedHabitId && !row.isDone}
              onToggle={() => toggle(row.habit, row.isDone)}
              onOpen={() => navigate(`/habits/${row.habit.id}`)}
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
