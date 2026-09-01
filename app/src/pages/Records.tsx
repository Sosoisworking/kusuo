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

import Segmented from '../components/Segmented'
import { listExercises } from '../db/exercises'
import { allBodyweight, appendBodyweight } from '../db/bodyweight'
import { allSessionEvents } from '../db/sessions'
import { updateSettings } from '../db/settings'
import type { BodyweightEntry, Exercise, SessionEvent, Units } from '../db/schema'
import { formatWeight, toKg, weightValue } from '../lib/units'
import { completedDatesForHabit } from '../logic/derive'
import { bestMonth, bestStreak, bodyweightByDate, bodyweightChange, liftRecords } from '../logic/records'

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
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [sessionEvents, setSessionEvents] = useState<SessionEvent[]>([])
  const [tab, setTab] = useState<'habits' | 'training'>('habits')
  const [weighIns, setWeighIns] = useState<BodyweightEntry[]>([])
  const [weightInput, setWeightInput] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getSettings(getOrCreateDeviceId()),
      listAllHabits(),
      allHabitEvents(),
      listCompletedGoals(),
      allReflections(),
      listExercises(),
      allSessionEvents(),
      allBodyweight(),
    ]).then(
      ([s, habits, events, goals, entries, list, sessions, weights]: [
        Settings | undefined,
        Habit[],
        HabitEvent[],
        Goal[],
        ReflectionEntry[],
        Exercise[],
        SessionEvent[],
        BodyweightEntry[],
      ]) => {
        if (cancelled) return
        setSettings(s)
        setReached(goals)
        setReflections(entries)
        setExercises(list)
        setSessionEvents(sessions)
        setWeighIns(weights)
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

  const units: Units = settings?.units ?? 'kg'
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const lifts = liftRecords(sessionEvents)

  const points = bodyweightByDate(weighIns)
  const change = bodyweightChange(points)

  async function logWeighIn() {
    const typed = Number(weightInput)
    if (!Number.isFinite(typed) || typed <= 0 || !settings) return
    await appendBodyweight(todayLocalDate(), toKg(typed, units), settings.deviceId)
    setWeighIns(await allBodyweight())
    setWeightInput('')
  }

  async function switchUnits(next: Units) {
    if (!settings || next === settings.units) return
    setSettings({ ...settings, units: next })
    await updateSettings(settings.deviceId, { units: next })
  }

  return (
    <Screen title="Records" eyebrow="Your best, stated plainly">
      <Segmented<'habits' | 'training'>
        label="Show"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'habits', label: 'Habits' },
          { value: 'training', label: 'Training' },
        ]}
      />

      {tab === 'training' ? (
        <>
          {/* Bodyweight sits with the lifts because that is what it is read
              against — a number you watch beside them, not a score. */}
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Bodyweight</h2>
            {weighIns.length > 0 && (
              <p className="text-xs text-[var(--color-text-secondary)]">
                {formatWeight(points[0].weightKg, units)} on {formatLongDate(points[0].localDate)}
                {change !== undefined &&
                  ` · ${change >= 0 ? '+' : ''}${formatWeight(Math.abs(change), units)} since ${formatLongDate(points[points.length - 1].localDate)}`}
              </p>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                logWeighIn()
              }}
            >
              <input
                inputMode="decimal"
                aria-label={`Today's bodyweight in ${units}`}
                placeholder={units}
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="min-h-11 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-base text-[var(--color-text-primary)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              />
              <button
                type="submit"
                disabled={!Number.isFinite(Number(weightInput)) || weightInput.trim() === ''}
                className="min-h-11 rounded-[var(--radius-md)] px-5 text-sm text-[var(--color-accent)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                style={{ boxShadow: 'inset 0 0 0 1px var(--color-accent)' }}
              >
                Log
              </button>
            </form>
            {points.length > 1 && (
              <ul className="flex flex-col">
                {points.slice(0, 8).map((point) => (
                  <li
                    key={point.localDate}
                    className="flex items-baseline justify-between gap-3 py-2"
                    style={{ borderBottom: '1px solid var(--color-divider)' }}
                  >
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {formatLongDate(point.localDate)}
                    </span>
                    <span className="text-sm text-[var(--color-text-primary)]">
                      {formatWeight(point.weightKg, units)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* The unit switch lives here as well as in Settings: this is the one
              screen where every number is a weight, so it is where you notice. */}
          <Segmented<Units>
            label="Lifts"
            value={units}
            onChange={switchUnits}
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lb', label: 'lb' },
            ]}
          />

          {lifts.length === 0 ? (
            <EmptyState>
              <p className="text-sm text-[var(--color-text-secondary)]">
                No lifts logged yet. A movement appears here the first time you put a weight on it.
              </p>
            </EmptyState>
          ) : (
            <section className="flex flex-col">
              {lifts.map(({ exerciseId, records, bestSession }) => {
                const heaviest = records.heaviestSet
                const oneRepMax = records.bestEstimatedOneRepMax
                const topRep = records.repPrs[0]
                return (
                  <article
                    key={exerciseId}
                    className="flex flex-col gap-2 py-3"
                    style={{ borderBottom: '1px solid var(--color-divider)' }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-base text-[var(--color-text-primary)]">
                        {byId.get(exerciseId)?.name ?? 'Unknown movement'}
                      </span>
                      <span className="text-lg text-[var(--color-accent)]">
                        {heaviest ? weightValue(heaviest.weightKg, units) : '—'}
                        <span className="ml-1 text-xs text-[var(--color-text-secondary)]">
                          {units}
                        </span>
                      </span>
                    </div>
                    <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                      {oneRepMax && (
                        <div className="flex gap-1.5">
                          <dt>Est. 1RM</dt>
                          <dd className="text-[var(--color-text-primary)]">
                            {formatWeight(oneRepMax.oneRepMaxKg, units)}
                          </dd>
                        </div>
                      )}
                      {records.bestSetVolume && (
                        <div className="flex gap-1.5">
                          <dt>Best set volume</dt>
                          <dd className="text-[var(--color-text-primary)]">
                            {formatWeight(records.bestSetVolume.volumeKg, units)}
                          </dd>
                        </div>
                      )}
                      {bestSession && (
                        <div className="flex gap-1.5">
                          <dt>Session volume</dt>
                          <dd className="text-[var(--color-text-primary)]">
                            {formatWeight(bestSession.volumeKg, units)}
                          </dd>
                        </div>
                      )}
                      {topRep && (
                        <div className="flex gap-1.5">
                          <dt>Reps at {formatWeight(topRep.weightKg, units)}</dt>
                          <dd className="text-[var(--color-text-primary)]">{topRep.reps}</dd>
                        </div>
                      )}
                    </dl>
                  </article>
                )
              })}
            </section>
          )}

          <p className="text-xs text-[var(--color-text-secondary)]">
            Counted from your logged sets, never stored. A voided set leaves no record behind.
          </p>
        </>
      ) : (
        <>
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
        </>
      )}
    </Screen>
  )
}
