import { CaretLeft,
  CaretRight, Check } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import SectionHeading from '../components/SectionHeading'
import { listExercises } from '../db/exercises'
import type {
  Exercise,
  SessionEvent,
  SessionMark,
  Settings,
  Split,
  SplitDay,
  SplitEntry,
} from '../db/schema'
import {
  allSessionEvents,
  allSessionMarks,
  finishSession,
  logSet,
  type SetValues,
  unfinishSession,
  voidSet,
} from '../db/sessions'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import { findSplitDay, updateSplit } from '../db/splits'
import { todayLocalDate } from '../lib/date'
import { toKg, weightValue } from '../lib/units'
import { describePrescription, plannedSetCount } from '../logic/nextSession'
import { isSessionComplete, setsForExercise, setsOnDate, type LoggedSet } from '../logic/sessions'
import { lastSessionSets, summariseSets } from '../logic/trainingHistory'

interface Draft {
  weight: string
  reps: string
  rpe: string
}

const EMPTY_DRAFT: Draft = { weight: '', reps: '', rpe: '' }

function parse(value: string): number | undefined {
  const n = Number(value.trim().replace(',', '.'))
  return value.trim() === '' || Number.isNaN(n) ? undefined : n
}

/** A whole number carried in the URL, or null when it says nothing usable. */
function whole(value: string | null): number | null {
  if (value === null || value.trim() === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 ? n : null
}

interface Loaded {
  settings?: Settings
  found?: { split: Split; day: SplitDay }
  exercises: Exercise[]
  events: SessionEvent[]
  marks: SessionMark[]
  /**
   * When the data was read. The session clock is derived from this, so it moves
   * when something happens and never on a tick — there is no timer in this app,
   * and a self-refreshing one would be the thin end of it.
   */
  readAt: number
}

/** Module-level so the effect depends on the day id and nothing else. */
async function loadSession(dayId: string | undefined): Promise<Loaded> {
  const [settings, found, exercises, events, marks] = await Promise.all([
    getSettings(getOrCreateDeviceId()),
    dayId ? findSplitDay(dayId) : Promise.resolve(undefined),
    listExercises(),
    allSessionEvents(),
    allSessionMarks(),
  ])
  return { settings, found, exercises, events, marks, readAt: Date.now() }
}

const NOTHING: Loaded = { exercises: [], events: [], marks: [], readAt: 0 }

/**
 * The session screen. One exercise at a time, a set table, and nothing else
 * competing for the space — no tab bar, because the way out of a session is
 * finishing it or leaving it, not wandering into Records mid-set.
 *
 * There is no rest timer. The only clock on this screen is how long the session
 * has been running, and it is a fact recomputed when something happens, not a
 * countdown that pushes you back under the bar.
 */
export default function Session() {
  const navigate = useNavigate()
  const { dayId } = useParams<{ dayId: string }>()
  const [params] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Loaded>(NOTHING)
  const [today] = useState(todayLocalDate)

  // Read once, at the mount the directory sends us back to: where the session
  // was when it left, and how many movements the day held before the directory
  // wrote to it. Coming back to exercise 1 loses your place mid-workout.
  const [exerciseIndex, setExerciseIndex] = useState(() => whole(params.get('resume')) ?? 0)
  const [addedSince, setAddedSince] = useState<number | null>(() => whole(params.get('had')))
  const [chosenIndex, setChosenIndex] = useState<number | null>(null)
  /**
   * What has been typed, by row. A row absent from here is one nobody has
   * touched: whatever its fields show is a suggestion, and a suggestion is not
   * a set that happened.
   */
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const [undone, setUndone] = useState<{ row: number; values: SetValues } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const firstFieldRef = useRef<HTMLInputElement>(null)
  const advanceRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    loadSession(dayId).then((loaded) => {
      if (cancelled) return
      setData(loaded)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [dayId])

  const { settings, found, exercises, events, marks } = data

  // Focus lands on the next set only after a set is logged. Grabbing it on
  // arrival would open the keyboard over the table before you asked.
  useEffect(() => {
    if (!advanceRef.current) return
    advanceRef.current = false
    firstFieldRef.current?.focus()
  })

  if (loading) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6">
        <div className="h-6 w-32 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface)]" />
      </main>
    )
  }

  // A reader device never reaches a write. The route is not a back door.
  if (!settings || settings.deviceRole !== 'writer') return <Navigate to="/train" replace />

  if (!found || found.day.kind === 'rest' || found.day.entries.length === 0) {
    return (
      <main className="flex min-h-dvh flex-col gap-4 px-5 pt-[max(3.5rem,env(safe-area-inset-top))]">
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">No session here</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          That day has nothing to log.{' '}
          <Link to="/train" className="text-[var(--color-accent)] underline">
            Back to Train
          </Link>
        </p>
      </main>
    )
  }

  const { split, day } = found
  const units = settings.units
  const deviceId = settings.deviceId
  const trainingHabitId = settings.trainingHabitId
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const daySets = setsOnDate(events, today).filter((s) => s.splitDayId === day.id)
  const planned = plannedSetCount(day)
  const complete = isSessionComplete(marks, today, day.id)

  const setsFor = (entry: SplitEntry): LoggedSet[] =>
    daySets.filter((s) => s.exerciseId === entry.exerciseId).sort((a, b) => a.setIndex - b.setIndex)

  const index = Math.min(exerciseIndex, day.entries.length - 1)
  const entry = day.entries[index]
  const exercise = byId.get(entry.exerciseId)
  const isCardio = exercise?.category === 'cardio'
  const logged = setsFor(entry)
  const loggedByIndex = new Map(logged.map((s) => [s.setIndex, s]))

  const highestLogged = logged.reduce((max, s) => Math.max(max, s.setIndex), -1)
  let firstUnlogged: number | null = null
  for (let i = 0; i < entry.sets; i++) {
    if (!loggedByIndex.has(i)) {
      firstUnlogged = i
      break
    }
  }
  const activeIndex = chosenIndex ?? firstUnlogged
  const rowCount = Math.max(entry.sets, highestLogged + 1, (activeIndex ?? -1) + 1)
  const rows = Array.from({ length: rowCount }, (_, i) => i)

  const previous = lastSessionSets(setsForExercise(events, entry.exerciseId), today)
  const repTarget =
    entry.repsMin === entry.repsMax ? `${entry.repsMin}` : `${entry.repsMin}-${entry.repsMax}`
  // Anything the directory appended while we were away. Named on return, so a
  // movement added mid-session is confirmed rather than left to be found at
  // the bottom of the list.
  const added =
    addedSince === null
      ? []
      : day.entries.slice(addedSince).map((e) => byId.get(e.exerciseId)?.name ?? 'a movement')

  /** The set logged for a row, in the fields' own terms. Absent means unlogged. */
  function storedFor(target: number): Draft | undefined {
    const own = loggedByIndex.get(target)
    if (!own) return undefined
    return {
      weight: isCardio ? '' : weightValue(own.weightKg, units),
      reps: isCardio ? String(Math.round((own.durationSec ?? 0) / 60)) : String(own.reps),
      rpe: own.rpe === undefined ? '' : String(own.rpe),
    }
  }

  /**
   * What an empty field offers behind it: the set before this one, else this
   * set last time, else the length a circuit states. It shows as a placeholder
   * and never as a value, because a guess that looks like a typed number is a
   * guess that gets logged as one.
   */
  function suggestionFor(target: number): Draft {
    const before =
      logged.filter((s) => s.setIndex < target).at(-1) ??
      previous.find((s) => s.setIndex === target) ??
      previous[0]
    if (!before) {
      // A circuit states how long it runs, so that is the honest starting value.
      return exercise?.circuit
        ? { ...EMPTY_DRAFT, reps: String(exercise.circuit.durationMin) }
        : EMPTY_DRAFT
    }
    return {
      weight: isCardio ? '' : weightValue(before.weightKg, units),
      reps: isCardio ? String(Math.round((before.durationSec ?? 0) / 60)) : String(before.reps),
      rpe: '',
    }
  }

  /**
   * Every row is editable, always. A set table you can only type into one row
   * at a time is a form pretending to be a table — you cannot fix set 2 while
   * standing on set 4, which is exactly when you notice set 2 was wrong.
   *
   * A field holds what was typed into it or what is logged for it, and nothing
   * else. Anything the screen is merely suggesting sits behind it.
   */
  function valueFor(row: number): Draft {
    return drafts[row] ?? storedFor(row) ?? EMPTY_DRAFT
  }

  /**
   * What ticking a row commits: what you typed, and behind each field left
   * empty, the suggestion showing in it. What is on the screen is what gets
   * logged — one tap still logs a straight repeat of the set before.
   */
  function committedValue(row: number): Draft {
    const held = valueFor(row)
    const hint = suggestionFor(row)
    return {
      weight: held.weight.trim() || hint.weight,
      reps: held.reps.trim() || hint.reps,
      // Never guessed: last set's effort is not this set's effort.
      rpe: held.rpe,
    }
  }

  function setRow(row: number, next: Draft) {
    setDrafts((current) => ({ ...current, [row]: next }))
  }

  /** True once a row's fields differ from the set stored for it. */
  function isDirty(row: number): boolean {
    const held = drafts[row]
    if (!held) return false
    const stored = storedFor(row) ?? EMPTY_DRAFT
    return held.weight !== stored.weight || held.reps !== stored.reps || held.rpe !== stored.rpe
  }

  function moveTo(target: number | null, advance = false) {
    setChosenIndex(target)
    advanceRef.current = advance
  }

  function openExercise(next: number) {
    setExerciseIndex(next)
    setChosenIndex(null)
    setDrafts({})
    setError(null)
    setUndone(null)
    setAddedSince(null)
    // The new movement's header and its first rows sit above wherever you were
    // reading, so a switch that leaves the scroll alone reads as a dead tap.
    if (window.scrollY > 0) window.scrollTo({ top: 0 })
  }

  async function log(row: number, options: { advance?: boolean } = {}) {
    if (busy && options.advance !== false) return
    const value = committedValue(row)
    const reps = parse(value.reps)
    if (reps === undefined || reps <= 0) {
      setError(isCardio ? 'Give it a time in minutes.' : 'Give it a rep count.')
      return
    }
    const typed = parse(value.weight)
    if (!isCardio && typed === undefined) {
      setError('Give it a weight — bodyweight is 0.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await logSet(
        { localDate: today, splitDayId: day.id, exerciseId: entry.exerciseId, setIndex: row },
        isCardio
          ? { weightKg: 0, reps: 0, durationSec: Math.round(reps * 60) }
          : { weightKg: toKg(typed ?? 0, units), reps, rpe: parse(value.rpe) },
        deviceId,
      )
      setData(await loadSession(dayId))
      setUndone(null)
      // The row's draft is dropped so it falls back to what is now stored, and
      // the choice is cleared so focus lands on the first set still to do.
      setDrafts((current) => {
        const next = { ...current }
        delete next[row]
        return next
      })
      moveTo(null, options.advance !== false)
    } catch {
      setError("Couldn't save that set — try again.")
    } finally {
      setBusy(false)
    }
  }

  /**
   * Moving on commits what you typed. Anything typed in but not ticked is
   * logged first; a row with a weight and no reps (or the other way round) is
   * an accident, so it holds you there and says which one.
   *
   * A row nobody typed into is not logged, whatever it is showing. The rows
   * carry the values a set would most likely take, and treating a suggestion as
   * a set that happened writes sets that were never performed — three logged
   * sets out of one typed row, wrong records and a wrong volume behind them.
   * Ticking a row is how a suggestion becomes a set; walking past it is not.
   */
  /**
   * Commits every row that was typed into and not ticked, and says whether it
   * got through.
   *
   * Leaving a movement has to mean one thing. This used to live inside
   * "Next movement", so the same typed set survived that button and was thrown
   * away by Finish, or by tapping another movement in the list — the mirror of
   * the phantom-set bug, losing work you did instead of inventing work you
   * didn't. Every way out of a movement now goes through here.
   *
   * Returns false when a row is half-filled: the caller stops, the error names
   * the set, and the screen stays where the fixing has to happen.
   */
  async function commitTyped(): Promise<boolean> {
    if (busy) return false
    const pending: number[] = []
    for (const row of rows) {
      const typed = drafts[row]
      if (!typed) continue
      if (loggedByIndex.has(row) && !isDirty(row)) continue
      // Typed in and then cleared out is a set you did not do, and that is allowed.
      //
      // An effort with no weight and no reps behind it is the same: RPE rates a
      // set, it does not assert one. Committing it would let the suggestion
      // supply both real numbers, which is the phantom set arriving through a
      // narrower door. Ticking the row still logs it, because a tick is the
      // moment you say the set happened.
      if (!typed.weight.trim() && !typed.reps.trim()) continue
      const value = committedValue(row)
      const reps = parse(value.reps)
      const weight = parse(value.weight)
      if (reps === undefined || reps <= 0) {
        setChosenIndex(row)
        setError(
          isCardio
            ? `Set ${row + 1} has no time on it.`
            : `Set ${row + 1} has a weight but no reps.`,
        )
        return false
      }
      if (!isCardio && weight === undefined) {
        setChosenIndex(row)
        setError(`Set ${row + 1} has reps but no weight — bodyweight is 0.`)
        return false
      }
      pending.push(row)
    }

    setError(null)
    for (const row of pending) await log(row, { advance: false })
    return true
  }

  async function handleNext() {
    if (await commitTyped()) openExercise(index + 1)
  }

  /** Leaving for another movement in the list commits first, like moving on does. */
  async function goToExercise(next: number) {
    if (await commitTyped()) openExercise(next)
  }

  /**
   * Takes this movement out of the day. Sets already logged against it stay in
   * the event log — the exercise leaving the plan does not unmake the work —
   * so they still count toward records and still show on the calendar.
   */
  /**
   * Takes a movement out of the day. Any movement, not only the one you are
   * standing on — the machine you cannot get to is rarely the one in front of
   * you, and walking to a movement in order to delete it is a strange errand.
   *
   * Sets already logged against it stay in the record: this edits the plan, not
   * the history, and the two are different things.
   */
  async function removeMovement(target: number) {
    if (busy || day.entries.length <= 1) return
    setBusy(true)
    setError(null)
    try {
      const entries = day.entries.filter((_, i) => i !== target)
      const days = split.days.map((d) => (d.id === day.id ? { ...d, entries } : d))
      await updateSplit(split.id, { days })
      setData(await loadSession(dayId))
      if (target === index) {
        // The movement you were on is gone, and so is anything typed into it.
        openExercise(Math.max(0, Math.min(index, entries.length - 1)))
      } else {
        // Editing the plan elsewhere is not a reason to lose what you typed
        // here. Only the index shifts, and only when the list closed up above.
        setExerciseIndex(target < index ? index - 1 : index)
      }
    } catch {
      setError("Couldn't change the day — try that again.")
    } finally {
      setBusy(false)
    }
  }

  /**
   * Takes a set back out. The tick that does it is a 44pt target under a tired
   * thumb, so the removal is offered back rather than confirmed first — a
   * dialog between sets is worse than a way back afterwards.
   */
  async function remove(target: number) {
    const existing = loggedByIndex.get(target)
    if (!existing || busy) return
    setError(null)
    setBusy(true)
    const values: SetValues = {
      weightKg: existing.weightKg,
      reps: existing.reps,
      rpe: existing.rpe,
      durationSec: existing.durationSec,
    }
    try {
      await voidSet(
        { localDate: today, splitDayId: day.id, exerciseId: entry.exerciseId, setIndex: target },
        values,
        deviceId,
      )
      setData(await loadSession(dayId))
      // The draft that matched the set goes with it. Left behind, the next
      // "Next movement" would see a typed row on an unlogged set and write the
      // set straight back — the deletion undone by the walk away from it.
      setDrafts((current) => {
        const next = { ...current }
        delete next[target]
        return next
      })
      setUndone({ row: target, values })
      moveTo(target)
    } catch {
      setError("Couldn't remove that set — try again.")
    } finally {
      setBusy(false)
    }
  }

  /**
   * Puts back the set the last tick removed, by logging it again. The void
   * stays in the log where it happened — the way to undo an event is another
   * event, never a rewrite of the one before it.
   */
  async function restore() {
    if (!undone || busy) return
    const { row, values } = undone
    setError(null)
    setBusy(true)
    try {
      await logSet(
        { localDate: today, splitDayId: day.id, exerciseId: entry.exerciseId, setIndex: row },
        values,
        deviceId,
      )
      setData(await loadSession(dayId))
      setUndone(null)
      moveTo(row)
    } catch {
      setError("Couldn't put that set back — try again.")
    } finally {
      setBusy(false)
    }
  }

  async function finish() {
    if (busy) return
    // Finishing is the last way out of a movement, so it commits what is typed
    // first. A set entered and not ticked used to vanish here, silently, with
    // the screen gone before anyone could notice.
    if (!(await commitTyped())) return
    setBusy(true)
    try {
      await finishSession(today, day.id, deviceId, trainingHabitId)
      navigate('/train')
    } catch {
      setError("Couldn't log the session — try again.")
      setBusy(false)
    }
  }

  async function undoFinish() {
    if (busy) return
    setBusy(true)
    try {
      await unfinishSession(today, day.id, deviceId)
      setData(await loadSession(dayId))
    } catch {
      setError("Couldn't undo that — try again.")
    } finally {
      setBusy(false)
    }
  }


  const columns = isCardio ? '34px 1fr 44px' : '34px 1fr 1fr 46px 44px'
  const cell = 'bg-[var(--color-bg)] px-3 py-2.5 grid items-center gap-2'
  const inputClass =
    'min-h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-accent-700)] bg-[var(--color-bg)] px-2 text-base text-[var(--color-text-primary)] placeholder:italic placeholder:text-[var(--color-text-hint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]'

  return (
    <main className="flex min-h-dvh flex-col gap-4 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(3.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate('/train')}
          aria-label="Leave session"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          <CaretLeft size={16} aria-hidden="true" />
        </button>
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
              {day.label} · exercise {index + 1} of {day.entries.length}
            </span>
            {/* The bar underneath fills by sets. An exercise count on its own
                beside it reads as one broken fact — "exercise 3 of 12" over a
                bar at 6% — so the number the bar is drawing is stated too. */}
            <span className="shrink-0 text-[11px] tabular-nums text-[var(--color-text-secondary)]">
              {daySets.length} of {planned} sets
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Sets logged"
            aria-valuemin={0}
            aria-valuemax={planned}
            aria-valuenow={daySets.length}
            className="h-[3px] overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-border)]"
          >
            <span
              className="block h-full bg-[var(--color-accent)]"
              style={{ width: `${planned === 0 ? 0 : Math.min(100, (daySets.length / planned) * 100)}%` }}
            />
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-medium tracking-[-0.02em] text-[var(--color-text-primary)]">
          {exercise?.name ?? 'Unknown movement'}
        </h1>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {[
            exercise?.equipment,
            exercise?.muscleGroup?.toLowerCase(),
            previous.length > 0
              ? `last time ${summariseSets(previous, units, isCardio)}`
              : // Today's own sets are right there in the table, and may well
                // be a record. What is missing is a session before this one.
                'no earlier session',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>

        {/* The rounds, where you actually read them: between sets, mid-circuit,
            on the screen you already have open. The circuit itself is logged by
            time, so these are reference rather than rows to tick. */}
        {exercise?.circuit && (
          <section
            aria-label={`${exercise.name} rounds`}
            className="mt-3 flex flex-col gap-1 rounded-[var(--radius-md)] bg-[var(--color-surface)] p-3"
          >
            <p className="text-xs text-[var(--color-text-secondary)]">
              {exercise.circuit.durationMin} min · {exercise.circuit.restNote}
            </p>
            <ul className="flex flex-col">
              {exercise.circuit.steps.map((step) => (
                <li
                  key={step.name}
                  className="flex items-baseline justify-between gap-3 py-1.5"
                  style={{ borderBottom: '1px solid var(--color-divider)' }}
                >
                  <span className="text-sm text-[var(--color-text-primary)]">{step.name}</span>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {step.reps} reps
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-[var(--color-text-secondary)]">
          {error}
        </p>
      )}

      {added.length > 0 && (
        <p role="status" className="text-xs text-[var(--color-text-secondary)]">
          {added.join(' and ')} added to the end of {day.label}.
        </p>
      )}

      <div
        className="flex flex-col gap-px overflow-hidden rounded-[var(--radius-md)]"
        style={{ background: 'var(--color-divider)' }}
      >
        <div className={cell} style={{ gridTemplateColumns: columns }}>
          <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
            Set
          </span>
          {isCardio ? (
            <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
              Minutes
            </span>
          ) : (
            <>
              <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
                {units}
              </span>
              <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
                Reps
              </span>
              <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
                RPE
              </span>
            </>
          )}
          <span />
        </div>

        {rows.map((row) => {
          const done = loggedByIndex.get(row)
          const isActive = row === activeIndex
          const value = valueFor(row)
          const hint = suggestionFor(row)
          return (
            <div
              key={row}
              className={cell}
              style={{
                gridTemplateColumns: columns,
                background: isActive ? 'var(--color-surface)' : undefined,
                boxShadow: isActive ? 'inset 0 0 0 1px var(--color-accent)' : undefined,
              }}
            >
              <span
                className="text-[13px]"
                style={{
                  color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                }}
              >
                {row + 1}
              </span>

              {/* Fields, on every row. A logged row shows what it holds and
                  can be corrected in place. An unlogged one is empty, with the
                  values it would most likely take showing behind it — the tick
                  takes them, moving on never does, and the two states do not
                  look alike. */}
              {!isCardio && (
                <input
                  ref={isActive ? firstFieldRef : undefined}
                  inputMode="decimal"
                  aria-label={`Weight for set ${row + 1} in ${units}`}
                  placeholder={hint.weight}
                  value={value.weight}
                  onFocus={() => setChosenIndex(row)}
                  onChange={(e) => setRow(row, { ...value, weight: e.target.value })}
                  className={inputClass}
                />
              )}
              <input
                ref={isCardio && isActive ? firstFieldRef : undefined}
                inputMode="numeric"
                aria-label={isCardio ? `Minutes for set ${row + 1}` : `Reps for set ${row + 1}`}
                placeholder={hint.reps || (isCardio ? 'min' : repTarget)}
                value={value.reps}
                onFocus={() => setChosenIndex(row)}
                onChange={(e) => setRow(row, { ...value, reps: e.target.value })}
                className={inputClass}
              />
              {!isCardio && (
                <input
                  inputMode="decimal"
                  aria-label={`RPE for set ${row + 1}, optional`}
                  value={value.rpe}
                  onFocus={() => setChosenIndex(row)}
                  onChange={(e) => setRow(row, { ...value, rpe: e.target.value })}
                  className={`${inputClass} border-[var(--color-border)]`}
                />
              )}

              {/* One control per row: log it, save a correction, or take it back. */}
              {done && !isDirty(row) ? (
                <button
                  onClick={() => remove(row)}
                  disabled={busy}
                  aria-label={`Set ${row + 1} logged — remove it`}
                  className="flex h-11 w-11 items-center justify-center justify-self-end rounded-full disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 items-center justify-center rounded-full"
                    style={{
                      background: 'var(--color-complete-fill)',
                      boxShadow: 'inset 0 0 0 1px var(--color-complete-ring)',
                    }}
                  >
                    <Check size={12} color="var(--color-complete-mark)" />
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => log(row)}
                  disabled={busy}
                  aria-label={done ? `Save set ${row + 1}` : `Log set ${row + 1}`}
                  className="flex h-11 w-11 items-center justify-center justify-self-end rounded-full text-[var(--color-accent)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 items-center justify-center rounded-full"
                    style={{ boxShadow: 'inset 0 0 0 1px var(--color-accent)' }}
                  >
                    <Check size={12} />
                  </span>
                </button>
              )}
            </div>
          )
        })}
      </div>

      {undone && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] py-1 pl-4 pr-2"
        >
          <span className="text-sm text-[var(--color-text-secondary)]">
            Set {undone.row + 1} removed.
          </span>
          <button
            onClick={() => void restore()}
            disabled={busy}
            className="flex min-h-11 items-center px-3 text-sm font-medium text-[var(--color-accent)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            Undo
          </button>
        </div>
      )}

      {/* Rows carry their own log, save and remove now, so the only thing
          left for the bar is making a row that is not prescribed. */}
      <button
        onClick={() => moveTo(Math.max(entry.sets, highestLogged + 1, (activeIndex ?? -1) + 1))}
        className="flex min-h-12 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-5 text-sm text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      >
        Add a set
      </button>

      {/* Where your thumb already is when the last set goes in. Without it the
          only way on was scrolling to a list at the bottom of the screen. */}
      {index < day.entries.length - 1 ? (
        <button
          onClick={handleNext}
          className="flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-accent)] px-5 text-[15px] font-medium text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          Next movement
          <CaretRight size={15} aria-hidden="true" />
        </button>
      ) : null}

      <p className="text-xs text-[var(--color-text-secondary)]">
        No timer — rest as long as you like.
      </p>

      <div className="flex gap-2">
          <Link
            to={`/exercises?splitId=${split.id}&dayId=${day.id}&return=${encodeURIComponent(
              `/train/session/${day.id}?resume=${index}&had=${day.entries.length}`,
            )}`}
            className="flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 text-sm text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            Add a movement
          </Link>
          <button
            onClick={() => removeMovement(index)}
            disabled={busy || day.entries.length <= 1}
            className="flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 text-sm text-[var(--color-text-secondary)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            Remove from this day
          </button>
      </div>
      <section className="flex flex-col gap-2">
        <SectionHeading>Rest of the session</SectionHeading>
        <ul className="flex flex-col">
          {day.entries.map((other, i) => {
            if (i === index) return null
            const otherExercise = byId.get(other.exerciseId)
            const otherSets = setsFor(other)
            const otherDone = otherSets.length >= other.sets
            return (
              <li
                key={`${other.exerciseId}-${i}`}
                className="flex items-center gap-1"
                style={{ borderBottom: '1px solid var(--color-divider)' }}
              >
                <button
                  onClick={() => goToExercise(i)}
                  className="flex min-h-11 flex-1 items-center gap-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <span
                    className="flex-1 text-sm"
                    style={{
                      color: otherDone ? 'var(--color-text-done)' : 'var(--color-text-primary)',
                      textDecoration: otherDone ? 'line-through' : 'none',
                    }}
                  >
                    {otherExercise?.name ?? 'Unknown movement'}
                  </span>
                  <span className="text-[11px] text-[var(--color-text-secondary)]">
                    {otherSets.length > 0
                      ? `${otherSets.length} ${otherSets.length === 1 ? 'set' : 'sets'}`
                      : describePrescription(other, otherExercise)}
                  </span>
                </button>
                {/* The machine you cannot get to is rarely the movement you are
                    standing on, so every row can leave the day from here. */}
                <button
                  onClick={() => removeMovement(i)}
                  disabled={busy || day.entries.length <= 1}
                  aria-label={`Remove ${otherExercise?.name ?? 'this movement'} from this day`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center text-[var(--color-text-secondary)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <span aria-hidden="true" className="text-base leading-none">
                    −
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        {complete ? (
          <>
            <p className="text-center text-sm text-[var(--color-text-secondary)]">
              {split.name} · {day.label} is logged for today.
            </p>
            <button
              onClick={undoFinish}
              disabled={busy}
              className="flex min-h-12 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-5 text-sm text-[var(--color-text-secondary)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            >
              Reopen this session
            </button>
          </>
        ) : (
          <button
            onClick={finish}
            disabled={busy}
            className="flex min-h-12 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-5 text-sm text-[var(--color-text-primary)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            Finish and log the session
          </button>
        )}
      </div>
    </main>
  )
}
