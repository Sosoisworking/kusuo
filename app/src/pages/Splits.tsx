import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import Screen, { EmptyState } from '../components/Screen'
import type { SessionMark, Settings, Split } from '../db/schema'
import { allSessionMarks } from '../db/sessions'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import { instantiateTemplate, listSplits, setActiveSplit } from '../db/splits'
import { formatShortDate } from '../lib/format'
import { SPLIT_TEMPLATES, type SplitTemplate } from '../lib/splitTemplates'
import { nextSplitDay, plannedSetCount } from '../logic/nextSession'

/**
 * One line per programme, saying what makes it different rather than selling
 * it. Kept next to the screen that shows it instead of in the template
 * constant: this is presentation, and the templates are data the session flow
 * and the backup format both read.
 *
 * The fallback means adding a template can never leave a row blank.
 */
const TEMPLATE_NOTES: Record<string, string> = {
  'split-ppl-3': 'each muscle twice a fortnight',
  'split-ppl-abs-4': 'abs on its own day',
  'split-ppl-upper-lower-5': 'highest volume here',
  'split-upper-lower-4': 'two of each',
  'split-full-body-3': 'every session counts',
  'split-bro-5': 'one muscle a day',
  'split-batman-7': 'a full week, two rest days',
}

function templateNote(template: SplitTemplate): string {
  const days = `${template.days.length} days`
  const note = TEMPLATE_NOTES[template.id]
  return note ? `${days} · ${note}` : days
}

function exerciseCount(days: { entries: unknown[] }[]): number {
  return days.reduce((total, day) => total + day.entries.length, 0)
}

/** A section heading with the hairline that fades out at its far end. */
function RuledHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <h2 className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
        {children}
      </h2>
      <span
        aria-hidden="true"
        className="h-px flex-1"
        style={{
          background:
            'linear-gradient(90deg, var(--color-border), transparent)',
        }}
      />
    </div>
  )
}

export default function Splits() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings | undefined>()
  const [splits, setSplits] = useState<Split[]>([])
  const [marks, setMarks] = useState<SessionMark[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [s, all, m] = await Promise.all([
      getSettings(getOrCreateDeviceId()),
      listSplits(),
      allSessionMarks(),
    ])
    setSettings(s)
    setSplits(all)
    setMarks(m)
  }, [])

  useEffect(() => {
    let cancelled = false
    // Deferred to a microtask deliberately: calling `load` straight from the
    // effect body reads to the linter as a synchronous setState, and it is
    // right that the difference matters — this way the first paint is the
    // skeleton, never a half-populated screen.
    void Promise.resolve()
      .then(load)
      .then(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [load])

  const isReader = settings?.deviceRole === 'reader'
  const active = splits.find((s) => s.isActive)

  async function choose(templateId: string) {
    if (isReader) return
    setError(null)
    setBusy(templateId)
    try {
      // A template the user already took a copy of is re-activated rather than
      // duplicated — otherwise switching back and forth breeds identical splits.
      const existing = splits.find((s) => s.seededFrom === templateId)
      if (existing) await setActiveSplit(existing.id)
      else await instantiateTemplate(templateId)
      await load()
    } catch {
      setError("Couldn't switch split — try that again.")
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <Screen title="Splits">{null}</Screen>

  const upNext = active ? nextSplitDay(active, marks) : undefined

  return (
    <Screen title="Splits" eyebrow={`${SPLIT_TEMPLATES.length} programmes`}>
      <p className="max-w-[36ch] text-xs leading-relaxed text-[var(--color-text-secondary)]">
        Pick the programme you're running. Each comes in as a template you can rearrange — your
        edits stick.
      </p>

      {error && (
        <p role="alert" className="text-xs text-[var(--color-text-secondary)]">
          {error}
        </p>
      )}

      {active ? (
        /*
          The one card on this screen, because it is the one thing you act on.
          The programme list below it is a list, so it gets hairlines.
        */
        <section
          aria-label="Active split"
          className="relative flex flex-col gap-3 overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 py-4"
          style={{ boxShadow: 'var(--shadow-md)' }}
        >
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent, var(--color-accent), transparent)',
            }}
          />
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-accent)]">
                Active
              </span>
              <h2 className="text-xl font-medium text-[var(--color-text-primary)]">{active.name}</h2>
              <span className="text-xs text-[var(--color-text-secondary)]">
                {active.days.length} days · {exerciseCount(active.days)} exercises · updated{' '}
                {formatShortDate(active.updatedAt)}
              </span>
            </div>
            {!isReader && (
              <Link
                to={`/splits/${active.id}/edit`}
                className="flex min-h-11 shrink-0 items-center rounded-[var(--radius-md)] border border-[var(--color-accent)] px-3 text-sm font-medium text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              >
                Edit
              </Link>
            )}
          </div>

          <ul className="flex flex-wrap gap-1.5">
            {active.days.map((day) => {
              const isNext = day.id === upNext?.id
              return (
                <li
                  key={day.id}
                  className="flex min-w-[5.5rem] flex-1 flex-col gap-px rounded-[var(--radius-sm)] px-2.5 py-2"
                  style={{
                    background: isNext ? 'var(--color-complete-fill)' : 'transparent',
                    boxShadow: isNext
                      ? 'inset 0 0 0 1px var(--color-accent)'
                      : 'inset 0 0 0 1px var(--color-border)',
                  }}
                >
                  <span
                    className="text-xs font-medium"
                    style={{
                      color: isNext ? 'var(--color-complete-mark)' : 'var(--color-text-primary)',
                    }}
                  >
                    {day.label}
                  </span>
                  <span
                    className="text-[10px]"
                    style={{
                      color: isNext ? 'var(--color-accent-300)' : 'var(--color-text-secondary)',
                    }}
                  >
                    {day.kind === 'rest' ? 'rest' : `${plannedSetCount(day)} sets`}
                    {isNext && ' · next'}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : (
        <EmptyState>
          <p className="text-sm text-[var(--color-text-secondary)]">
            No split chosen yet. Pick one below and it becomes yours to edit.
          </p>
        </EmptyState>
      )}

      <section className="flex flex-col gap-2">
        <RuledHeading>Available</RuledHeading>
        <ul className="flex flex-col">
          {/* The programme you are running is the card above. Listing it here
              as well would put "Active" on the screen twice and make the list
              read as seven choices when six of them are the choice. */}
          {SPLIT_TEMPLATES.filter((t) => t.id !== active?.seededFrom).map((template) => {
            const meta = (
              <>
                <span className="flex flex-1 flex-col gap-px text-left">
                  <span className="text-[15px] font-medium text-[var(--color-text-primary)]">
                    {template.name}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {templateNote(template)}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-[var(--color-text-secondary)]">
                  {exerciseCount(template.days)} ex
                </span>
              </>
            )
            return (
              <li
                key={template.id}
                className="flex"
                style={{ borderBottom: '1px solid var(--color-divider)' }}
              >
                {isReader ? (
                  <div className="flex min-h-[52px] w-full items-center gap-3 py-2">{meta}</div>
                ) : (
                  <button
                    onClick={() => choose(template.id)}
                    disabled={busy !== null}
                    aria-label={`Use ${template.name}`}
                    className="flex min-h-[52px] w-full items-center gap-3 py-2 text-left disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                  >
                    {meta}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <p
        className="text-xs leading-relaxed text-[var(--color-text-secondary)]"
        style={{ borderLeft: '1px solid var(--color-accent-800)', paddingLeft: '10px' }}
      >
        Switching split keeps every session you've already logged. Only what Train loads next
        changes.
      </p>
    </Screen>
  )
}
