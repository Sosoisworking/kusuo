import { ArrowSquareOut } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import BackLink from '../components/BackLink'
import { EmptyState } from '../components/Screen'
import SectionHeading from '../components/SectionHeading'
import { getExercise } from '../db/exercises'
import type { Exercise, SessionEvent, Settings } from '../db/schema'
import { allSessionEvents } from '../db/sessions'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import { todayLocalDate } from '../lib/date'
import { formatShortDate } from '../lib/format'
import { weightValue } from '../lib/units'
import { exerciseRecords } from '../logic/records'
import { setsForExercise } from '../logic/sessions'
import { historyByDate, summariseSets, topSetWeeks } from '../logic/trainingHistory'

const WEEKS = 12

/** Five accent steps, dimmest to brightest. A taller bar is a brighter one. */
const BAR_STEPS = [
  'var(--color-accent-800)',
  'var(--color-accent-700)',
  'var(--color-accent-600)',
  'var(--color-accent-500)',
  'var(--color-accent)',
]

function Tag({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className="rounded-[var(--radius-sm)] px-2 py-1 text-[11px]"
      style={
        accent
          ? { background: 'var(--color-accent-900)', color: 'var(--color-accent-200)' }
          : {
              boxShadow: 'inset 0 0 0 1px var(--color-border)',
              color: 'var(--color-text-secondary)',
            }
      }
    >
      {children}
    </span>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col gap-0.5 bg-[var(--color-bg)] px-3.5 py-3">
      <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
        {label}
      </span>
      <span className="text-xl font-medium tracking-[-0.02em] text-[var(--color-text-primary)]">
        {value}
        {unit && <span className="text-xs text-[var(--color-text-secondary)]"> {unit}</span>}
      </span>
    </div>
  )
}

interface Loaded {
  settings?: Settings
  exercise?: Exercise
  events: SessionEvent[]
}

/** Module-level so the effect depends on the exercise id and nothing else. */
async function loadExercise(id: string | undefined): Promise<Loaded> {
  const [settings, exercise, events] = await Promise.all([
    getSettings(getOrCreateDeviceId()),
    id ? getExercise(id) : Promise.resolve(undefined),
    allSessionEvents(),
  ])
  return { settings, exercise, events }
}

const NOTHING: Loaded = { events: [] }

export default function ExerciseDetail() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Loaded>(NOTHING)

  useEffect(() => {
    let cancelled = false
    loadExercise(id).then((loaded) => {
      if (cancelled) return
      setData(loaded)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const { settings, exercise, events } = data

  if (loading) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6">
        <div className="h-6 w-32 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface)]" />
      </main>
    )
  }

  const units = settings?.units ?? 'kg'
  const shell =
    'flex min-h-dvh flex-col gap-4 px-5 pb-28 pt-[max(2.5rem,env(safe-area-inset-top))]'

  if (!exercise) {
    return (
      <main className={shell}>
        <BackLink />
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">Movement not found</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          It may have been removed from the directory.
        </p>
      </main>
    )
  }

  const isCardio = exercise.category === 'cardio'
  const sets = setsForExercise(events, exercise.id)
  const history = historyByDate(sets)
  const records = exerciseRecords(events, exercise.id)
  const weeks = topSetWeeks(sets, todayLocalDate(), WEEKS, settings?.weekStart ?? 'monday')
  const peak = weeks.reduce((max, w) => Math.max(max, w.topKg), 0)
  const totalSeconds = sets.reduce((total, s) => total + (s.durationSec ?? 0), 0)

  return (
    <main className={shell}>
      <div className="flex items-center justify-between gap-3">
        <BackLink />
        {exercise.referenceUrl && (
          <a
            href={exercise.referenceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-[13px] text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            <ArrowSquareOut size={14} aria-hidden="true" />
            Reference
          </a>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-medium tracking-[-0.02em] text-[var(--color-text-primary)]">
          {exercise.name}
        </h1>
        <div className="flex flex-wrap gap-1.5">
          <Tag accent>{exercise.category}</Tag>
          <Tag>{exercise.muscleGroup}</Tag>
          <Tag>{exercise.equipment}</Tag>
          {exercise.isCustom && <Tag>Yours</Tag>}
        </div>
      </div>

      {sets.length === 0 ? (
        <EmptyState>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Nothing logged for this movement yet. Its records appear once you train it.
          </p>
        </EmptyState>
      ) : (
        <>
          <div
            className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-md)]"
            style={{ background: 'var(--color-divider)' }}
          >
            {isCardio ? (
              <>
                <Stat label="Sessions" value={String(history.length)} />
                <Stat label="Total time" value={String(Math.round(totalSeconds / 60))} unit="min" />
                <Stat
                  label="Longest"
                  value={String(
                    Math.round(
                      Math.max(...history.map((d) => d.sets.reduce((t, s) => t + (s.durationSec ?? 0), 0))) /
                        60,
                    ),
                  )}
                  unit="min"
                />
                <Stat label="Logged" value={String(records.totalSets)} />
              </>
            ) : (
              <>
                <Stat
                  label="Heaviest set"
                  value={records.heaviestSet ? weightValue(records.heaviestSet.weightKg, units) : '—'}
                  unit={records.heaviestSet ? `${units} × ${records.heaviestSet.reps}` : undefined}
                />
                <Stat
                  label="Est. 1RM"
                  value={
                    records.bestEstimatedOneRepMax
                      ? weightValue(records.bestEstimatedOneRepMax.oneRepMaxKg, units)
                      : '—'
                  }
                  unit={records.bestEstimatedOneRepMax ? units : undefined}
                />
                <Stat
                  label="Best set volume"
                  value={
                    records.bestSetVolume ? weightValue(records.bestSetVolume.volumeKg, units) : '—'
                  }
                  unit={records.bestSetVolume ? units : undefined}
                />
                <Stat label="Sessions" value={String(history.length)} />
              </>
            )}
          </div>

          {!isCardio && peak > 0 && (
            <section className="flex flex-col gap-2">
              <SectionHeading>Top set, twelve weeks</SectionHeading>
              <div
                role="img"
                aria-label={`Heaviest set in each of the last ${WEEKS} weeks, peaking at ${weightValue(peak, units)} ${units}`}
                className="flex h-14 items-end gap-[3px]"
              >
                {weeks.map((week) => {
                  const ratio = week.topKg / peak
                  const step = BAR_STEPS[Math.min(BAR_STEPS.length - 1, Math.floor(ratio * BAR_STEPS.length))]
                  return (
                    <span
                      key={week.weekStart}
                      className="flex-1 rounded-[2px]"
                      style={{
                        // An empty week keeps its column and shows a hairline.
                        height: week.topKg > 0 ? `${Math.max(6, ratio * 100)}%` : '1px',
                        background: week.topKg > 0 ? step : 'var(--color-border)',
                      }}
                    />
                  )
                })}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <SectionHeading>History</SectionHeading>
            <ul className="flex flex-col">
              {history.map((day) => (
                <li
                  key={day.localDate}
                  className="flex min-h-11 items-baseline gap-3 py-2"
                  style={{ borderBottom: '1px solid var(--color-divider)' }}
                >
                  <span className="w-14 shrink-0 text-[11px] text-[var(--color-text-secondary)]">
                    {formatShortDate(day.localDate)}
                  </span>
                  <span className="flex-1 text-[13px] text-[var(--color-text-primary)]">
                    {summariseSets(day.sets, units, isCardio)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {!isCardio && records.repPrs.length > 0 && (
            <section className="flex flex-col gap-2">
              <SectionHeading>Best reps at a weight</SectionHeading>
              <ul className="flex flex-col">
                {records.repPrs.slice(0, 6).map((pr) => (
                  <li
                    key={pr.weightKg}
                    className="flex min-h-11 items-baseline justify-between gap-3 py-2"
                    style={{ borderBottom: '1px solid var(--color-divider)' }}
                  >
                    <span className="text-sm text-[var(--color-text-primary)]">
                      {weightValue(pr.weightKg, units)} {units}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {pr.reps} reps
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  )
}
