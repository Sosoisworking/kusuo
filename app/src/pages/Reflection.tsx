import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import BackLink from '../components/BackLink'
import { PrimaryButton } from '../components/Button'
import { allReflections, appendReflection, type ReflectionAnswers } from '../db/reflections'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import type { ReflectionEntry, Settings } from '../db/schema'
import { todayLocalDate } from '../lib/date'
import { formatLongDate } from '../lib/format'
import {
  isBlank,
  latestReflectionForDate,
  latestReflectionsByDate,
  reflectionSummary,
} from '../logic/reflection'

const SCALE = [1, 2, 3, 4, 5]

/**
 * A five-point scale. Unset is a real state — a day you did not rate is not a
 * day you rated badly — so tapping the chosen number again clears it.
 */
function Scale({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | undefined
  onChange: (next: number | undefined) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-[var(--color-text-primary)]">{label}</legend>
      <div className="flex gap-2">
        {SCALE.map((n) => {
          const chosen = value === n
          return (
            <button
              key={n}
              type="button"
              aria-pressed={chosen}
              aria-label={`${label}: ${n} of 5`}
              onClick={() => onChange(chosen ? undefined : n)}
              className="flex h-11 flex-1 items-center justify-center rounded-[var(--radius-md)] text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              /*
                The same three tokens a ticked habit uses — filled, ringed,
                bright glyph. A surface-coloured square with accent digits was
                barely a step away from an unchosen one, and on the phone the
                scale read as five identical buttons.
              */
              style={{
                color: chosen ? 'var(--color-complete-mark)' : 'var(--color-text-secondary)',
                boxShadow: `inset 0 0 0 1px ${chosen ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: chosen ? 'var(--color-complete-fill)' : 'transparent',
                fontWeight: chosen ? 500 : 400,
              }}
            >
              {n}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/** 16px minimum: anything smaller makes iOS Safari zoom the page on focus. */
const fieldClass =
  'rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base text-[var(--color-text-primary)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]'

export default function Reflection() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings | undefined>()
  const [entries, setEntries] = useState<ReflectionEntry[]>([])
  const [answers, setAnswers] = useState<ReflectionAnswers>({})
  const [saving, setSaving] = useState(false)
  // Only failures are announced. A save that worked is stated by the line under
  // the form, which stays true afterwards — a one-off "Saved." said the same
  // thing twice and then went stale.
  const [saveError, setSaveError] = useState<string | null>(null)

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
      const mine = latestReflectionForDate(e, today)
      // Today's own answers, so returning to the screen continues the entry
      // rather than starting a second one. Yesterday's are never carried in.
      setAnswers(
        mine
          ? {
              text: mine.text,
              energy: mine.energy,
              mood: mine.mood,
              wentWell: mine.wentWell,
              gotInTheWay: mine.gotInTheWay,
            }
          : {},
      )
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
  const saved = latestReflectionForDate(entries, today)
  const byDate = latestReflectionsByDate(entries)
  // Every day that holds something, today included. Filtering today out is what
  // made a saved reflection look like it had not been stored.
  const dates = Array.from(byDate.keys())
    .filter((d) => !isBlank(byDate.get(d) as ReflectionEntry))
    .sort((a, b) => b.localeCompare(a))

  const dirty =
    (answers.text ?? '') !== (saved?.text ?? '') ||
    answers.energy !== saved?.energy ||
    answers.mood !== saved?.mood ||
    (answers.wentWell ?? '') !== (saved?.wentWell ?? '') ||
    (answers.gotInTheWay ?? '') !== (saved?.gotInTheWay ?? '')

  function set(patch: Partial<ReflectionAnswers>) {
    setAnswers((current) => ({ ...current, ...patch }))
    setSaveError(null)
  }

  async function handleSave() {
    if (!settings || isBlank(answers)) return
    setSaving(true)
    setSaveError(null)
    try {
      await appendReflection(today, answers, settings.deviceId)
      setEntries(await allReflections())
    } catch {
      setSaveError("Couldn't save that — give it another tap.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-5 pb-28 pt-[var(--space-safe-top)]">
      <BackLink />

      <header className="flex flex-col gap-1">
        <span className="text-xs text-[var(--color-text-secondary)]">{formatLongDate(today)}</span>
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">
          {isWriter ? 'Reflect' : 'Reflections'}
        </h1>
        {isWriter && (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Five questions. Answer the ones that apply and leave the rest.
          </p>
        )}
      </header>

      {isWriter && (
        <div className="flex flex-col gap-5">
          <Scale label="Energy" value={answers.energy} onChange={(n) => set({ energy: n })} />
          <Scale label="Mood" value={answers.mood} onChange={(n) => set({ mood: n })} />

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              What went well?
            </span>
            <textarea
              rows={2}
              value={answers.wentWell ?? ''}
              onChange={(e) => set({ wentWell: e.target.value })}
              className={fieldClass}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              What got in the way?
            </span>
            <textarea
              rows={2}
              value={answers.gotInTheWay ?? ''}
              onChange={(e) => set({ gotInTheWay: e.target.value })}
              className={fieldClass}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              Anything else
            </span>
            <textarea
              rows={4}
              value={answers.text ?? ''}
              onChange={(e) => set({ text: e.target.value })}
              className={fieldClass}
            />
          </label>

          {saved && !dirty ? (
            /* Saved, and nothing has changed since. A dimmed "Update today"
               reads as a control that has stopped working; what is actually
               true is that there is nothing left to save, so it says that. */
            <p role="status" className="text-sm text-[var(--color-text-secondary)]">
              Saved for today. Change an answer to update it.
            </p>
          ) : (
            <PrimaryButton onClick={handleSave} disabled={saving || isBlank(answers) || !dirty}>
              {saving ? 'Saving…' : saved ? 'Update today' : 'Save'}
            </PrimaryButton>
          )}
          {saveError && (
            <p role="alert" className="text-xs text-[var(--color-text-secondary)]">
              {saveError}
            </p>
          )}
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">Past reflections</h2>
        {dates.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Nothing yet. What you save shows up here and on that day in the calendar.
          </p>
        ) : (
          <ul className="flex flex-col">
            {dates.map((d) => {
              const entry = byDate.get(d)
              if (!entry) return null
              return (
                <li
                  key={d}
                  className="flex flex-col gap-1 py-3"
                  style={{ borderBottom: '1px solid var(--color-divider)' }}
                >
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {formatLongDate(d)}
                    {d === today ? ' · today' : ''}
                  </span>
                  <p className="whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">
                    {reflectionSummary(entry)}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
