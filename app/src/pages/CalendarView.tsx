import { useEffect, useMemo, useState } from 'react'
import Screen from '../components/Screen'
import { allHabitEvents } from '../db/events'
import { listAllHabits } from '../db/habits'
import type { Habit, HabitEvent, SessionMark, Settings } from '../db/schema'
import { allSessionMarks } from '../db/sessions'
import { allReflections } from '../db/reflections'
import { listActiveGoals } from '../db/goals'
import type { Goal, ReflectionEntry } from '../db/schema'
import { latestReflectionForDate, reflectionSummary } from '../logic/reflection'
import { trainingDates } from '../logic/sessions'
import { formatLongDate } from '../lib/format'
import { Link } from 'react-router'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import { addMonths, monthDays, monthLabel, todayLocalDate, weekdayIndex } from '../lib/date'
import { WEEKDAY_INITIALS } from '../lib/format'
import { completionsByDate } from '../logic/week'

export default function CalendarView() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings | undefined>()
  const [habits, setHabits] = useState<Habit[]>([])
  const [events, setEvents] = useState<HabitEvent[]>([])
  const [marks, setMarks] = useState<SessionMark[]>([])
  const [reflections, setReflections] = useState<ReflectionEntry[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [cursor, setCursor] = useState(todayLocalDate)
  const [selected, setSelected] = useState<string | null>(null)
  const [goalsOpen, setGoalsOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getSettings(getOrCreateDeviceId()),
      listAllHabits(),
      allHabitEvents(),
      allSessionMarks(),
      allReflections(),
      listActiveGoals(),
    ]).then(([s, h, e, m, r, g]) => {
      if (cancelled) return
      setSettings(s)
      setHabits(h)
      setEvents(e)
      setMarks(m)
      setReflections(r)
      setGoals(g)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const weekStart = settings?.weekStart ?? 'monday'
  const days = useMemo(() => monthDays(cursor), [cursor])
  const counts = useMemo(
    () => completionsByDate(habits, events, days),
    [habits, events, days],
  )
  const trained = useMemo(() => trainingDates(marks), [marks])
  const selectedReflection = selected ? latestReflectionForDate(reflections, selected) : undefined

  if (loading) return <Screen title="Calendar">{null}</Screen>

  const today = todayLocalDate()
  const leadingBlanks = days.length > 0 ? weekdayIndex(days[0], weekStart) : 0
  const activeHabitCount = habits.filter((h) => h.isActive).length

  return (
    <Screen title="Calendar">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setCursor(addMonths(cursor, -1))}
          aria-label="Previous month"
          className="min-h-11 min-w-11 rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          ‹
        </button>
        <span className="text-sm text-[var(--color-text-primary)]">{monthLabel(cursor)}</span>
        <button
          onClick={() => setCursor(addMonths(cursor, 1))}
          aria-label="Next month"
          className="min-h-11 min-w-11 rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid" aria-label={monthLabel(cursor)}>
        {WEEKDAY_INITIALS[weekStart].map((initial, i) => (
          <span
            key={`${initial}-${i}`}
            aria-hidden="true"
            className="pb-1 text-center text-[10px] text-[var(--color-text-secondary)]"
          >
            {initial}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden="true" />
        ))}
        {days.map((date) => {
          const done = counts.get(date) ?? 0
          const didTrain = trained.has(date)
          const isToday = date === today
          return (
            <button
              key={date}
              aria-label={`${date}: ${done} of ${activeHabitCount} done${didTrain ? ', trained' : ''}`}
              aria-pressed={selected === date}
              onClick={() => setSelected((current) => (current === date ? null : date))}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] border focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              style={{
                borderColor:
                  selected === date
                    ? 'var(--color-accent)'
                    : isToday
                      ? 'var(--color-complete-ring)'
                      : 'transparent',
                background: done > 0 || selected === date ? 'var(--color-surface)' : 'transparent',
              }}
            >
              <span className="text-xs text-[var(--color-text-secondary)]">
                {Number(date.slice(8))}
              </span>
              {/* Two dots, two facts: habits done, and whether you trained. */}
              <span aria-hidden="true" className="flex h-1 items-center gap-0.5">
                {done > 0 && (
                  <span
                    className="h-1 w-1 rounded-full"
                    style={{ background: 'var(--color-complete-ring)' }}
                  />
                )}
                {didTrain && (
                  <span
                    className="h-1 w-1 rounded-full"
                    style={{ background: 'var(--color-accent-500)' }}
                  />
                )}
              </span>
            </button>
          )
        })}
      </div>

      <p className="text-xs text-[var(--color-text-secondary)]">
        A dot marks a day with at least one habit done; a second marks a day you trained.
      </p>

      {/*
        The day you pick, read back. A calendar that only counts ticks says how
        often; this says what the day was actually like.
      */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">
          {selected ? formatLongDate(selected) : 'Pick a day'}
        </h2>
        {selected === null ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Tap a day to read what you wrote and what you did.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {counts.get(selected) ?? 0} of {activeHabitCount} habits
              {trained.has(selected) ? ' · trained' : ''}
            </p>
            {selectedReflection ? (
              <p className="whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">
                {reflectionSummary(selectedReflection)}
              </p>
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Nothing written that day.
              </p>
            )}
          </div>
        )}
      </section>

      {/*
        Goals sit here permanently rather than behind a tap: they are the thing
        the habits are for, and a goal you never see is a goal you forget.
      */}
      <section className="flex flex-col">
        <button
          onClick={() => setGoalsOpen((open) => !open)}
          aria-expanded={goalsOpen}
          className="flex min-h-11 items-center justify-between gap-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          style={{ borderBottom: '1px solid var(--color-divider)' }}
        >
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            Goals
            <span className="ml-2 font-normal text-[var(--color-text-secondary)]">
              {goals.length === 0 ? 'none yet' : `${goals.length} open`}
            </span>
          </span>
          <span aria-hidden="true" className="text-[var(--color-text-secondary)]">
            {goalsOpen ? '−' : '+'}
          </span>
        </button>

        {goalsOpen && (
          <div className="flex flex-col">
            {goals.length === 0 ? (
              <p className="py-3 text-sm text-[var(--color-text-secondary)]">
                No goals yet. They are what the habits are for.
              </p>
            ) : (
              goals.map((goal) => (
                <div
                  key={goal.id}
                  className="flex flex-col gap-0.5 py-2.5"
                  style={{ borderBottom: '1px solid var(--color-divider)' }}
                >
                  <span className="text-sm text-[var(--color-text-primary)]">{goal.title}</span>
                  {goal.description && (
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {goal.description}
                    </span>
                  )}
                  {goal.targetDate && (
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      by {formatLongDate(goal.targetDate)}
                    </span>
                  )}
                </div>
              ))
            )}
            <Link
              to="/goals"
              className="mt-2 min-h-11 self-start text-sm text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            >
              Manage goals
            </Link>
          </div>
        )}
      </section>
    </Screen>
  )
}
