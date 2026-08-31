import { useEffect, useState } from 'react'
import Screen, { EmptyState } from '../components/Screen'
import { allHabitEvents } from '../db/events'
import { listCompletedGoals } from '../db/goals'
import { listAllHabits } from '../db/habits'
import { allReflections } from '../db/reflections'
import type { Goal, Habit, HabitEvent, ReflectionEntry, Settings } from '../db/schema'
import { formatLongDate } from '../lib/format'
import { latestReflectionsByDate, reflectionSummary } from '../logic/reflection'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import { monthLabel, todayLocalDate } from '../lib/date'

import { completedDatesForHabit } from '../logic/derive'
import { bestMonth, bestStreak } from '../logic/records'

/** A completion instant, as the calendar day it happened on. */
function todayLocalDateOf(timestamp: number | undefined): string {
  return todayLocalDate(timestamp === undefined ? new Date() : new Date(timestamp))
}

interface HabitBests {
  habit: Habit
  totalDone: number
  best: number
  month: { month: string; count: number } | undefined
}

export default function Records() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings | undefined>()
  const [rows, setRows] = useState<HabitBests[]>([])
  const [reached, setReached] = useState<Goal[]>([])
  const [reflections, setReflections] = useState<ReflectionEntry[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getSettings(getOrCreateDeviceId()),
      listAllHabits(),
      allHabitEvents(),
      listCompletedGoals(),
      allReflections(),
    ]).then(
      ([s, habits, events, goals, entries]: [
        Settings | undefined,
        Habit[],
        HabitEvent[],
        Goal[],
        ReflectionEntry[],
      ]) => {
        if (cancelled) return
        setSettings(s)
        setReached(goals)
        setReflections(entries)
        setRows(
          habits.map((habit) => {
            const completed = completedDatesForHabit(events, habit.id)
            return {
              habit,
              totalDone: completed.size,
              best: bestStreak(completed),
              month: bestMonth(completed),
            }
          }),
        )
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <Screen title="Records">{null}</Screen>

  const withHistory = rows.filter((r) => r.totalDone > 0)
  const reflectionDays = [...latestReflectionsByDate(reflections).entries()].sort((a, b) =>
    b[0].localeCompare(a[0]),
  )

  return (
    <Screen title="Records" eyebrow={settings?.units === 'lb' ? 'Weights in lb' : undefined}>
      {withHistory.length === 0 ? (
        <EmptyState>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Nothing to show yet. Records appear once a habit has been ticked off.
          </p>
        </EmptyState>
      ) : (
        <section className="flex flex-col gap-3">
          {withHistory.map(({ habit, totalDone, best, month }) => (
            <div
              key={habit.id}
              className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3"
            >
              <span className="text-base text-[var(--color-text-primary)]">{habit.name}</span>
              <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                <div className="flex gap-1.5">
                  <dt>Best run</dt>
                  <dd className="text-[var(--color-text-primary)]">
                    {best} {best === 1 ? 'day' : 'days'}
                  </dd>
                </div>
                <div className="flex gap-1.5">
                  <dt>Days done</dt>
                  <dd className="text-[var(--color-text-primary)]">{totalDone}</dd>
                </div>
                {month && (
                  <div className="flex gap-1.5">
                    <dt>Best month</dt>
                    <dd className="text-[var(--color-text-primary)]">
                      {monthLabel(`${month.month}-01`)} · {month.count}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          ))}
        </section>
      )}

      {/* A goal you reached is a record, so it belongs here rather than
          disappearing off the goals list. A goal you abandoned does not. */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">Goals reached</h2>
        {reached.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            None yet. A goal marked reached shows up here.
          </p>
        ) : (
          <ul className="flex flex-col">
            {reached.map((goal) => (
              <li
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
                <span className="text-xs text-[var(--color-text-secondary)]">
                  reached {formatLongDate(todayLocalDateOf(goal.completedAt))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">Reflections</h2>
        {reflectionDays.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Nothing written yet. What you write on a day shows up here and on that day in the
            calendar.
          </p>
        ) : (
          <ul className="flex flex-col">
            {reflectionDays.map(([date, entry]) => (
              <li
                key={date}
                className="flex flex-col gap-0.5 py-2.5"
                style={{ borderBottom: '1px solid var(--color-divider)' }}
              >
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {formatLongDate(date)}
                </span>
                <span className="whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">
                  {reflectionSummary(entry)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-[var(--color-text-secondary)]">
        Every figure here is counted from your history, not stored.
      </p>
    </Screen>
  )
}
