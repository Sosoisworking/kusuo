import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { PrimaryButton, SecondaryButton } from '../components/Button'
import { createHabit } from '../db/habits'
import { completeOnboarding, createSettings, getOrCreateDeviceId, getSettings, updateSettings } from '../db/settings'
import type { DeviceRole, FrequencyType } from '../db/schema'
import { STARTER_TEMPLATES } from '../lib/templates'

type Step = 'loading' | 'role' | 'confirmReader' | 'name' | 'templates'

const WRITER_STEP_NUMBER: Record<Step, number | undefined> = {
  loading: undefined,
  role: 1,
  confirmReader: undefined,
  name: 2,
  templates: 3,
}

function StepIndicator({ step }: { step: Step }) {
  const current = WRITER_STEP_NUMBER[step]
  if (!current) return null
  return (
    <div className="flex gap-2" aria-label={`Step ${current} of 3`}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className="h-1.5 w-6 rounded-full"
          style={{ background: n <= current ? 'var(--color-accent)' : 'var(--color-border)' }}
        />
      ))}
    </div>
  )
}

export default function Onboarding() {
  const navigate = useNavigate()
  const [deviceId] = useState(getOrCreateDeviceId)
  const [step, setStep] = useState<Step>('loading')
  const [name, setName] = useState('')
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set())
  const [customHabits, setCustomHabits] = useState<{ name: string; frequencyType: FrequencyType; frequencyValue: number }[]>([])
  const [customName, setCustomName] = useState('')
  const [customFrequency, setCustomFrequency] = useState<'daily' | 'weekly'>('daily')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    getSettings(deviceId).then((settings) => {
      if (cancelled) return
      if (!settings) {
        setStep('role')
      } else if (!settings.userName && settings.deviceRole === 'writer') {
        setName(settings.userName ?? '')
        setStep('name')
      } else {
        setStep('templates')
      }
    })
    return () => {
      cancelled = true
    }
  }, [deviceId])

  async function pickRole(role: DeviceRole) {
    if (role === 'reader') {
      setStep('confirmReader')
      return
    }
    await createSettings({ deviceId, deviceRole: role })
    setStep('name')
  }

  async function confirmReader() {
    await createSettings({ deviceId, deviceRole: 'reader' })
    await completeOnboarding(deviceId)
    navigate('/', { replace: true })
  }

  async function submitName() {
    const trimmed = name.trim()
    if (!trimmed) return
    await updateSettings(deviceId, { userName: trimmed })
    setStep('templates')
  }

  useEffect(() => {
    if (step === 'templates') {
      setSelectedTemplateIds((prev) => (prev.size === 0 ? new Set(STARTER_TEMPLATES.map((t) => t.id)) : prev))
    }
  }, [step])

  function toggleTemplate(id: string) {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function addCustomHabit() {
    const trimmed = customName.trim()
    if (!trimmed) return
    setCustomHabits((prev) => [
      ...prev,
      { name: trimmed, frequencyType: customFrequency, frequencyValue: customFrequency === 'daily' ? 1 : 3 },
    ])
    setCustomName('')
  }

  const hasSelection = selectedTemplateIds.size > 0 || customHabits.length > 0

  async function finish() {
    if (!hasSelection) return
    setSaving(true)
    const chosen = STARTER_TEMPLATES.filter((t) => selectedTemplateIds.has(t.id))
    for (const t of chosen) {
      await createHabit({ name: t.name, frequencyType: t.frequencyType, frequencyValue: t.frequencyValue })
    }
    for (const c of customHabits) {
      await createHabit({ name: c.name, frequencyType: c.frequencyType, frequencyValue: c.frequencyValue })
    }
    await completeOnboarding(deviceId)
    navigate('/', { replace: true })
  }

  if (step === 'loading') return null

  if (step === 'role') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <StepIndicator step={step} />
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">Welcome to Kusuo</h1>
        <p className="max-w-xs text-sm text-[var(--color-text-secondary)]">
          Which device is this? Your iPhone is where you'll check things off — your Mac is just for looking back.
        </p>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <PrimaryButton onClick={() => pickRole('writer')}>This is my iPhone</PrimaryButton>
          <SecondaryButton onClick={() => pickRole('reader')}>This is my Mac</SecondaryButton>
        </div>
      </main>
    )
  }

  if (step === 'confirmReader') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">Just to confirm</h1>
        <p className="max-w-xs text-sm text-[var(--color-text-secondary)]">
          This device will be view-only — you'll see your habits here, but you'll always check them off on your
          iPhone.
        </p>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <PrimaryButton onClick={confirmReader}>Sounds right</PrimaryButton>
          <SecondaryButton onClick={() => setStep('role')}>Go back</SecondaryButton>
        </div>
      </main>
    )
  }

  if (step === 'name') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <StepIndicator step={step} />
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">What should I call you?</h1>
        <p className="max-w-xs text-sm text-[var(--color-text-secondary)]">
          Just your name — nothing else, no account needed.
        </p>
        <form
          className="flex w-full max-w-xs flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            submitName()
          }}
        >
          <label className="sr-only" htmlFor="onboarding-name">
            Your name
          </label>
          <input
            id="onboarding-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base text-[var(--color-text-primary)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          />
          <PrimaryButton type="submit" disabled={!name.trim()}>
            Continue
          </PrimaryButton>
        </form>
      </main>
    )
  }

  // templates
  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 px-6 pb-12 pt-[max(3rem,env(safe-area-inset-top))] text-center">
      <StepIndicator step={step} />
      <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">Pick a few habits to start</h1>
      <p className="max-w-xs text-sm text-[var(--color-text-secondary)]">
        You can add, edit, or remove any of these later.
      </p>

      <div className="flex w-full max-w-xs flex-col gap-3">
        {STARTER_TEMPLATES.map((t) => {
          const selected = selectedTemplateIds.has(t.id)
          return (
            <button
              key={t.id}
              onClick={() => toggleTemplate(t.id)}
              aria-pressed={selected}
              className="flex items-center justify-between rounded-[var(--radius-md)] border px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              style={{
                borderColor: selected ? 'var(--color-accent)' : 'var(--color-border)',
                background: selected ? 'var(--color-surface)' : 'transparent',
              }}
            >
              <span className="text-base font-medium text-[var(--color-text-primary)]">{t.name}</span>
              <span className="text-sm text-[var(--color-text-secondary)]">
                {t.frequencyType === 'daily' ? 'Daily' : `${t.frequencyValue}×/week`}
              </span>
            </button>
          )
        })}

        {customHabits.map((c, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-accent)] px-4 py-3 text-left"
          >
            <span className="text-base font-medium text-[var(--color-text-primary)]">{c.name}</span>
            <span className="text-sm text-[var(--color-text-secondary)]">
              {c.frequencyType === 'daily' ? 'Daily' : `${c.frequencyValue}×/week`}
            </span>
          </div>
        ))}

        <div className="mt-2 flex flex-col gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-3">
          <label className="sr-only" htmlFor="onboarding-custom-habit">
            Add your own habit
          </label>
          <input
            id="onboarding-custom-habit"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Add your own"
            className="rounded-[var(--radius-sm)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setCustomFrequency('daily')}
              aria-pressed={customFrequency === 'daily'}
              className="min-h-11 flex-1 rounded-[var(--radius-sm)] px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              style={{
                background: customFrequency === 'daily' ? 'var(--color-accent)' : 'transparent',
                color: customFrequency === 'daily' ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
              }}
            >
              Daily
            </button>
            <button
              onClick={() => setCustomFrequency('weekly')}
              aria-pressed={customFrequency === 'weekly'}
              className="min-h-11 flex-1 rounded-[var(--radius-sm)] px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              style={{
                background: customFrequency === 'weekly' ? 'var(--color-accent)' : 'transparent',
                color: customFrequency === 'weekly' ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
              }}
            >
              3×/week
            </button>
            <SecondaryButton className="min-h-11 px-4 py-3 text-sm" onClick={addCustomHabit} disabled={!customName.trim()}>
              Add
            </SecondaryButton>
          </div>
        </div>
      </div>

      <PrimaryButton className="mt-2 w-full max-w-xs" onClick={finish} disabled={saving || !hasSelection}>
        Get started
      </PrimaryButton>
      {!hasSelection && (
        <p className="text-xs text-[var(--color-text-secondary)]">Pick at least one habit to continue.</p>
      )}
    </main>
  )
}
