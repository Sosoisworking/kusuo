import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import Screen, { EmptyState } from '../components/Screen'
import { listExercises } from '../db/exercises'
import type { Exercise, SessionMark, Split, SplitDay } from '../db/schema'
import { allSessionMarks } from '../db/sessions'
import { getActiveSplit } from '../db/splits'
import { nextSplitDay, plannedSetCount } from '../logic/nextSession'
import { trainingDates } from '../logic/sessions'

export default function Train() {
  const [loading, setLoading] = useState(true)
  const [split, setSplit] = useState<Split | undefined>()
  const [marks, setMarks] = useState<SessionMark[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all([getActiveSplit(), allSessionMarks(), listExercises()]).then(([sp, m, ex]) => {
      if (cancelled) return
      setSplit(sp)
      setMarks(m)
      setExercises(ex)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <Screen title="Train">{null}</Screen>

  const day: SplitDay | undefined = split ? nextSplitDay(split, marks) : undefined
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const trained = [...trainingDates(marks)].sort((a, b) => b.localeCompare(a)).slice(0, 5)

  return (
    <Screen title="Train" eyebrow={split?.name}>
      {!split || !day ? (
        <EmptyState>
          <p className="text-sm text-[var(--color-text-secondary)]">
            No split chosen yet, so there is no session waiting.
          </p>
          <Link
            to="/splits"
            className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] px-5 py-3 text-sm text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            Choose a split
          </Link>
        </EmptyState>
      ) : (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-text-secondary)]">Next up</span>
            <h2 className="text-xl font-medium text-[var(--color-text-primary)]">{day.label}</h2>
            <span className="text-xs text-[var(--color-text-secondary)]">
              {day.entries.length} exercises · {plannedSetCount(day)} sets
            </span>
          </div>

          <ul className="flex flex-col gap-2">
            {day.entries.map((entry, index) => (
              <li
                key={`${entry.exerciseId}-${index}`}
                className="flex items-baseline justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3"
              >
                <span className="text-base text-[var(--color-text-primary)]">
                  {byId.get(entry.exerciseId)?.name ?? 'Unknown movement'}
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {entry.sets} × {entry.reps}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {trained.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">Recent sessions</h2>
          <ul className="flex flex-col gap-1">
            {trained.map((date) => (
              <li key={date} className="text-sm text-[var(--color-text-secondary)]">
                {date}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Screen>
  )
}
