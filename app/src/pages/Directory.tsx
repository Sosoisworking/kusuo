import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import AddExerciseSheet from '../components/AddExerciseSheet'
import BackLink from '../components/BackLink'
import { filterExercises, listExercises, recentExerciseIds } from '../db/exercises'
import type { Exercise, ExerciseCategory, SessionEvent, Split, SplitDay } from '../db/schema'
import { allSessionEvents } from '../db/sessions'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import { getSplit, updateSplit } from '../db/splits'
import { EXERCISE_ATTRIBUTION } from '../lib/exerciseSeed'

const CATEGORIES: { value: ExerciseCategory; label: string }[] = [
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'legs', label: 'Legs' },
  { value: 'abs', label: 'Abs' },
  { value: 'cardio', label: 'Cardio' },
]

/** Equipment sections in the order the canvas shows them; anything else follows. */
const EQUIPMENT_ORDER = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Other']

function equipmentRank(name: string): number {
  const index = EQUIPMENT_ORDER.indexOf(name)
  return index === -1 ? EQUIPMENT_ORDER.length : index
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className="min-h-11 rounded-full px-3.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      style={{
        border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
        background: selected ? 'var(--color-complete-fill)' : 'transparent',
        color: selected ? 'var(--color-complete-mark)' : 'var(--color-text-secondary)',
        fontWeight: selected ? 500 : 400,
      }}
    >
      {label}
    </button>
  )
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (next: string) => void
}) {
  const selected = value !== ''
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-11 rounded-full px-3.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      style={{
        border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
        background: selected ? 'var(--color-complete-fill)' : 'transparent',
        color: selected ? 'var(--color-complete-mark)' : 'var(--color-text-secondary)',
      }}
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}

export default function Directory() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const splitId = params.get('splitId')
  const dayId = params.get('dayId')
  const swapParam = params.get('swap')
  const swapIndex = swapParam === null ? null : Number(swapParam)

  const [loading, setLoading] = useState(true)
  const [isReader, setIsReader] = useState(false)
  const [defaultSets, setDefaultSets] = useState(3)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [split, setSplit] = useState<Split | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ExerciseCategory | ''>('')
  const [muscleGroup, setMuscleGroup] = useState('')
  const [equipment, setEquipment] = useState('')
  const [recentOnly, setRecentOnly] = useState(false)
  const [mineOnly, setMineOnly] = useState(false)

  const load = useCallback(async () => {
    const [settings, list, ev, found] = await Promise.all([
      getSettings(getOrCreateDeviceId()),
      listExercises(),
      allSessionEvents(),
      splitId ? getSplit(splitId) : Promise.resolve(undefined),
    ])
    setIsReader(settings?.deviceRole === 'reader')
    setDefaultSets(settings?.defaultSets ?? 3)
    setExercises(list)
    setEvents(ev)
    setSplit(found)
  }, [splitId])

  useEffect(() => {
    let cancelled = false
    // Deferred to a microtask: calling `load` straight from the effect body
    // reads as a synchronous setState, and the first paint should be the
    // skeleton rather than an empty directory that then fills in.
    void Promise.resolve()
      .then(load)
      .then(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [load])

  const day: SplitDay | undefined = split?.days.find((d) => d.id === dayId)
  const inDay = useMemo(
    () => new Set(day?.entries.map((e) => e.exerciseId) ?? []),
    [day],
  )

  const muscleGroups = useMemo(
    () => [...new Set(exercises.map((e) => e.muscleGroup))].sort(),
    [exercises],
  )
  const equipmentNames = useMemo(
    () => [...new Set(exercises.map((e) => e.equipment))].sort(),
    [exercises],
  )

  const recent = useMemo(() => recentExerciseIds(events), [events])

  const results = useMemo(
    () =>
      filterExercises(exercises, {
        query,
        category: category || undefined,
        muscleGroup: muscleGroup || undefined,
        equipment: equipment || undefined,
        customOnly: mineOnly || undefined,
        recentIds: recentOnly ? recent : undefined,
      }),
    [exercises, query, category, muscleGroup, equipment, mineOnly, recentOnly, recent],
  )

  const sections = useMemo(() => {
    const groups = new Map<string, Exercise[]>()
    for (const exercise of results) {
      const list = groups.get(exercise.equipment)
      if (list) list.push(exercise)
      else groups.set(exercise.equipment, [exercise])
    }
    return [...groups.entries()]
      .sort(
        (a, b) => equipmentRank(a[0]) - equipmentRank(b[0]) || a[0].localeCompare(b[0]),
      )
      .map(([name, list]) => ({
        name,
        list: [...list].sort((a, b) => a.name.localeCompare(b.name)),
      }))
  }, [results])

  const canPick = Boolean(split && day) && !isReader

  async function pick(exercise: Exercise) {
    if (!split || !day || isReader) return
    setError(null)
    // A starting prescription, not a recommendation — 3 × 8-12 is the range
    // most of the seeded template rows already sit in, and the editor is right
    // there to change it. Cardio carries no target at all.
    const entry =
      exercise.category === 'cardio'
        ? { exerciseId: exercise.id, sets: 1, repsMin: 0, repsMax: 0 }
        : { exerciseId: exercise.id, sets: defaultSets, repsMin: 8, repsMax: 12 }
    const entries =
      swapIndex !== null && swapIndex >= 0 && swapIndex < day.entries.length
        ? day.entries.map((e, i) =>
            i === swapIndex ? { ...e, exerciseId: exercise.id } : e,
          )
        : [...day.entries, entry]
    const days = split.days.map((d) => (d.id === day.id ? { ...d, entries } : d))
    try {
      await updateSplit(split.id, { days })
      // Back where the directory was opened from — the split editor by default,
      // or a session that sent someone here mid-workout.
      const returnTo = params.get('return')
      navigate(returnTo ?? `/splits/${split.id}/edit?day=${day.id}`, { replace: true })
    } catch {
      setError("Couldn't add that — try it again.")
    }
  }

  function clearFilters() {
    setQuery('')
    setCategory('')
    setMuscleGroup('')
    setEquipment('')
    setRecentOnly(false)
    setMineOnly(false)
  }

  if (loading) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6">
        <div className="h-6 w-32 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface)]" />
      </main>
    )
  }
  // The directory exists to put movements into a split, and the Mac never
  // edits one. It is absent there rather than present and inert.
  if (isReader) return <Navigate to="/splits" replace />

  const customCount = exercises.filter((e) => e.isCustom).length

  return (
    <main className="flex min-h-dvh flex-col gap-3 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between gap-3">
        <BackLink />
        <button
          onClick={() => setSheetOpen(true)}
          className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-accent)] px-3.5 text-sm font-medium text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          New exercise
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">Directory</h1>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {exercises.length} exercises
          {customCount > 0 && ` · ${customCount} of your own`}
          {day && ` · adding to ${day.label}`}
        </span>
      </div>

      {error && (
        <p role="alert" className="text-xs text-[var(--color-text-secondary)]">
          {error}
        </p>
      )}

      <input
        type="search"
        aria-label="Search exercises"
        placeholder="Search exercises"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-3 text-base text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      />

      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <Chip
            key={c.value}
            label={c.label}
            selected={category === c.value}
            onClick={() => setCategory(category === c.value ? '' : c.value)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Select
          label="Muscle group"
          value={muscleGroup}
          options={muscleGroups}
          onChange={setMuscleGroup}
        />
        <Select
          label="Equipment"
          value={equipment}
          options={equipmentNames}
          onChange={setEquipment}
        />
        <Chip label="Recent" selected={recentOnly} onClick={() => setRecentOnly(!recentOnly)} />
        <Chip label="Mine" selected={mineOnly} onClick={() => setMineOnly(!mineOnly)} />
      </div>

      {results.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-5">
          <p className="text-sm text-[var(--color-text-secondary)]">
            No movement matches those filters. Clear them, or add one of your own.
          </p>
          <button
            onClick={clearFilters}
            className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 text-sm text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sections.map((section) => (
            <section key={section.name} className="flex flex-col">
              <div className="flex items-center gap-2.5 pb-1">
                <h2 className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                  {section.name}
                </h2>
                <span
                  aria-hidden="true"
                  className="h-px flex-1"
                  style={{ background: 'linear-gradient(90deg, var(--color-border), transparent)' }}
                />
              </div>
              <ul className="flex flex-col">
                {section.list.map((exercise) => {
                  const already = inDay.has(exercise.id)
                  const meta = [
                    exercise.muscleGroup,
                    already && day ? `in your ${day.label}` : null,
                    exercise.isCustom ? 'yours' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                  const body = (
                    <>
                      <span className="flex flex-1 flex-col gap-px text-left">
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">
                          {exercise.name}
                        </span>
                        <span className="text-[11px] text-[var(--color-text-secondary)]">
                          {meta}
                        </span>
                      </span>
                      {canPick && (
                        <span
                          aria-hidden="true"
                          className="shrink-0 text-sm"
                          style={{
                            color: already
                              ? 'var(--color-accent)'
                              : 'var(--color-text-secondary)',
                          }}
                        >
                          {already ? '✓' : '+'}
                        </span>
                      )}
                    </>
                  )
                  return (
                    <li
                      key={exercise.id}
                      className="flex"
                      style={{ borderBottom: '1px solid var(--color-divider)' }}
                    >
                      {canPick ? (
                        <button
                          onClick={() => void pick(exercise)}
                          aria-label={
                            swapIndex !== null
                              ? `Swap in ${exercise.name}`
                              : `Add ${exercise.name}`
                          }
                          className="flex min-h-12 w-full items-center gap-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                        >
                          {body}
                        </button>
                      ) : (
                        <div className="flex min-h-12 w-full items-center gap-3 py-2">{body}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-auto pt-2 text-xs text-[var(--color-text-secondary)]">
        {EXERCISE_ATTRIBUTION}
      </p>

      {sheetOpen && (
        <AddExerciseSheet
          onClose={() => setSheetOpen(false)}
          onCreated={(exercise) => {
            setExercises((current) => [...current, exercise])
            setSheetOpen(false)
            // Show it straight away rather than leaving the user to hunt for
            // it under whatever filters were already on.
            clearFilters()
            setMineOnly(true)
          }}
        />
      )}
    </main>
  )
}
