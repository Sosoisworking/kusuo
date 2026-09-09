import { useEffect, useState } from 'react'
import Screen, { EmptyState } from '../components/Screen'
import { allHabitEvents } from '../db/events'
import { listCompletedGoals } from '../db/goals'
import { listAllHabits } from '../db/habits'
import type { Goal, Habit, HabitEvent, Settings } from '../db/schema'
import { formatLongDate, formatShortDate } from '../lib/format'
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
import type { LoggedSet } from '../logic/sessions'
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

/**
 * Two records that are the same set are one record. The top rep PR is usually
 * at your heaviest weight, so on a movement with little history it is the
 * headline again in different words — worth saying only when it differs.
 */
function isSameSet(a: LoggedSet, b: LoggedSet): boolean {
  return a.localDate === b.localDate && a.weightKg === b.weightKg && a.reps === b.reps
}

/**
 * One record, said in full: what it is, the number, and the day it happened.
 * `detail` carries the set behind a derived figure, so a volume says which
 * lift produced it and an estimate admits that it is one.
 */
function Record({
  label,
  value,
  detail,
  when,
}: {
  label: string
  value: string
  detail?: string
  when: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="flex flex-col gap-0.5">
        <span className="text-[13px] text-[var(--color-text-secondary)]">{label}</span>
        {detail && <span className="text-xs text-[var(--color-text-secondary)]">{detail}</span>}
      </dt>
      <dd className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-[15px] text-[var(--color-text-primary)]">{value}</span>
        <span className="text-xs text-[var(--color-text-secondary)]">{formatShortDate(when)}</span>
      </dd>
    </div>
  )
}

export default function Records() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings | undefined>()
  const [rows, setRows] = useState<HabitBests[]>([])
  const [reached, setReached] = useState<Goal[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [sessionEvents, setSessionEvents] = useState<SessionEvent[]>([])
  const [tab, setTab] = useState<'habits' | 'training'>('habits')
  const [weighIns, setWeighIns] = useState<BodyweightEntry[]>([])
  const [weightInput, setWeightInput] = useState('')
  const [openLift, setOpenLift] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getSettings(getOrCreateDeviceId()),
      listAllHabits(),
      allHabitEvents(),
      listCompletedGoals(),
      listExercises(),
      allSessionEvents(),
      allBodyweight(),
    ]).then(
      ([s, habits, events, goals, list, sessions, weights]: [
        Settings | undefined,
        Habit[],
        HabitEvent[],
        Goal[],
        Exercise[],
        SessionEvent[],
        BodyweightEntry[],
      ]) => {
        if (cancelled) return
        setSettings(s)
        setReached(goals)
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

  const units: Units = settings?.units ?? 'kg'
  const byId = new Map(exercises.map((e) => [e.id, e]))
  /*
    A–Z by movement name, which is the order you can predict: you come here
    looking for one lift, and alphabetical is the only arrangement where you
    know before you look roughly where it will be. Ordering by weight put the
    squat and the deadlift on top for ever and buried everything else, which is
    also a ranking — and this page states your bests without ranking them.

    Sorted here rather than in `liftRecords`, because the name lives on the
    exercise and the logic layer only has ids.
  */
  const lifts = liftRecords(sessionEvents)
    .map((lift) => ({ ...lift, name: byId.get(lift.exerciseId)?.name ?? 'Unknown movement' }))
    .sort((a, b) => a.name.localeCompare(b.name))

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
          {/* The unit switch lives here as well as in Settings: this is the one
              screen where every number is a weight, so it is where you notice. */}
          <Segmented<Units>
            label="Show weights in"
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
            /*
              One record per movement, said in full.

              This used to put an unlabelled number on the right and then four
              more underneath in one wrapping row — a weight with no reps, two
              volumes a word apart that meant a set and a whole day, and an
              estimate styled exactly like the lifts it was estimated from.
              Nothing carried a date, which is what a record is for.

              So the row states one fact you can read at a glance — heaviest
              set, in full, with the day it happened — and the rest waits behind
              a tap, each one named, dated, and honest about whether you lifted
              it or the app worked it out.
            */
            <section className="flex flex-col">
              {lifts.map(({ exerciseId, name, records, bestSession }) => {
                const heaviest = records.heaviestSet
                if (!heaviest) return null
                const open = openLift === exerciseId
                const oneRepMax = records.bestEstimatedOneRepMax
                const topRep = records.repPrs[0]
                return (
                  <article
                    key={exerciseId}
                    style={{ borderBottom: '1px solid var(--color-divider)' }}
                  >
                    <button
                      onClick={() => setOpenLift(open ? null : exerciseId)}
                      aria-expanded={open}
                      className="flex min-h-11 w-full items-baseline justify-between gap-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="text-base text-[var(--color-text-primary)]">{name}</span>
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          heaviest set · {formatLongDate(heaviest.localDate)}
                        </span>
                      </span>
                      <span className="shrink-0 text-lg text-[var(--color-accent)]">
                        {weightValue(heaviest.weightKg, units)}
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          {` ${units} × ${heaviest.reps}`}
                        </span>
                      </span>
                    </button>

                    {open && (
                      <dl className="flex flex-col gap-2 pb-3">
                        {topRep && !isSameSet(topRep.set, heaviest) && (
                          <Record
                            label={`Most reps at ${weightValue(topRep.weightKg, units)} ${units}`}
                            value={`${topRep.reps} reps`}
                            when={topRep.set.localDate}
                          />
                        )}
                        {records.bestSetVolume && (
                          <Record
                            label="Most moved in one set"
                            value={`${weightValue(records.bestSetVolume.volumeKg, units)} ${units}`}
                            detail={`${weightValue(records.bestSetVolume.set.weightKg, units)} ${units} × ${records.bestSetVolume.set.reps}`}
                            when={records.bestSetVolume.set.localDate}
                          />
                        )}
                        {bestSession && (
                          <Record
                            label="Most moved in one session"
                            value={`${weightValue(bestSession.volumeKg, units)} ${units}`}
                            detail="every set of that day added up"
                            when={bestSession.localDate}
                          />
                        )}
                        {oneRepMax && (
                          <Record
                            label="Estimated one-rep max"
                            value={`${weightValue(oneRepMax.oneRepMaxKg, units)} ${units}`}
                            /* Named as a calculation, because it is one: this
                               is a weight you have never actually lifted. */
                            detail={`worked out from ${weightValue(oneRepMax.set.weightKg, units)} ${units} × ${oneRepMax.set.reps} — not a lift you have done`}
                            when={oneRepMax.set.localDate}
                          />
                        )}
                      </dl>
                    )}
                  </article>
                )
              })}
            </section>
          )}

          <p className="text-xs text-[var(--color-text-secondary)]">
            Counted from your logged sets, never stored. A voided set leaves no record behind.
          </p>

          {/* Bodyweight is not a personal best — it is a number you watch beside
              the lifts, and the one thing on this page you type into. It sits
              after the records rather than above them, so the page opens on
              what it is named for. */}
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
                    {/* "September 2026 · 1" left you to work out what the 1
                        counted. Said as a sentence it cannot be misread. */}
                    <dd className="text-[var(--color-text-primary)]">
                      {`${month.count} ${month.count === 1 ? 'day' : 'days'} in ${monthLabel(`${month.month}-01`)}`}
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

      <p className="text-xs text-[var(--color-text-secondary)]">
        Every figure here is counted from your history, not stored.
      </p>
        </>
      )}
    </Screen>
  )
}
