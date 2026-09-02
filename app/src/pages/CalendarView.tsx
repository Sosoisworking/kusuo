import { useEffect, useMemo, useState } from 'react'
import Screen from '../components/Screen'
import { allHabitEvents } from '../db/events'
import { listAllHabits } from '../db/habits'
import type { Habit, HabitEvent, SessionMark, Settings } from '../db/schema'
import { allSessionEvents, allSessionMarks } from '../db/sessions'
import { listExercises } from '../db/exercises'
import { formatWeight } from '../lib/units'
import { dayBreakdown, liveSets, trainingDates } from '../logic/sessions'
import { allReflections } from '../db/reflections'
import { listActiveGoals, listCompletedGoals } from '../db/goals'
import type { Exercise, Goal, ReflectionEntry, SessionEvent } from '../db/schema'
import { latestReflectionForDate, reflectionSummary } from '../logic/reflection'

import { formatLongDate } from '../lib/format'
import { Link } from 'react-router'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import { addMonths, monthDays, monthLabel, todayLocalDate, weekdayIndex } from '../lib/date'
import { WEEKDAY_INITIALS } from '../lib/format'
import { completionsByDate } from '../logic/week'

/**
 * What a chosen day is asked about. A day holds three unrelated kinds of thing
 * — what you lifted, what you wrote, and what you are working towards — and
 * stacking them made the training breakdown push the reflection off the screen.
 */
type DayTab = 'training' | 'reflection' | 'goals'

const TABS: { value: DayTab; label: string }[] = [
  { value: 'training', label: 'Training' },
  { value: 'reflection', label: 'Reflection' },
  { value: 'goals', label: 'Goals' },
]

export default function CalendarView() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings | undefined>()
  const [habits, setHabits] = useState<Habit[]>([])
  const [events, setEvents] = useState<HabitEvent[]>([])
  const [marks, setMarks] = useState<SessionMark[]>([])
  const [reflections, setReflections] = useState<ReflectionEntry[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [reachedGoals, setReachedGoals] = useState<Goal[]>([])
  const [sessionEvents, setSessionEvents] = useState<SessionEvent[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [cursor, setCursor] = useState(todayLocalDate)
  const [selected, setSelected] = useState<string | null>(null)
  const [dayTab, setDayTab] = useState<DayTab>('training')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getSettings(getOrCreateDeviceId()),
      listAllHabits(),
      allHabitEvents(),
      allSessionMarks(),
      allReflections(),
      listActiveGoals(),
      allSessionEvents(),
      listExercises(),
      listCompletedGoals(),
    ]).then(([s, h, e, m, r, g, sessions, list, reached]) => {
      if (cancelled) return
      setSettings(s)
      setHabits(h)
      setEvents(e)
      setMarks(m)
      setReflections(r)
      setGoals(g)
      setSessionEvents(sessions)
      setExercises(list)
      setReachedGoals(reached)
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
  // A day can hold training without holding a finished session: log ten sets,
  // walk out, never tap Finish. The grid owes that day a mark — the day detail
  // has always had the full breakdown — but not the one that means finished.
  const startedTraining = useMemo(
    () => new Set(liveSets(sessionEvents).map((s) => s.localDate)),
    [sessionEvents],
  )
  const selectedReflection = selected ? latestReflectionForDate(reflections, selected) : undefined
  const units = settings?.units ?? 'kg'
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const daySets = selected ? dayBreakdown(sessionEvents, selected) : []
  const dayVolume = daySets.reduce((total, row) => total + row.volumeKg, 0)
  const setCount = daySets.reduce((total, row) => total + row.sets.length, 0)
  const reachedThatDay = selected
    ? reachedGoals.filter((g) => g.completedAt && todayLocalDate(new Date(g.completedAt)) === selected)
    : []
  const dueThatDay = selected ? goals.filter((g) => g.targetDate === selected) : []

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

      {/*
        Square cells mean the grid's width sets its height, so turned sideways a
        month that fitted one screen became 596pt tall in a 390pt viewport —
        one and a half weeks visible, and the 28th two screens away. Capping the
        width against the viewport's height keeps the whole month on the screen
        in either orientation, which is the only thing this grid is for.
      */}
      <div
        className="grid w-full grid-cols-7 gap-1 self-center"
        style={{ maxWidth: 'min(26rem, 70dvh)' }}
        role="grid"
        aria-label={monthLabel(cursor)}
      >
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
          const unfinished = !didTrain && startedTraining.has(date)
          const isToday = date === today
          return (
            <button
              key={date}
              aria-label={`${date}: ${done} of ${activeHabitCount} done${
                didTrain ? ', trained' : unfinished ? ', sets logged, session not finished' : ''
              }`}
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
              {/* Two dots, two facts: habits done, and whether you trained.
                  The training dot is filled for a finished session and an
                  outline for one left open — the same fill-versus-ring the
                  habit tick uses for done versus waiting. Both dots are 6px,
                  because a 1px ring inside 4px is not a ring. */}
              <span aria-hidden="true" className="flex h-1.5 items-center gap-0.5">
                {done > 0 && (
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: 'var(--color-complete-ring)' }}
                  />
                )}
                {(didTrain || unfinished) && (
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: didTrain ? 'var(--color-accent-500)' : 'transparent',
                      boxShadow: didTrain ? undefined : 'inset 0 0 0 1px var(--color-accent-500)',
                    }}
                  />
                )}
              </span>
            </button>
          )
        })}
      </div>

      <p className="text-xs text-[var(--color-text-secondary)]">
        A dot marks a day with at least one habit done; a second marks a day you trained. An
        outlined second dot is a day with sets logged and no finished session.
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
            <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--color-text-secondary)]">
              <div className="flex gap-1.5">
                <dt>Habits</dt>
                <dd className="text-[var(--color-text-primary)]">
                  {counts.get(selected) ?? 0} of {activeHabitCount}
                </dd>
              </div>
              {daySets.length > 0 && (
                <>
                  <div className="flex gap-1.5">
                    <dt>Volume</dt>
                    <dd className="text-[var(--color-text-primary)]">
                      {formatWeight(dayVolume, units)}
                    </dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>Sets</dt>
                    <dd className="text-[var(--color-text-primary)]">{setCount}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>Exercises</dt>
                    <dd className="text-[var(--color-text-primary)]">{daySets.length}</dd>
                  </div>
                </>
              )}
            </dl>

            {/* One day, three questions. The tabs keep each answer whole
                instead of making the reflection queue behind a long session. */}
            <div role="tablist" aria-label="What this day holds" className="flex gap-2 pt-1">
              {TABS.map((tab) => {
                const chosen = dayTab === tab.value
                return (
                  <button
                    key={tab.value}
                    role="tab"
                    id={`day-tab-${tab.value}`}
                    aria-selected={chosen}
                    aria-controls="day-panel"
                    // Only the chosen tab is in the tab order; the arrows move
                    // between them. Half of this pattern is worse than none —
                    // a screen reader announcing "tab, selected" over content
                    // it has no stated relationship to.
                    tabIndex={chosen ? 0 : -1}
                    onKeyDown={(event) => {
                      const delta =
                        event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
                      if (delta === 0) return
                      event.preventDefault()
                      const at = TABS.findIndex((t) => t.value === dayTab)
                      const next = TABS[(at + delta + TABS.length) % TABS.length]
                      setDayTab(next.value)
                      document.getElementById(`day-tab-${next.value}`)?.focus()
                    }}
                    onClick={() => setDayTab(tab.value)}
                    className="flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-md)] px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                    style={{
                      color: chosen ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                      boxShadow: `inset 0 0 0 1px ${chosen ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      background: chosen ? 'var(--color-surface)' : 'transparent',
                    }}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            <div id="day-panel" role="tabpanel" aria-labelledby={`day-tab-${dayTab}`} className="flex flex-col">
            {dayTab === 'training' &&
              (daySets.length > 0 ? (
                <section className="flex flex-col">
                  {daySets.map((row) => (
                    <div
                      key={row.exerciseId}
                      className="flex flex-col gap-0.5 py-2"
                      style={{ borderBottom: '1px solid var(--color-divider)' }}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm text-[var(--color-text-primary)]">
                          {byId.get(row.exerciseId)?.name ?? 'Unknown movement'}
                        </span>
                        {row.volumeKg > 0 && (
                          <span className="text-xs text-[var(--color-text-secondary)]">
                            {formatWeight(row.volumeKg, units)}
                          </span>
                        )}
                      </div>
                      {/* Every number on this screen carries its unit: the
                          summary above says 880kg, so a set line saying
                          "60 × 10" leaves you to guess which 60 it meant. */}
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {row.sets
                          .map((s) =>
                            s.durationSec
                              ? `${Math.round(s.durationSec / 60)} min`
                              : `${formatWeight(s.weightKg, units)} × ${s.reps}`,
                          )
                          .join(' · ')}
                      </span>
                    </div>
                  ))}
                </section>
              ) : (
                <p className="py-2 text-sm text-[var(--color-text-secondary)]">
                  No sets logged that day.
                </p>
              ))}

            {dayTab === 'reflection' &&
              (selectedReflection ? (
                <p className="whitespace-pre-wrap py-2 text-sm text-[var(--color-text-primary)]">
                  {reflectionSummary(selectedReflection)}
                </p>
              ) : (
                <div className="flex flex-col items-start gap-2 py-2">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Nothing written that day.
                  </p>
                  {/* Only today's note can still be written: a reflection is
                      dated by the day it belongs to, not the day it is typed. */}
                  {selected === today && (
                    <Link
                      to="/reflection"
                      className="min-h-11 text-sm text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                    >
                      Write tonight's note
                    </Link>
                  )}
                </div>
              ))}

            {dayTab === 'goals' && (
              <div className="flex flex-col">
                {/*
                  A goal is not a diary entry, so most days have nothing of their
                  own to show. What a day can honestly say is which goals were
                  reached on it and which were due, and then what is still open.
                */}
                {reachedThatDay.length > 0 && (
                  <p className="py-2 text-sm text-[var(--color-text-primary)]">
                    Reached: {reachedThatDay.map((g) => g.title).join(', ')}
                  </p>
                )}
                {dueThatDay.length > 0 && (
                  <p className="py-2 text-sm text-[var(--color-text-primary)]">
                    Due: {dueThatDay.map((g) => g.title).join(', ')}
                  </p>
                )}
                {goals.length === 0 ? (
                  <p className="py-2 text-sm text-[var(--color-text-secondary)]">
                    No goals open. They are what the habits are for.
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
            </div>
          </div>
        )}
      </section>

    </Screen>
  )
}
