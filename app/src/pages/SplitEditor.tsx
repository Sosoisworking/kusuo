import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import BackLink from '../components/BackLink'
import { listExercises } from '../db/exercises'
import type { Exercise, Split, SplitDay, SplitEntry, WeekStart } from '../db/schema'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import {
  addSplitDay,
  getSplit,
  removeSplitDay,
  renameSplitDay,
  setSplitDayKind,
  updateSplit,
} from '../db/splits'
import { todayLocalDate } from '../lib/date'
import { dayForDate, formatPrescription, plannedSetCount } from '../logic/nextSession'

/**
 * A row keyed independently of its position. Entries carry no id of their own,
 * and keying by index would remount every row on a reorder — losing focus mid
 * drag, which is exactly when it matters.
 */
interface Row {
  key: string
  entry: SplitEntry
}

function toRows(entries: SplitEntry[]): Row[] {
  return entries.map((entry) => ({ key: crypto.randomUUID(), entry: { ...entry } }))
}

const SWIPE_WIDTH = 68
const SWIPE_THRESHOLD = 34
/** Past this much horizontal movement the gesture is a swipe, not a scroll. */
const AXIS_LOCK = 8

function NumberField({
  label,
  value,
  min,
  onChange,
}: {
  label: string
  value: number
  min: number
  onChange: (next: number) => void
}) {
  /*
    The field holds text while you are typing in it, and a number the moment you
    leave. Clamping on every keystroke made these unusable: the floor is 1, so
    clearing the box put a 1 straight back, and typing 12 over it gave 112. A
    field that argues with each character is worse than one that waits.
  */
  const [draft, setDraft] = useState<string | null>(null)

  function commit(text: string) {
    setDraft(null)
    const next = Number(text)
    // Left empty, or left as something that is not a number, means the value
    // was never really changed.
    if (text.trim() === '' || !Number.isFinite(next)) return
    onChange(Math.max(min, Math.trunc(next)))
  }

  return (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className="min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-3 text-base text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      />
    </label>
  )
}

export default function SplitEditor() {
  const { splitId } = useParams<{ splitId: string }>()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [isReader, setIsReader] = useState(false)
  const [weekStart, setWeekStart] = useState<WeekStart>('monday')
  const [split, setSplit] = useState<Split | undefined>()
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [dayLabel, setDayLabel] = useState('')

  const [undone, setUndone] = useState<{ row: Row; index: number } | null>(null)
  const [confirmingDayRemoval, setConfirmingDayRemoval] = useState(false)

  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [swipedKey, setSwipedKey] = useState<string | null>(null)
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const [swipeOffset, setSwipeOffset] = useState<{ key: string; dx: number } | null>(null)

  const [exercises, setExercises] = useState<Exercise[]>([])
  const rowRefs = useRef(new Map<string, HTMLLIElement>())
  /** Where the dragging finger last was, so the scroll loop can read it. */
  const pointerY = useRef(0)
  const gesture = useRef<{ x: number; y: number; axis: 'none' | 'x' | 'y' } | null>(null)

  const dayId = params.get('day')

  const load = useCallback(async () => {
    const [settings, found, list] = await Promise.all([
      getSettings(getOrCreateDeviceId()),
      splitId ? getSplit(splitId) : Promise.resolve(undefined),
      listExercises(),
    ])
    setIsReader(settings?.deviceRole === 'reader')
    setWeekStart(settings?.weekStart ?? 'monday')
    setSplit(found)
    setExercises(list)
  }, [splitId])

  useEffect(() => {
    let cancelled = false
    // Deferred to a microtask: calling `load` straight from the effect body
    // reads as a synchronous setState, and the first paint should be the
    // skeleton rather than a half-populated editor.
    void Promise.resolve()
      .then(load)
      .then(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [load])

  /*
    The day you asked for, then the day you are actually due to train. Falling
    straight to `days[0]` meant every Edit — from the card, from a chip, on a
    Thursday — opened on day one, so the first thing the editor asked you to do
    was find your way back to where you already were.
  */
  const day: SplitDay | undefined =
    split &&
    (split.days.find((d) => d.id === dayId) ??
      dayForDate(split, todayLocalDate(), weekStart) ??
      split.days[0])

  // Rebuild the rows when the selected day changes. Keyed on the day id so
  // switching days does not carry one day's ordering into another.
  const loadedDayId = useRef<string | null>(null)
  useEffect(() => {
    if (!day || loadedDayId.current === day.id) return
    loadedDayId.current = day.id
    setDayLabel(day.label)
    setRows(toRows(day.entries))
    setExpandedKey(null)
    setSwipedKey(null)
    // Both belong to the day you were on, not to the one you moved to.
    setUndone(null)
    setConfirmingDayRemoval(false)
  }, [day])

  useEffect(() => {
    if (day && loadedDayId.current === day.id) setDayLabel(day.label)
  }, [day])

  const byId = new Map(exercises.map((e) => [e.id, e]))

  async function persist(nextRows: Row[]) {
    if (!split || !day || isReader) return
    const days = split.days.map((d) =>
      d.id === day.id ? { ...d, entries: nextRows.map((r) => ({ ...r.entry })) } : d,
    )
    setRows(nextRows)
    setSplit({ ...split, days })
    setError(null)
    try {
      await updateSplit(split.id, { days })
    } catch {
      setError("Couldn't save that change — try it again.")
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= rows.length || from === to) return
    const next = [...rows]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setUndone(null)
    void persist(next)
    const name = byId.get(moved.entry.exerciseId)?.name ?? 'Movement'
    setAnnouncement(`${name} moved to position ${to + 1} of ${next.length}`)
  }

  /**
   * Removal stays one tap and gains a way back, rather than gaining a dialog.
   * Both routes in — the swipe and the panel button — are gestures you make
   * while looking at the row, so the answer to a misfire is undo, not a
   * question asked before every correct removal.
   */
  function remove(index: number) {
    const row = rows[index]
    const name = byId.get(row.entry.exerciseId)?.name ?? 'Movement'
    setSwipedKey(null)
    setExpandedKey(null)
    setUndone({ row, index })
    void persist(rows.filter((_, i) => i !== index))
    setAnnouncement(`${name} removed. Undo sits under the list.`)
  }

  function undoRemove() {
    if (!undone) return
    const name = byId.get(undone.row.entry.exerciseId)?.name ?? 'Movement'
    const next = [...rows]
    // Back where it was, unless the list has since grown shorter than that.
    next.splice(Math.min(undone.index, next.length), 0, undone.row)
    setUndone(null)
    void persist(next)
    setAnnouncement(`${name} put back`)
  }

  function setEntry(index: number, changes: Partial<SplitEntry>) {
    const next = rows.map((row, i) =>
      i === index ? { ...row, entry: { ...row.entry, ...changes } } : row,
    )
    setUndone(null)
    void persist(next)
  }

  // --- gestures ---------------------------------------------------------
  // One per row at a time: a drag closes any open swipe and locks swiping out
  // for its duration, and starting a swipe on one row closes the other.

  function startDrag(key: string, event: React.PointerEvent) {
    if (isReader) return
    // Deliberately no `setPointerCapture`. The capture used to be taken on the
    // handle, and the first swap re-parents the row it lives in, which drops
    // the capture on the floor. The window listeners below do the job instead
    // and cannot be re-parented out from under a finger.
    pointerY.current = event.clientY
    setSwipedKey(null)
    setSwipeOffset(null)
    setDraggingKey(key)
  }

  /** Reorders around the pointer's position on the screen. */
  function dragTo(y: number) {
    if (!draggingKey) return
    const current = rows.findIndex((r) => r.key === draggingKey)
    if (current === -1) return
    const above = rows[current - 1] && rowRefs.current.get(rows[current - 1].key)
    const below = rows[current + 1] && rowRefs.current.get(rows[current + 1].key)
    if (above) {
      const rect = above.getBoundingClientRect()
      if (y < rect.top + rect.height / 2) return move(current, current - 1)
    }
    if (below) {
      const rect = below.getBoundingClientRect()
      if (y > rect.top + rect.height / 2) return move(current, current + 1)
    }
  }

  // The drag effect runs for the life of one drag, so it reaches the current
  // row order through a ref rather than by re-subscribing on every swap.
  const dragToRef = useRef(dragTo)
  useEffect(() => {
    dragToRef.current = dragTo
  })

  /*
    A drag belongs to the window, not to the handle that started it.

    Wired to the handle's own pointer events, a finger lifted anywhere else —
    over the movement's name, or in the gap between two rows — never ended the
    drag. The row stayed marked "dragging", which disabled swipe-to-remove on
    every row in the day, and the next pointer to pass over any handle with no
    button held reordered the day and saved it.

    While a drag is live the page also scrolls when the pointer nears an edge,
    because on a long day the row you are aiming for is often below the fold,
    and a drag that cannot reach it is a drag that cannot be finished.
  */
  useEffect(() => {
    if (!draggingKey) return

    let moved = false
    function onMove(event: PointerEvent) {
      event.preventDefault()
      moved = true
      pointerY.current = event.clientY
      dragToRef.current(event.clientY)
    }
    function stop() {
      setDraggingKey(null)
    }

    /*
      Scrolling waits for the finger to actually move.

      Started on press, a hold on a row near the bottom of the screen scrolled
      at ~720px/s and walked the row down the list on its own — a press that was
      never a drag reordering the day and saving it. `moved` is set by the first
      pointermove, so a press that never becomes a drag does nothing at all.
    */
    let frame = 0
    function scrollStep() {
      if (moved) {
        const y = pointerY.current
        const edge = 72
        const speed = 12
        if (y < edge) window.scrollBy(0, -speed)
        else if (y > window.innerHeight - edge) window.scrollBy(0, speed)
        // The rows moved under a still finger, so ask again where it now sits.
        dragToRef.current(y)
      }
      frame = requestAnimationFrame(scrollStep)
    }
    frame = requestAnimationFrame(scrollStep)

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    // A drag interrupted by the app going away is over, not paused.
    window.addEventListener('blur', stop)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      window.removeEventListener('blur', stop)
    }
  }, [draggingKey])

  function handleKey(index: number, event: React.KeyboardEvent) {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      move(index, index - 1)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(index, index + 1)
    }
  }

  function startSwipe(key: string, event: React.PointerEvent) {
    if (isReader || draggingKey) return
    if ((event.target as HTMLElement).closest('[data-no-swipe]')) return
    gesture.current = { x: event.clientX, y: event.clientY, axis: 'none' }
    if (swipedKey && swipedKey !== key) setSwipedKey(null)
  }

  function swipeMove(key: string, event: React.PointerEvent) {
    const start = gesture.current
    if (!start || draggingKey) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (start.axis === 'none') {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return
      start.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (start.axis !== 'x') return
    const base = swipedKey === key ? -SWIPE_WIDTH : 0
    setSwipeOffset({ key, dx: Math.min(0, Math.max(-SWIPE_WIDTH, base + dx)) })
  }

  function endSwipe(key: string) {
    const offset = swipeOffset
    gesture.current = null
    setSwipeOffset(null)
    if (!offset || offset.key !== key) return
    setSwipedKey(offset.dx <= -SWIPE_THRESHOLD ? key : null)
  }

  async function addDay() {
    if (!split) return
    const created = await addSplitDay(split.id, `Day ${split.days.length + 1}`)
    await load()
    setParams({ day: created.id }, { replace: true })
    setAnnouncement(`${created.label} added`)
  }

  async function saveDayLabel() {
    if (!split || !day || dayLabel.trim() === day.label) return
    await renameSplitDay(split.id, day.id, dayLabel)
    await load()
  }

  async function toggleRest(target: SplitDay) {
    if (!split) return
    await setSplitDayKind(split.id, target.id, target.kind === 'rest' ? 'training' : 'rest')
    await load()
    setAnnouncement(
      target.kind === 'rest' ? `${target.label} is a training day` : `${target.label} is a rest day`,
    )
  }

  /**
   * Sessions already logged against this day stay in the event log — removing
   * it from the plan does not unmake the training.
   */
  async function deleteDay(target: SplitDay) {
    if (!split || split.days.length <= 1) return
    setConfirmingDayRemoval(false)
    await removeSplitDay(split.id, target.id)
    const remaining = split.days.filter((d) => d.id !== target.id)
    await load()
    setParams(remaining[0] ? { day: remaining[0].id } : {}, { replace: true })
    setAnnouncement(`${target.label} removed`)
  }

  if (loading) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6">
        <div className="h-6 w-32 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface)]" />
      </main>
    )
  }
  // The Mac never reaches an editor. Absent, not disabled — the route itself
  // hands back to the read-only screen rather than rendering a dead form.
  if (isReader) return <Navigate to="/splits" replace />

  if (!split) {
    return (
      <main className="flex min-h-dvh flex-col gap-4 px-5 pb-8 pt-[var(--space-safe-top)]">
        <BackLink to="/splits" />
        <p className="text-sm text-[var(--color-text-secondary)]">
          That split is not on this device. Pick one in Splits.
        </p>
      </main>
    )
  }

  // A split you have just started has no days yet. That is a beginning, not a
  // missing record, and it says so.
  if (!day) {
    return (
      <main className="flex min-h-dvh flex-col gap-4 px-5 pb-8 pt-[var(--space-safe-top)]">
        <div className="flex items-center justify-between gap-3">
          <BackLink to="/splits" />
          <button
            onClick={() => navigate('/splits')}
            className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            Done
          </button>
        </div>
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">{split.name}</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          No days yet. Add the first one and start putting movements in it.
        </p>
        <button
          onClick={addDay}
          className="flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-accent)] px-5 text-sm font-medium text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          Add the first day
        </button>
      </main>
    )
  }

  const isRest = day.kind === 'rest'
  const pickerQuery = `?splitId=${split.id}&dayId=${day.id}`

  return (
    <main className="flex min-h-dvh flex-col gap-4 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[var(--space-safe-top)]">
      <div className="flex items-center justify-between gap-3">
        <BackLink to="/splits" />
        <button
          onClick={() => navigate('/splits')}
          className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          Done
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-accent)]">
          {split.name}
        </span>
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">Edit {day.label}</h1>
      </div>

      {error && (
        <p role="alert" className="text-xs text-[var(--color-text-secondary)]">
          {error}
        </p>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div role="tablist" aria-label="Days" className="flex flex-wrap gap-1.5">
        {split.days.map((d) => {
          const selected = d.id === day.id
          return (
            <button
              key={d.id}
              id={`day-tab-${d.id}`}
              role="tab"
              aria-selected={selected}
              aria-controls="day-panel"
              onClick={() => setParams({ day: d.id }, { replace: true })}
              className="min-h-11 flex-1 rounded-[var(--radius-sm)] px-3 text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              style={{
                border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: selected ? 'var(--color-complete-fill)' : 'transparent',
                color: selected ? 'var(--color-complete-mark)' : 'var(--color-text-secondary)',
                fontWeight: selected ? 500 : 400,
              }}
            >
              {d.label}
            </button>
          )
        })}
        <button
          onClick={addDay}
          aria-label="Add a day"
          className="min-h-11 rounded-[var(--radius-sm)] px-4 text-[13px] text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          style={{ border: '1px dashed var(--color-border)' }}
        >
          + Day
        </button>
      </div>

      {/* Renaming, resting and removing the day you are looking at. A split you
          cannot restructure is a template with extra steps. */}
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--color-text-secondary)]">Day name</span>
          <input
            value={dayLabel}
            onChange={(e) => setDayLabel(e.target.value)}
            onBlur={saveDayLabel}
            className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-base text-[var(--color-text-primary)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          />
        </label>
        {/*
          Removing a day takes the whole plan for it with it, and there is no
          undo for that the way there is for a single movement — so it asks
          first. The way out is the bordered accent button; removing is bare
          text, which is the only hierarchy available in a palette with no red.
        */}
        {confirmingDayRemoval ? (
          <div
            className="flex flex-col gap-2 rounded-[var(--radius-md)] p-3"
            style={{ boxShadow: 'inset 0 0 0 1px var(--color-border)' }}
          >
            <p className="text-sm text-[var(--color-text-primary)]">
              Remove {day.label} from {split.name}?
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {isRest
                ? 'A rest day, so nothing is planned in it.'
                : `${rows.length} ${rows.length === 1 ? 'movement goes' : 'movements go'} with it.`}{' '}
              Sessions you have already logged against this day stay in your history.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmingDayRemoval(false)}
                className="flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              >
                Keep it
              </button>
              <button
                onClick={() => deleteDay(day)}
                className="flex min-h-11 min-w-0 flex-1 items-center justify-center truncate px-4 text-sm text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              >
                Remove {day.label}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => toggleRest(day)}
              aria-pressed={day.kind === 'rest'}
              className="flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-md)] text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              style={{
                color: day.kind === 'rest' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                boxShadow: `inset 0 0 0 1px ${day.kind === 'rest' ? 'var(--color-accent)' : 'var(--color-border)'}`,
              }}
            >
              Rest day
            </button>
            <button
              onClick={() => setConfirmingDayRemoval(true)}
              disabled={split.days.length <= 1}
              className="flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-md)] text-sm text-[var(--color-text-secondary)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              style={{ boxShadow: 'inset 0 0 0 1px var(--color-border)' }}
            >
              Remove day
            </button>
          </div>
        )}
      </div>

      <div
        id="day-panel"
        role="tabpanel"
        aria-labelledby={`day-tab-${day.id}`}
        className="flex flex-col gap-4"
      >
        {isRest ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            A rest day. It holds no exercises — it is a day in the cycle, not a gap in it.
          </p>
        ) : (
          <>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {rows.length} exercises · {plannedSetCount({ ...day, entries: rows.map((r) => r.entry) })}{' '}
            sets
          </p>

          <ul className="flex flex-col gap-1.5">
            {rows.map((row, index) => {
              const exercise = byId.get(row.entry.exerciseId)
              const name = exercise?.name ?? 'Unknown movement'
              const isDragging = draggingKey === row.key
              const isExpanded = expandedKey === row.key
              const offset =
                swipeOffset?.key === row.key
                  ? swipeOffset.dx
                  : swipedKey === row.key
                    ? -SWIPE_WIDTH
                    : 0
              const prescription = formatPrescription(row.entry, exercise?.category)
              return (
                <li
                  key={row.key}
                  ref={(el) => {
                    if (el) rowRefs.current.set(row.key, el)
                    else rowRefs.current.delete(row.key)
                  }}
                  className="flex items-stretch overflow-hidden rounded-[var(--radius-md)]"
                  style={{
                    border: `1px solid ${isDragging ? 'var(--color-accent-700)' : 'var(--color-border)'}`,
                    boxShadow: isDragging ? 'var(--shadow-md)' : 'none',
                    background: 'var(--color-bg)',
                  }}
                  onPointerDown={(e) => startSwipe(row.key, e)}
                  onPointerMove={(e) => swipeMove(row.key, e)}
                  onPointerUp={() => endSwipe(row.key)}
                  onPointerCancel={() => endSwipe(row.key)}
                >
                  {/*
                    Revealing Remove narrows the row rather than sliding it
                    out from under itself — a translated row pushes its own
                    drag handle and the start of the movement's name off the
                    left edge, which is how you lose track of which row you
                    are about to delete.
                  */}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <button
                        data-no-swipe
                        aria-label={`Reorder ${name}. Position ${index + 1} of ${rows.length}. Use the up and down arrow keys.`}
                        onPointerDown={(e) => startDrag(row.key, e)}
                        onKeyDown={(e) => handleKey(index, e)}
                        className="flex h-11 w-11 shrink-0 cursor-grab items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                        style={{
                          touchAction: 'none',
                          color: isDragging ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                        }}
                      >
                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                          <circle cx="7" cy="5" r="1.3" />
                          <circle cx="13" cy="5" r="1.3" />
                          <circle cx="7" cy="10" r="1.3" />
                          <circle cx="13" cy="10" r="1.3" />
                          <circle cx="7" cy="15" r="1.3" />
                          <circle cx="13" cy="15" r="1.3" />
                        </svg>
                      </button>

                      <button
                        data-no-swipe
                        onClick={() => {
                          // Opening the targets panel is the third gesture on
                          // this row, so it closes the swipe rather than
                          // stacking on top of it.
                          setSwipedKey(null)
                          setExpandedKey(isExpanded ? null : row.key)
                        }}
                        aria-expanded={isExpanded}
                        className="flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-px py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                      >
                        <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                          {name}
                        </span>
                        <span
                          className="truncate text-[11px]"
                          style={{
                            color: isDragging
                              ? 'var(--color-accent)'
                              : 'var(--color-text-secondary)',
                          }}
                        >
                          {prescription || 'Cardio'}
                          {isDragging && ' · dragging'}
                        </span>
                      </button>

                      <button
                        data-no-swipe
                        onClick={() =>
                          navigate(`/exercises${pickerQuery}&swap=${index}`)
                        }
                        aria-label={`Swap ${name}`}
                        className="flex min-h-11 shrink-0 items-center px-2 text-xs text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                      >
                        Swap
                      </button>
                    </div>

                    {isExpanded && (
                      <div
                        data-no-swipe
                        className="flex flex-col gap-3 px-2 pb-3 pt-1"
                        style={{ borderTop: '1px solid var(--color-divider)' }}
                      >
                        {exercise?.category === 'cardio' ? (
                          <p className="pt-2 text-xs text-[var(--color-text-secondary)]">
                            Cardio is logged by time, so it carries no set or rep target.
                          </p>
                        ) : (
                          <div className="flex gap-2 pt-2">
                            <NumberField
                              label="Sets"
                              min={1}
                              value={row.entry.sets}
                              onChange={(sets) => setEntry(index, { sets })}
                            />
                            <NumberField
                              label="Reps from"
                              min={1}
                              value={row.entry.repsMin}
                              onChange={(repsMin) =>
                                setEntry(index, {
                                  repsMin,
                                  repsMax: Math.max(repsMin, row.entry.repsMax),
                                })
                              }
                            />
                            <NumberField
                              label="Reps to"
                              min={1}
                              value={row.entry.repsMax}
                              onChange={(repsMax) =>
                                setEntry(index, {
                                  repsMax,
                                  repsMin: Math.min(repsMax, row.entry.repsMin),
                                })
                              }
                            />
                          </div>
                        )}
                        <button
                          onClick={() => remove(index)}
                          className="min-h-11 self-start rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 text-sm text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                        >
                          Remove from {day.label}
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => remove(index)}
                    aria-label={`Remove ${name}`}
                    tabIndex={swipedKey === row.key ? 0 : -1}
                    aria-hidden={swipedKey !== row.key}
                    data-no-swipe
                    className="flex shrink-0 flex-col items-center justify-center gap-1 overflow-hidden whitespace-nowrap text-[10px] text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                    style={{
                      width: `${-offset}px`,
                      borderLeft: offset === 0 ? 'none' : '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      transition:
                        swipeOffset?.key === row.key
                          ? 'none'
                          : 'width var(--duration-fast) var(--ease-standard)',
                    }}
                  >
                    <svg
                      viewBox="0 0 20 20"
                      className="h-4 w-4 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.6}
                      aria-hidden="true"
                    >
                      <path
                        d="M4 6h12M8 6V4h4v2M6.5 6l.7 10h5.6l.7-10"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>

          {undone && (
            <div
              className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] pl-3"
              style={{ boxShadow: 'inset 0 0 0 1px var(--color-border)' }}
            >
              <span className="min-w-0 truncate text-xs text-[var(--color-text-secondary)]">
                Removed {byId.get(undone.row.entry.exerciseId)?.name ?? 'Movement'}
              </span>
              {/* No timer on it. It waits until you do something else, because
                  a countdown is one more thing running while you are editing. */}
              <button
                onClick={undoRemove}
                className="min-h-11 shrink-0 px-4 text-sm font-medium text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              >
                Undo
              </button>
            </div>
          )}

          <button
            onClick={() => navigate(`/exercises${pickerQuery}`)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            >
              Add an exercise
            </button>
          </>
        )}
      </div>

      <p
        className="mt-auto text-xs leading-relaxed text-[var(--color-text-secondary)]"
        style={{ borderLeft: '1px solid var(--color-accent-800)', paddingLeft: '10px' }}
      >
        Drag the handle to reorder, or focus it and use the arrow keys. Swipe a row left to remove
        it — Undo appears under the list. Your edits stay with this split.
      </p>
    </main>
  )
}
