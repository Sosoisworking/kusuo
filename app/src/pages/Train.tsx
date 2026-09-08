import { ArrowsLeftRight, CaretRight, Play } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { SecondaryButton } from '../components/Button'
import Screen, { EmptyState } from '../components/Screen'
import SectionHeading from '../components/SectionHeading'
import { listExercises } from '../db/exercises'
import type { Exercise, SessionEvent, SessionMark, Settings, Split, SplitDay } from '../db/schema'
import { allSessionEvents, allSessionMarks, finishSession } from '../db/sessions'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import { getActiveSplit, instantiateTemplate, listSplits, setActiveSplit } from '../db/splits'
import { todayLocalDate } from '../lib/date'
import ProfileMenu from '../components/ProfileMenu'
import { formatRelativeDay } from '../lib/format'
import { SPLIT_TEMPLATES } from '../lib/splitTemplates'
import { weightValue } from '../lib/units'
import {
  formatPrescription,
  dayForDate,
  plannedSetCount,
  sessionDayOn,
} from '../logic/nextSession'
import { isSessionComplete, setsForExercise, setsOnDate, volume } from '../logic/sessions'
import { lastCompletedDate, lastSessionSets, recentSessions } from '../logic/trainingHistory'

/**
 * What a movement's row says about last time. A lift reports the heaviest set
 * of its last session; cardio reports the time, because it has no load to
 * report. Neither is a target — it is what happened.
 */
function lastPerformance(
  events: SessionEvent[],
  exercise: Exercise | undefined,
  units: Settings['units'],
): string {
  if (!exercise) return ''
  const sets = lastSessionSets(setsForExercise(events, exercise.id))
  if (sets.length === 0) return ''
  if (exercise.category === 'cardio') {
    const seconds = sets.reduce((total, s) => total + (s.durationSec ?? 0), 0)
    return seconds > 0 ? `last ${Math.round(seconds / 60)} min` : ''
  }
  const heaviest = sets.reduce((best, s) => (s.weightKg > best ? s.weightKg : best), 0)
  return heaviest > 0 ? `last ${weightValue(heaviest, units)} ${units}` : ''
}

export default function Train() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings | undefined>()
  const [split, setSplit] = useState<Split | undefined>()
  const [splits, setSplits] = useState<Split[]>([])
  const [marks, setMarks] = useState<SessionMark[]>([])
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
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

  async function load() {
    const [s, sp, all, m, e, ex] = await Promise.all([
      getSettings(getOrCreateDeviceId()),
      getActiveSplit(),
      listSplits(),
      allSessionMarks(),
      allSessionEvents(),
      listExercises(),
    ])
    setSettings(s)
    setSplit(sp)
    setSplits(all)
    setMarks(m)
    setEvents(e)
    setExercises(ex)
  }

  async function switchTo(templateId: string) {
    if (!settings || settings.deviceRole !== 'writer') return
    setError(null)
    setBusy(true)
    try {
      // A template already taken a copy of is re-activated, never duplicated.
      const existing = splits.find((s) => s.seededFrom === templateId)
      if (existing) await setActiveSplit(existing.id)
      else await instantiateTemplate(templateId)
      await load()
      setPickerOpen(false)
    } catch {
      setError("Couldn't switch split — try that again.")
    } finally {
      setBusy(false)
    }
  }

  /**
   * A rest day still has to be marked, or the cycle sticks on it forever. It
   * writes the SessionMark and deliberately passes no habit id: resting is part
   * of the split, but it is not a training session, and ticking the habit for
   * it would put a lie in the history.
   */
  async function markRested(dayId: string) {
    if (!settings || settings.deviceRole !== 'writer') return
    setError(null)
    setBusy(true)
    try {
      await finishSession(todayLocalDate(), dayId, settings.deviceId)
      await load()
    } catch {
      setError("Couldn't save that — try again.")
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Screen title="Train">{null}</Screen>

  const isReader = settings?.deviceRole === 'reader'
  const units = settings?.units ?? 'kg'
  const weekStart = settings?.weekStart ?? 'monday'
  const today = todayLocalDate()
  const scheduled: SplitDay | undefined = split ? dayForDate(split, today, weekStart) : undefined
  /*
    Days with work recorded against today — sets that survived replay, or a
    session marked done. This is what lets a swapped-in session stick: pick
    Monday's shoulders on a Wednesday, log one set, and Train keeps showing
    shoulders instead of snapping back to what the calendar says.
  */
  const workedToday = new Set<string>(setsOnDate(events, today).map((s) => s.splitDayId))
  for (const d of split?.days ?? []) {
    if (isSessionComplete(marks, today, d.id)) workedToday.add(d.id)
  }
  const day: SplitDay | undefined = split
    ? sessionDayOn(split, today, weekStart, workedToday)
    : undefined
  const swapped = Boolean(day && scheduled && day.id !== scheduled.id)
  const dayNumber = split && day ? split.days.findIndex((d) => d.id === day.id) + 1 : 0
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const dayById = new Map(splits.flatMap((s) => s.days.map((d) => [d.id, d] as const)))

  const loggedToday = day ? setsOnDate(events, today).filter((s) => s.splitDayId === day.id) : []
  const planned = day ? plannedSetCount(day) : 0
  const restedToday = day ? isSessionComplete(marks, today, day.id) : false
  const lastDone = day ? lastCompletedDate(marks, day.id) : undefined

  const meta: string[] = []
  if (day && day.kind !== 'rest') {
    meta.push(`${day.entries.length} exercises`, `${planned} sets`)
    if (loggedToday.length > 0) meta.push(`${loggedToday.length} of ${planned} logged`)
    else if (lastDone) meta.push(`last done ${formatRelativeDay(lastDone, today)}`)
  }

  const recent = recentSessions(marks, 5)

  return (
    <Screen
      title="Train"
      eyebrow={split ? `${split.name} · ${split.days.length} day` : undefined}
      action={<ProfileMenu name={settings?.userName} />}
    >
      {error && (
        <p role="alert" className="text-xs text-[var(--color-text-secondary)]">
          {error}
        </p>
      )}

      {!split || !day ? (
        <EmptyState>
          <p className="text-sm text-[var(--color-text-secondary)]">
            No split chosen yet, so there is no session waiting. Pick one here, or build your own in{' '}
            <Link to="/splits" className="text-[var(--color-accent)] underline">
              Splits
            </Link>
            .
          </p>
          {/* The picker belongs on this screen too. Sending someone to another
              tab to do the one thing this screen is asking for is a dead end. */}
          {!isReader && (
            <button
              onClick={() => setPickerOpen((open) => !open)}
              aria-expanded={pickerOpen}
              className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-accent)] px-5 py-3 text-sm font-medium text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            >
              {pickerOpen ? 'Close' : 'Choose a split'}
            </button>
          )}
        </EmptyState>
      ) : (
        <section
          className="relative overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4"
          style={{ boxShadow: 'var(--shadow-md)' }}
        >
          {/* One accent line as the only ornament — the same glow the canvas
              puts on the thing you are meant to act on. */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px"
            style={{
              background: 'linear-gradient(90deg, transparent, var(--color-accent), transparent)',
            }}
          />
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-accent)]">
            Today · Day {dayNumber}
          </span>
          <h2 className="mt-1 text-xl font-medium text-[var(--color-text-primary)]">{day.label}</h2>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            {day.kind === 'rest' ? 'A day in the split, not a gap in it.' : meta.join(' · ')}
          </p>
          {/* Say which day the schedule wanted, so a swap never looks like the
              app losing track of where it is in the week. */}
          {swapped && scheduled && (
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              Doing this instead of {scheduled.label} today.
            </p>
          )}

          {!isReader && (
            <div className="mt-3 flex gap-2">
              {day.kind === 'rest' ? (
                restedToday ? (
                  <p className="min-h-11 flex-1 self-center text-sm text-[var(--color-text-secondary)]">
                    Marked done today.
                  </p>
                ) : (
                  <button
                    onClick={() => markRested(day.id)}
                    disabled={busy}
                    className="flex min-h-12 flex-1 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-accent)] px-5 text-[15px] font-medium text-[var(--color-accent)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                  >
                    Mark the rest day done
                  </button>
                )
              ) : (
                <button
                  onClick={() => navigate(`/train/session/${day.id}`)}
                  className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-accent)] px-5 text-[15px] font-medium text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <Play size={15} weight="fill" aria-hidden="true" />
                  {loggedToday.length > 0 ? 'Continue session' : 'Start session'}
                </button>
              )}
              <button
                onClick={() => setPickerOpen((open) => !open)}
                aria-expanded={pickerOpen}
                aria-label="Do a different session"
                className="flex min-h-12 w-12 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              >
                <ArrowsLeftRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </section>
      )}

      {/*
        Any day of the split, done today.

        The schedule answers "what is today"; it cannot answer "I missed Monday
        and I want to do it now", which is the ordinary way a week actually goes.
        The session itself was always addressable — /train/session/:dayId takes
        any day and logs against today's date — so this is the door to a room
        that already existed. A rest day gets one too: deciding to lift on a rest
        day left you with no route to a session at all.
      */}
      {pickerOpen && !isReader && split && (
        <section className="flex flex-col gap-2">
          <SectionHeading>Do a different day</SectionHeading>
          <ul className="flex flex-col">
            {split.days.map((d, index) => {
              const isCurrent = d.id === day?.id
              const done = isSessionComplete(marks, today, d.id)
              const logged = setsOnDate(events, today).filter((s) => s.splitDayId === d.id).length
              const detail =
                d.kind === 'rest'
                  ? 'Rest'
                  : logged > 0
                    ? `${logged} of ${plannedSetCount(d)} logged today`
                    : `${d.entries.length} exercises · ${plannedSetCount(d)} sets`
              return (
                <li
                  key={d.id}
                  className="flex min-h-11 items-center justify-between gap-3 py-2"
                  style={{ borderBottom: '1px solid var(--color-divider)' }}
                >
                  <span className="flex flex-col">
                    <span className="text-sm text-[var(--color-text-primary)]">
                      Day {index + 1} · {d.label}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)]">{detail}</span>
                  </span>
                  {done ? (
                    <span className="text-xs text-[var(--color-text-secondary)]">Done today</span>
                  ) : isCurrent && logged > 0 ? (
                    <span className="text-xs text-[var(--color-accent)]">In progress</span>
                  ) : d.kind === 'rest' ? (
                    <SecondaryButton
                      onClick={() => markRested(d.id)}
                      disabled={busy}
                      className="px-4 py-2 text-sm"
                    >
                      Mark rested
                    </SecondaryButton>
                  ) : (
                    <SecondaryButton
                      onClick={() => navigate(`/train/session/${d.id}`)}
                      className="px-4 py-2 text-sm"
                    >
                      Do this
                    </SecondaryButton>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-[var(--color-text-secondary)]">
            It logs against today. The day you missed stays missed — this is today&apos;s session,
            with that day&apos;s movements.
          </p>
        </section>
      )}

      {pickerOpen && !isReader && (
        <section className="flex flex-col gap-2">
          <SectionHeading>Switch split</SectionHeading>
          <ul className="flex flex-col">
            {SPLIT_TEMPLATES.map((template) => {
              const isActive = split?.seededFrom === template.id
              return (
                <li
                  key={template.id}
                  className="flex min-h-11 items-center justify-between gap-3 py-2"
                  style={{ borderBottom: '1px solid var(--color-divider)' }}
                >
                  <span className="flex flex-col">
                    <span className="text-sm text-[var(--color-text-primary)]">{template.name}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {template.days.length} days
                    </span>
                  </span>
                  {isActive ? (
                    <span className="text-xs text-[var(--color-accent)]">Active</span>
                  ) : (
                    <SecondaryButton
                      onClick={() => switchTo(template.id)}
                      disabled={busy}
                      className="px-4 py-2 text-sm"
                    >
                      Use this
                    </SecondaryButton>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {day && day.kind !== 'rest' && (
        <section className="flex flex-col gap-2">
          <SectionHeading>What&apos;s in it</SectionHeading>
          {/* A plain list of things is separated by a hairline, not boxed —
              five boxes read as five separate objects. */}
          <ul className="flex flex-col">
            {day.entries.map((entry, index) => {
              const exercise = byId.get(entry.exerciseId)
              const parts = [
                formatPrescription(entry, exercise?.category),
                lastPerformance(events, exercise, units),
              ].filter(Boolean)
              return (
                <li key={`${entry.exerciseId}-${index}`}>
                  <Link
                    to={`/exercises/${entry.exerciseId}`}
                    className="flex min-h-11 items-center gap-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                    style={{ borderBottom: '1px solid var(--color-divider)' }}
                  >
                    <span className="flex flex-1 flex-col gap-px">
                      <span className="text-[15px] font-medium text-[var(--color-text-primary)]">
                        {exercise?.name ?? 'Unknown movement'}
                      </span>
                      {parts.length > 0 && (
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          {parts.join(' · ')}
                        </span>
                      )}
                    </span>
                    <CaretRight
                      size={13}
                      aria-hidden="true"
                      color="var(--color-text-secondary)"
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {recent.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionHeading>Recent sessions</SectionHeading>
          <ul className="flex flex-col">
            {recent.map((session) => {
              const sets = setsOnDate(events, session.localDate).filter(
                (s) => s.splitDayId === session.splitDayId,
              )
              const moved = volume(sets)
              const detail =
                sets.length === 0
                  ? 'Rest'
                  : `${sets.length} sets${moved > 0 ? ` · ${weightValue(moved, units)} ${units}` : ''}`
              return (
                <li
                  key={`${session.localDate}-${session.splitDayId}`}
                  className="flex min-h-11 items-baseline gap-3 py-2"
                  style={{ borderBottom: '1px solid var(--color-divider)' }}
                >
                  <span className="w-14 shrink-0 text-xs text-[var(--color-text-secondary)]">
                    {formatRelativeDay(session.localDate, today)}
                  </span>
                  <span className="flex-1 text-sm text-[var(--color-text-primary)]">
                    {dayById.get(session.splitDayId)?.label ?? 'Session'}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)]">{detail}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </Screen>
  )
}
