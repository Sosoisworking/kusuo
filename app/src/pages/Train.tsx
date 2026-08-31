import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import Screen, { EmptyState } from '../components/Screen'
import { listExercises } from '../db/exercises'
import type { Exercise, SessionMark, Split, SplitDay } from '../db/schema'
import { allSessionMarks } from '../db/sessions'
import { getActiveSplit, listSplits, setActiveSplit } from '../db/splits'
import { formatPrescription, nextSplitDay, plannedSetCount } from '../logic/nextSession'
import { instantiateTemplate } from '../db/splits'
import { SPLIT_TEMPLATES } from '../lib/splitTemplates'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import { SecondaryButton } from '../components/Button'
import { trainingDates } from '../logic/sessions'

export default function Train() {
  const [loading, setLoading] = useState(true)
  const [split, setSplit] = useState<Split | undefined>()
  const [marks, setMarks] = useState<SessionMark[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [splits, setSplits] = useState<Split[]>([])
  const [isReader, setIsReader] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    load().then(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function load() {
    const [sp, m, ex, all, settings] = await Promise.all([
      getActiveSplit(),
      allSessionMarks(),
      listExercises(),
      listSplits(),
      getSettings(getOrCreateDeviceId()),
    ])
    setSplit(sp)
    setMarks(m)
    setExercises(ex)
    setSplits(all)
    setIsReader(settings?.deviceRole === 'reader')
  }

  async function switchTo(templateId: string) {
    setSwitching(true)
    try {
      const existing = splits.find((s) => s.seededFrom === templateId)
      if (existing) await setActiveSplit(existing.id)
      else await instantiateTemplate(templateId)
      await load()
      setPickerOpen(false)
    } finally {
      setSwitching(false)
    }
  }

  if (loading) return <Screen title="Train">{null}</Screen>

  const day: SplitDay | undefined = split ? nextSplitDay(split, marks) : undefined
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const trained = [...trainingDates(marks)].sort((a, b) => b.localeCompare(a)).slice(0, 5)

  return (
    <Screen title="Train" eyebrow={split?.name}>
      {!isReader && (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setPickerOpen((open) => !open)}
            aria-expanded={pickerOpen}
            className="min-h-11 self-start text-sm text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            {pickerOpen ? 'Close' : split ? 'Switch split' : 'Choose a split'}
          </button>
          {pickerOpen && (
            <ul className="flex flex-col">
              {SPLIT_TEMPLATES.map((template) => {
                const isActive = split?.seededFrom === template.id
                return (
                  <li
                    key={template.id}
                    className="flex min-h-11 items-center justify-between gap-3 py-2"
                    style={{ borderBottom: '1px solid var(--color-divider)' }}
                  >
                    <span className="flex flex-col">
                      <span className="text-sm text-[var(--color-text-primary)]">{template.name}</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {template.days.length} days
                      </span>
                    </span>
                    {isActive ? (
                      <span className="text-xs text-[var(--color-accent)]">Active</span>
                    ) : (
                      <SecondaryButton
                        onClick={() => switchTo(template.id)}
                        disabled={switching}
                        className="px-4 py-2 text-sm"
                      >
                        Use this
                      </SecondaryButton>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {!split || !day ? (
        <EmptyState>
          <p className="text-sm text-[var(--color-text-secondary)]">
            No split chosen yet, so there is no session waiting. Pick one above, or build your own
            in <Link to="/splits" className="text-[var(--color-accent)] underline">Splits</Link>.
          </p>
        </EmptyState>
      ) : (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-text-secondary)]">Next up</span>
            <h2 className="text-xl font-medium text-[var(--color-text-primary)]">{day.label}</h2>
            <span className="text-xs text-[var(--color-text-secondary)]">
              {day.kind === 'rest'
                ? 'A day in the split, not a gap in it.'
                : `${day.entries.length} exercises · ${plannedSetCount(day)} sets`}
            </span>
          </div>

          {/*
            A plain list of things reads as rules, the way Today's habits do; a
            card is reserved for something you act on. Boxing every row made a
            five-item list look like five separate objects.
          */}
          <ul className="flex flex-col">
            {day.entries.map((entry, index) => (
              <li
                key={`${entry.exerciseId}-${index}`}
                className="flex min-h-11 items-baseline justify-between gap-3 py-2.5"
                style={{ borderBottom: '1px solid var(--color-divider)' }}
              >
                <span className="text-base text-[var(--color-text-primary)]">
                  {byId.get(entry.exerciseId)?.name ?? 'Unknown movement'}
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {formatPrescription(entry, byId.get(entry.exerciseId)?.category)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {trained.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">Recent sessions</h2>
          <ul className="flex flex-col gap-1">
            {trained.map((date) => (
              <li key={date} className="text-sm text-[var(--color-text-secondary)]">
                {date}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Screen>
  )
}
