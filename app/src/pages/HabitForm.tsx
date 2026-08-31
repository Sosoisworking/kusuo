import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import BackLink from '../components/BackLink'
import { PrimaryButton, SecondaryButton } from '../components/Button'
import { archiveHabit, createHabit, getHabit, listCategories, updateHabit } from '../db/habits'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import type { FrequencyType, Settings } from '../db/schema'

export default function HabitForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings | undefined>()
  const [notFound, setNotFound] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [frequencyType, setFrequencyType] = useState<FrequencyType>('daily')
  const [frequencyValue, setFrequencyValue] = useState(3)
  const [saving, setSaving] = useState(false)
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const deviceId = getOrCreateDeviceId()
      const [s, cats] = await Promise.all([getSettings(deviceId), listCategories()])
      if (cancelled) return
      setSettings(s)
      setCategories(cats)
      if (id) {
        const habit = await getHabit(id)
        if (cancelled) return
        if (!habit) {
          setNotFound(true)
        } else {
          setName(habit.name)
          setCategory(habit.category ?? '')
          setDescription(habit.description ?? '')
          setFrequencyType(habit.frequencyType)
          setFrequencyValue(habit.frequencyValue)
        }
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    setError(null)
    try {
      const value = frequencyType === 'daily' ? 1 : frequencyValue
      const trimmedCategory = category.trim() || undefined
      const trimmedDescription = description.trim() || undefined
      if (isEdit && id) {
        await updateHabit(id, {
          name: trimmed,
          category: trimmedCategory,
          description: trimmedDescription,
          frequencyType,
          frequencyValue: value,
        })
      } else {
        await createHabit({
          name: trimmed,
          category: trimmedCategory,
          description: trimmedDescription,
          frequencyType,
          frequencyValue: value,
        })
      }
      navigate('/', { replace: true })
    } catch {
      setSaving(false)
      setError("Couldn't save that — give it another tap.")
    }
  }

  async function confirmArchive() {
    if (!id) return
    setError(null)
    try {
      await archiveHabit(id)
      navigate('/', { replace: true })
    } catch {
      setError("Couldn't archive that — give it another tap.")
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6">
        <div className="h-6 w-32 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface)]" />
        <div className="h-4 w-24 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface)]" />
      </main>
    )
  }
  if (!settings || settings.deviceRole !== 'writer') return <Navigate to="/" replace />
  if (notFound) return <Navigate to="/" replace />

  if (confirmingArchive) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 pt-[max(3rem,env(safe-area-inset-top))] text-center">
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">Archive "{name}"?</h1>
        <p className="max-w-xs text-sm text-[var(--color-text-secondary)]">
          It'll disappear from Today, but its history stays exactly as it is.
        </p>
        {error && (
          <p role="alert" className="text-xs text-[var(--color-text-secondary)]">
            {error}
          </p>
        )}
        <div className="flex w-full max-w-xs flex-col gap-3">
          <PrimaryButton onClick={confirmArchive}>Archive</PrimaryButton>
          <SecondaryButton onClick={() => setConfirmingArchive(false)}>Go back</SecondaryButton>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 px-6 pb-12 pt-[max(3rem,env(safe-area-inset-top))] text-center">
      <div className="w-full max-w-xs self-start"><BackLink /></div>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">
          {isEdit ? `Edit ${name || 'habit'}` : 'New habit'}
        </h1>
        <p className="max-w-xs text-sm text-[var(--color-text-secondary)]">
          {isEdit ? 'Changes apply going forward — past history stays as it is.' : 'Give it a name and how often you\'ll do it.'}
        </p>
      </div>

      <form
        className="flex w-full max-w-xs flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="flex flex-col gap-2 text-left">
          <label className="sr-only" htmlFor="habit-name">
            Habit name
          </label>
          <input
            id="habit-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Habit name"
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base text-[var(--color-text-primary)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          />
        </div>

        <div className="flex flex-col gap-2 text-left">
          <label className="sr-only" htmlFor="habit-category">
            Category (optional)
          </label>
          <input
            id="habit-category"
            list="habit-categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category (optional)"
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base text-[var(--color-text-primary)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          />
          <datalist id="habit-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className="flex flex-col gap-2 text-left">
          <label className="sr-only" htmlFor="habit-description">
            Notes
          </label>
          <textarea
            id="habit-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes (optional)"
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base text-[var(--color-text-primary)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFrequencyType('daily')}
            aria-pressed={frequencyType === 'daily'}
            className="min-h-11 flex-1 rounded-[var(--radius-sm)] px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            style={{
              background: frequencyType === 'daily' ? 'var(--color-accent)' : 'transparent',
              color: frequencyType === 'daily' ? 'var(--color-bg)' : 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
            }}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => setFrequencyType('weekly')}
            aria-pressed={frequencyType === 'weekly'}
            className="min-h-11 flex-1 rounded-[var(--radius-sm)] px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            style={{
              background: frequencyType === 'weekly' ? 'var(--color-accent)' : 'transparent',
              color: frequencyType === 'weekly' ? 'var(--color-bg)' : 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
            }}
          >
            Weekly
          </button>
        </div>

        {frequencyType === 'weekly' && (
          <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2">
            <span className="text-sm text-[var(--color-text-secondary)]">Times per week</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Decrease"
                onClick={() => setFrequencyValue((v) => Math.max(1, v - 1))}
                className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] text-lg text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              >
                −
              </button>
              <span className="w-4 text-base font-medium text-[var(--color-text-primary)]">{frequencyValue}</span>
              <button
                type="button"
                aria-label="Increase"
                onClick={() => setFrequencyValue((v) => Math.min(7, v + 1))}
                className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] text-lg text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              >
                +
              </button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-xs text-[var(--color-text-secondary)]">
            {error}
          </p>
        )}

        <PrimaryButton type="submit" disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add habit'}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={() => navigate('/')}>
          Cancel
        </SecondaryButton>
        {isEdit && (
          <button
            type="button"
            onClick={() => setConfirmingArchive(true)}
            className="min-h-11 text-sm text-[var(--color-text-secondary)] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            Archive habit
          </button>
        )}
      </form>
    </main>
  )
}
