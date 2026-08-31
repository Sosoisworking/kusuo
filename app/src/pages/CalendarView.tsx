import { useEffect, useMemo, useState } from 'react'
import Screen from '../components/Screen'
import { allHabitEvents } from '../db/events'
import { listAllHabits } from '../db/habits'
import type { Habit, HabitEvent, SessionMark, Settings } from '../db/schema'
import { allSessionMarks } from '../db/sessions'
import { trainingDates } from '../logic/sessions'
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
  const [cursor, setCursor] = useState(todayLocalDate)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getSettings(getOrCreateDeviceId()),
      listAllHabits(),
      allHabitEvents(),
      allSessionMarks(),
    ]).then(([s, h, e, m]) => {
      if (cancelled) return
      setSettings(s)
      setHabits(h)
      setEvents(e)
      setMarks(m)
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
            <div
              key={date}
              role="gridcell"
              aria-label={`${date}: ${done} of ${activeHabitCount} done${didTrain ? ', trained' : ''}`}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] border"
              style={{
                borderColor: isToday ? 'var(--color-accent)' : 'transparent',
                background: done > 0 ? 'var(--color-surface)' : 'transparent',
              }}
            >
              <span className="text-xs text-[var(--color-text-secondary)]">
                {Number(date.slice(8))}
              </span>
              {done > 0 && (
                <span
                  aria-hidden="true"
                  className="h-1 w-1 rounded-full"
                  style={{ background: 'var(--color-complete-ring)' }}
                />
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-[var(--color-text-secondary)]">
        A dot marks a day with at least one habit done; a second marks a day you trained.
      </p>
    </Screen>
  )
}
