import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import BackLink from '../components/BackLink'
import { PrimaryButton } from '../components/Button'
import { allReflections, appendReflection } from '../db/reflections'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import type { ReflectionEntry, Settings } from '../db/schema'
import { todayLocalDate } from '../lib/date'
import { latestReflectionForDate, latestReflectionsByDate } from '../logic/reflection'

function formatLocalDate(localDate: string): string {
  return new Date(`${localDate}T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function Reflection() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings | undefined>()
  const [entries, setEntries] = useState<ReflectionEntry[]>([])
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const today = todayLocalDate()

  useEffect(() => {
    let cancelled = false
    async function load() {
      const deviceId = getOrCreateDeviceId()
      const s = await getSettings(deviceId)
      if (cancelled) return
      setSettings(s)
      const e = await allReflections()
      if (cancelled) return
      setEntries(e)
      setText(latestReflectionForDate(e, today)?.text ?? '')
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [today])

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
  const savedText = latestReflectionForDate(entries, today)?.text ?? ''
  const byDate = latestReflectionsByDate(entries)
  const pastDates = Array.from(byDate.keys())
    .filter((d) => (isWriter ? d !== today : true))
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    setStatus(null)
    try {
      await appendReflection(today, text, settings.deviceId)
      const updated = await allReflections()
      setEntries(updated)
      setStatus({ type: 'success', message: 'Saved.' })
    } catch {
      setStatus({ type: 'error', message: "Couldn't save that — give it another tap." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 px-6 pb-28 pt-[max(3rem,env(safe-area-inset-top))] text-center">
      <div className="w-full max-w-xs self-start"><BackLink /></div>

      <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">
        {isWriter ? 'Reflection' : 'Reflections'}
      </h1>

      {isWriter && (
        <div className="flex w-full max-w-xs flex-col gap-3 text-left">
          <label className="text-sm font-medium text-[var(--color-text-primary)]" htmlFor="reflection-text">
            Today
          </label>
          <textarea
            id="reflection-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="How's today going?"
            rows={6}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base text-[var(--color-text-primary)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          />
          <PrimaryButton onClick={handleSave} disabled={saving || text === savedText}>
            {saving ? 'Saving…' : 'Save'}
          </PrimaryButton>
          {status && (
            <p
              role={status.type === 'error' ? 'alert' : 'status'}
              className="text-xs text-[var(--color-text-secondary)]"
            >
              {status.message}
            </p>
          )}
        </div>
      )}

      <div className="flex w-full max-w-xs flex-col gap-3 text-left">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          {isWriter ? 'Past reflections' : 'Entries'}
        </span>
        {pastDates.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            {isWriter ? "No past reflections yet — they'll show up here once you save one." : 'No reflections yet.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pastDates.map((d) => {
              const entry = byDate.get(d)
              if (!entry) return null
              return (
                <li
                  key={d}
                  className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3"
                >
                  <span className="text-xs text-[var(--color-text-secondary)]">{formatLocalDate(d)}</span>
                  <p className="whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">{entry.text}</p>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}
