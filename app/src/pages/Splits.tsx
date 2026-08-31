import { useEffect, useState } from 'react'
import { SecondaryButton } from '../components/Button'
import Screen, { EmptyState } from '../components/Screen'
import type { Settings, Split } from '../db/schema'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import { instantiateTemplate, listSplits, setActiveSplit } from '../db/splits'
import { plannedSetCount } from '../logic/nextSession'
import { SPLIT_TEMPLATES } from '../lib/splitTemplates'

export default function Splits() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings | undefined>()
  const [splits, setSplits] = useState<Split[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    const [s, all] = await Promise.all([getSettings(getOrCreateDeviceId()), listSplits()])
    setSettings(s)
    setSplits(all)
  }

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

  return (
    <Screen title="Splits">
      {error && (
        <p role="alert" className="text-xs text-[var(--color-text-secondary)]">
          {error}
        </p>
      )}

      {active ? (
        <section className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-4">
          <h2 className="text-lg font-medium text-[var(--color-text-primary)]">{active.name}</h2>
          <ul className="flex flex-col gap-2">
            {active.days.map((day) => (
              <li key={day.id} className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-[var(--color-text-primary)]">{day.label}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {day.entries.length} exercises · {plannedSetCount(day)} sets
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <EmptyState>
          <p className="text-sm text-[var(--color-text-secondary)]">
            No split chosen yet. Pick one below and it becomes yours to edit.
          </p>
        </EmptyState>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">Programmes</h2>
        {SPLIT_TEMPLATES.map((template) => {
          const isActive = active?.seededFrom === template.id
          return (
            <div
              key={template.id}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3"
            >
              <span className="flex flex-col">
                <span className="text-base text-[var(--color-text-primary)]">{template.name}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {template.days.length} days
                </span>
              </span>
              {isActive ? (
                <span className="text-xs text-[var(--color-accent)]">Active</span>
              ) : (
                !isReader && (
                  <SecondaryButton
                    onClick={() => choose(template.id)}
                    disabled={busy !== null}
                    className="px-4 py-2 text-sm"
                  >
                    {busy === template.id ? 'Switching' : 'Use this'}
                  </SecondaryButton>
                )
              )}
            </div>
          )
        })}
      </section>
    </Screen>
  )
}
