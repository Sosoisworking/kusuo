import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import BackLink from '../components/BackLink'
import { PrimaryButton } from '../components/Button'
import SectionHeading from '../components/SectionHeading'
import { completeGoal, createGoal, listActiveGoals } from '../db/goals'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import type { Goal, Settings } from '../db/schema'

function formatTargetDate(targetDate: string): string {
  return new Date(`${targetDate}T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** The affordance an unset `input[type=date]` does not draw for itself on iOS. */
function CalendarGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <rect x="3" y="4.5" width="14" height="12" rx="2" />
      <path d="M3 8.5h14M7 3v3M13 3v3" strokeLinecap="round" />
    </svg>
  )
}

const fieldClass =
  'rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base text-[var(--color-text-primary)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]'

const labelClass = 'text-sm font-medium text-[var(--color-text-primary)]'

export default function Goals() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings | undefined>()
  const [goals, setGoals] = useState<Goal[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const deviceId = getOrCreateDeviceId()
      const s = await getSettings(deviceId)
      if (cancelled) return
      setSettings(s)
      const g = await listActiveGoals()
      if (cancelled) return
      setGoals(g)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 pb-28">
        <div className="h-6 w-32 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface)]" />
        <div className="h-4 w-24 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface)]" />
      </main>
    )
  }
  if (!settings || !settings.onboardingComplete) return <Navigate to="/onboarding" replace />

  const isWriter = settings.deviceRole === 'writer'

  async function handleAdd() {
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Give the goal a title first.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await createGoal({
        title: trimmed,
        description: description.trim() || undefined,
        targetDate: targetDate || undefined,
      })
      const g = await listActiveGoals()
      setGoals(g)
      setTitle('')
      setDescription('')
      setTargetDate('')
    } catch {
      setError("Couldn't save that — give it another tap.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDone(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id))
    try {
      // Reached, not abandoned — only this puts it in Records.
      await completeGoal(id)
    } catch {
      const g = await listActiveGoals()
      setGoals(g)
    }
  }

  return (
    /* Left-aligned under an eyebrow, like every other screen that is not a tab.
       Centred text and a 20rem column made Goals read as a different app. */
    <main className="flex min-h-dvh flex-col gap-6 px-5 pb-28 pt-[var(--space-safe-top)]">
      <BackLink />

      <header className="flex flex-col gap-0.5">
        <span className="text-xs text-[var(--color-text-secondary)]">
          {goals.length === 0
            ? 'Nothing active'
            : `${goals.length} active`}
        </span>
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">Goals</h1>
      </header>

      {isWriter && (
        <section className="flex flex-col gap-3">
          <SectionHeading>New goal</SectionHeading>
          <label className="flex flex-col gap-2">
            <span className={labelClass}>What are you working toward?</span>
            <input
              id="goal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Deadlift 140 kg"
              className={fieldClass}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className={labelClass}>Description (optional)</span>
            <textarea
              id="goal-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What reaching it would look like"
              className={fieldClass}
            />
          </label>

          <div className="flex flex-col gap-2">
            <label className={labelClass} htmlFor="goal-target-date">
              Target date (optional)
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                {/*
                  iOS draws an unset date input as an empty box: no placeholder,
                  no glyph, nothing that says a picker is behind it. The native
                  control stays — it is the picker, and typing still works — but
                  it is transparent, and the row under it states the date.
                */}
                <input
                  id="goal-target-date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="peer absolute inset-0 h-full w-full opacity-0"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none flex min-h-11 items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--color-accent)]"
                >
                  <span
                    className="text-base"
                    style={{
                      color: targetDate
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-secondary)',
                    }}
                  >
                    {targetDate ? formatTargetDate(targetDate) : 'Choose a date'}
                  </span>
                  <CalendarGlyph />
                </div>
              </div>
              {targetDate && (
                <button
                  type="button"
                  onClick={() => setTargetDate('')}
                  className="min-h-11 shrink-0 px-3 text-sm text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <PrimaryButton onClick={handleAdd} disabled={saving}>
            {saving ? 'Adding…' : 'Add goal'}
          </PrimaryButton>
          {error && (
            <p role="alert" className="text-xs text-[var(--color-text-secondary)]">
              {error}
            </p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionHeading>Active goals</SectionHeading>
        {goals.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">No active goals yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {goals.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-[var(--color-text-primary)]">{g.title}</span>
                  {g.description && (
                    <span className="text-xs text-[var(--color-text-secondary)]">{g.description}</span>
                  )}
                  {g.targetDate && (
                    <span className="text-xs text-[var(--color-text-secondary)]">{formatTargetDate(g.targetDate)}</span>
                  )}
                </div>
                {isWriter && (
                  <button
                    type="button"
                    onClick={() => handleDone(g.id)}
                    className="min-h-11 shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                  >
                    Reached
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
