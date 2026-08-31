import { useEffect, useState } from 'react'
import Screen, { EmptyState } from '../components/Screen'
import { allHabitEvents } from '../db/events'
import { listAllHabits } from '../db/habits'
import type { Habit, HabitEvent, Settings } from '../db/schema'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import { monthLabel } from '../lib/date'
import { completedDatesForHabit } from '../logic/derive'
import { bestMonth, bestStreak } from '../logic/records'

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

  useEffect(() => {
    let cancelled = false
    Promise.all([getSettings(getOrCreateDeviceId()), listAllHabits(), allHabitEvents()]).then(
      ([s, habits, events]: [Settings | undefined, Habit[], HabitEvent[]]) => {
        if (cancelled) return
        setSettings(s)
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

      <p className="text-xs text-[var(--color-text-secondary)]">
        Every figure here is counted from your history, not stored. Lift records join this view once
        session logging lands.
      </p>
    </Screen>
  )
}
