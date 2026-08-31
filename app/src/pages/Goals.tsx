import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router'
import BackLink from '../components/BackLink'
import { PrimaryButton } from '../components/Button'
import { archiveGoal, createGoal, listActiveGoals } from '../db/goals'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import type { Goal, Settings } from '../db/schema'

function formatTargetDate(targetDate: string): string {
  return new Date(`${targetDate}T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function Goals() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings | undefined>()
  const [goals, setGoals] = useState<Goal[]>([])
  const [title, setTitle] = useState('')
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
      await createGoal({ title: trimmed, targetDate: targetDate || undefined })
      const g = await listActiveGoals()
      setGoals(g)
      setTitle('')
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
      await archiveGoal(id)
    } catch {
      const g = await listActiveGoals()
      setGoals(g)
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 px-6 pb-28 pt-[max(3rem,env(safe-area-inset-top))] text-center">
      <div className="w-full max-w-xs self-start"><BackLink /></div>
      <Link
        to="/settings"
        aria-label="Back to Settings"
        className="flex h-11 w-11 shrink-0 items-center justify-center self-start rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M12.5 4.5L6 11l6.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">Goals</h1>

      {isWriter && (
        <div className="flex w-full max-w-xs flex-col gap-3 text-left">
          <label className="text-sm font-medium text-[var(--color-text-primary)]" htmlFor="goal-title">
            New goal
          </label>
          <input
            id="goal-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What are you working toward?"
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base text-[var(--color-text-primary)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          />
          <label className="text-sm font-medium text-[var(--color-text-primary)]" htmlFor="goal-target-date">
            Target date (optional)
          </label>
          <input
            id="goal-target-date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base text-[var(--color-text-primary)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          />
          <PrimaryButton onClick={handleAdd} disabled={saving}>
            {saving ? 'Adding…' : 'Add goal'}
          </PrimaryButton>
          {error && (
            <p role="alert" className="text-xs text-[var(--color-text-secondary)]">
              {error}
            </p>
          )}
        </div>
      )}

      <div className="flex w-full max-w-xs flex-col gap-3 text-left">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">Active goals</span>
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
                    Done
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
