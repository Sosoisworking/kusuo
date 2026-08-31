import { useEffect, useRef, useState } from 'react'
import { createCustomExercise } from '../db/exercises'
import type { Exercise, ExerciseCategory } from '../db/schema'

const CATEGORIES: { value: ExerciseCategory; label: string }[] = [
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'legs', label: 'Legs' },
  { value: 'abs', label: 'Abs' },
  { value: 'cardio', label: 'Cardio' },
]

function Field({
  label,
  hint,
  value,
  placeholder,
  onChange,
}: {
  label: string
  hint?: string
  value: string
  placeholder?: string
  onChange: (next: string) => void
}) {
  return (
    <label className="flex flex-1 flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
        {label}
        {hint && <span className="font-normal normal-case tracking-normal"> {hint}</span>}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-3 text-base text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      />
    </label>
  )
}

/**
 * Bottom sheet over the directory. Writes through `createCustomExercise` and
 * hands the new movement back so the list it sits over can show it without a
 * round trip.
 */
export default function AddExerciseSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (exercise: Exercise) => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ExerciseCategory>('push')
  const [muscleGroup, setMuscleGroup] = useState('')
  const [equipment, setEquipment] = useState('')
  const [referenceUrl, setReferenceUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    nameRef.current?.querySelector('input')?.focus()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('A name is the one field this needs.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const created = await createCustomExercise({
        name: trimmed,
        category,
        // Blank is honest: the directory groups by equipment, and "Other" is
        // where the seed already puts anything that fits nowhere else.
        muscleGroup: muscleGroup.trim() || 'Other',
        equipment: equipment.trim() || 'Other',
        referenceUrl: referenceUrl.trim() || undefined,
      })
      onCreated(created)
    } catch {
      setError("Couldn't save that — try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: 'var(--color-bg)', opacity: 0.72 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New exercise"
        className="relative flex max-h-[92dvh] flex-col gap-4 overflow-y-auto rounded-t-[var(--radius-lg)] bg-[var(--color-surface)] px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4"
        style={{ boxShadow: 'var(--shadow-lg)' }}
      >
        <span
          aria-hidden="true"
          className="h-1 w-9 self-center rounded-[var(--radius-sm)]"
          style={{ background: 'var(--color-border)' }}
        />

        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-xl font-medium text-[var(--color-text-primary)]">New exercise</h2>
            <span className="text-xs text-[var(--color-text-secondary)]">
              Yours only, on this device
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Cancel"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {error && (
          <p role="alert" className="text-xs text-[var(--color-text-secondary)]">
            {error}
          </p>
        )}

        <div ref={nameRef}>
          <Field label="Name" value={name} onChange={setName} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
            Category
          </span>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => {
              const selected = c.value === category
              return (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  aria-pressed={selected}
                  className="min-h-11 rounded-full px-4 text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                  style={{
                    border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    background: selected ? 'var(--color-complete-fill)' : 'transparent',
                    color: selected ? 'var(--color-complete-mark)' : 'var(--color-text-secondary)',
                    fontWeight: selected ? 500 : 400,
                  }}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex gap-2.5">
          <Field label="Muscle group" value={muscleGroup} onChange={setMuscleGroup} />
          <Field label="Equipment" value={equipment} onChange={setEquipment} />
        </div>

        <Field
          label="Reference link"
          hint="(optional)"
          value={referenceUrl}
          placeholder="https://"
          onChange={setReferenceUrl}
        />

        <div className="flex gap-2">
          <button
            onClick={() => void submit()}
            disabled={saving}
            className="flex min-h-12 flex-1 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-accent)] text-base font-medium text-[var(--color-accent)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            Add exercise
          </button>
          <button
            onClick={onClose}
            className="min-h-12 rounded-[var(--radius-md)] px-4 text-sm text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
