import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import BackLink from '../components/BackLink'
import { PrimaryButton } from '../components/Button'
import { listExercises } from '../db/exercises'
import type { Exercise, Settings as SettingsType, SessionEvent, Split } from '../db/schema'
import { allSessionEvents } from '../db/sessions'
import { listSplits } from '../db/splits'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import { todayLocalDate } from '../lib/date'
import { formatLongDate } from '../lib/format'
import { encodeWorkout, formatSessionText, workoutFromDay } from '../lib/share'
import { dayBreakdown, trainingDates } from '../logic/sessions'
import { allSessionMarks } from '../db/sessions'

export default function Share() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<SettingsType | undefined>()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [splits, setSplits] = useState<Split[]>([])
  const [dates, setDates] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [includeCode, setIncludeCode] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getSettings(getOrCreateDeviceId()),
      listExercises(),
      allSessionEvents(),
      listSplits(),
      allSessionMarks(),
    ]).then(([s, list, ev, allSplits, marks]) => {
      if (cancelled) return
      setSettings(s)
      setExercises(list)
      setEvents(ev)
      setSplits(allSplits)
      const trained = [...trainingDates(marks)].sort((a, b) => b.localeCompare(a))
      const logged = [...new Set(ev.map((e) => e.localDate))].sort((a, b) => b.localeCompare(a))
      const all = [...new Set([...trained, ...logged])].sort((a, b) => b.localeCompare(a))
      setDates(all)
      setSelected(all[0] ?? null)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6">
        <div className="h-6 w-32 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface)]" />
      </main>
    )
  }
  if (!settings || !settings.onboardingComplete) return <Navigate to="/onboarding" replace />

  const units = settings.units
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const rows = selected ? dayBreakdown(events, selected) : []
  // The day a session was logged against names it. Every set of a session
  // carries the same splitDayId, so the first one is enough.
  const splitDayId = selected
    ? events.find((e) => e.localDate === selected)?.splitDayId
    : undefined
  const day = splits.flatMap((s) => s.days).find((d) => d.id === splitDayId)
  const label = day?.label ?? 'Session'

  const text = selected ? formatSessionText(selected, label, rows, byId, units) : ''
  const code = buildCode()
  const message = includeCode && code ? `${text}\n\n${code}` : text

  function buildCode(): string | undefined {
    if (!day) return undefined
    return encodeWorkout(workoutFromDay(day, byId))
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <main className="flex min-h-dvh flex-col gap-5 px-5 pb-28 pt-[max(3rem,env(safe-area-inset-top))]">
      <BackLink label="Back to your data" to="/settings/data" />

      <header className="flex flex-col gap-0.5">
        <span className="text-xs text-[var(--color-text-secondary)]">A session, as text</span>
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">Share</h1>
      </header>

      {dates.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Nothing logged yet. A session becomes shareable the first time you log a set.
        </p>
      ) : (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-[var(--color-text-primary)]">Session</legend>
            <div className="flex flex-col">
              {dates.slice(0, 7).map((date) => (
                <button
                  key={date}
                  onClick={() => {
                    setSelected(date)
                    setCopied(false)
                  }}
                  aria-pressed={selected === date}
                  className="flex min-h-11 items-center justify-between gap-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                  style={{ borderBottom: '1px solid var(--color-divider)' }}
                >
                  <span className="text-sm text-[var(--color-text-primary)]">
                    {formatLongDate(date)}
                    {date === todayLocalDate() ? ' · today' : ''}
                  </span>
                  {selected === date && (
                    <span className="text-xs text-[var(--color-accent)]">Chosen</span>
                  )}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="flex min-h-11 items-center justify-between gap-3">
            <span className="flex flex-col">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                Include an import code
              </span>
              <span className="text-xs text-[var(--color-text-secondary)]">
                Lets another Kusuo add this day to their splits. Harmless to anyone else.
              </span>
            </span>
            <input
              type="checkbox"
              checked={includeCode}
              onChange={(e) => {
                setIncludeCode(e.target.checked)
                setCopied(false)
              }}
              className="h-6 w-6 shrink-0 accent-[var(--color-accent)]"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Message</span>
            <textarea
              readOnly
              value={message}
              rows={10}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base text-[var(--color-text-primary)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            />
          </label>

          <PrimaryButton onClick={copy}>{copied ? 'Copied' : 'Copy'}</PrimaryButton>
          {!code && includeCode && (
            <p className="text-xs text-[var(--color-text-secondary)]">
              No import code for this one — the day it was logged against is no longer in a split.
            </p>
          )}
        </>
      )}
    </main>
  )
}
