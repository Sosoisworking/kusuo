import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { PrimaryButton, SecondaryButton } from '../components/Button'
import { createHabit } from '../db/habits'
import { seedExercises } from '../db/exercises'
import { appendBodyweight } from '../db/bodyweight'
import { instantiateTemplate } from '../db/splits'
import { todayLocalDate } from '../lib/date'
import { toKg } from '../lib/units'
import Segmented from '../components/Segmented'
import { SPLIT_TEMPLATES } from '../lib/splitTemplates'
import { completeOnboarding, createSettings, getOrCreateDeviceId, getSettings, updateSettings } from '../db/settings'
import type { DeviceRole, FrequencyType, Units } from '../db/schema'
import { STARTER_TEMPLATES } from '../lib/templates'

type Step = 'loading' | 'welcome' | 'role' | 'confirmReader' | 'name' | 'templates' | 'split'

const WRITER_STEP_NUMBER: Record<Step, number | undefined> = {
  loading: undefined,
  welcome: undefined,
  role: 1,
  confirmReader: undefined,
  name: 2,
  templates: 3,
  split: 4,
}

function StepIndicator({ step }: { step: Step }) {
  const current = WRITER_STEP_NUMBER[step]
  if (!current) return null
  return (
    <div className="flex gap-2" aria-label={`Step ${current} of 4`}>
      {[1, 2, 3, 4].map((n) => (
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
  const [units, setUnits] = useState<Units>('kg')
  const [bodyweight, setBodyweight] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    getSettings(deviceId).then((settings) => {
      if (cancelled) return
      if (!settings) {
        setStep('welcome')
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
    // Becoming a writer is what earns the movement directory. App.tsx seeds on
    // launch too, but that runs before settings exist on a first run, so
    // without this a new install has no exercises until its second launch.
    // seedExercises is idempotent, so both triggers are safe.
    void seedExercises()
    setStep('name')
  }

  async function confirmReader() {
    await createSettings({ deviceId, deviceRole: 'reader' })
    await completeOnboarding(deviceId)
    navigate('/', { replace: true })
  }

  /** Name and units together, both optional. Skipping leaves the defaults. */
  async function submitYou(skip = false) {
    const trimmed = name.trim()
    await updateSettings(deviceId, {
      userName: skip || !trimmed ? undefined : trimmed,
      units: skip ? 'kg' : units,
    })
    const typed = Number(bodyweight)
    if (!skip && bodyweight.trim() && Number.isFinite(typed) && typed > 0) {
      await appendBodyweight(todayLocalDate(), toKg(typed, units), deviceId)
    }
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
      const habit = await createHabit({
        name: t.name,
        frequencyType: t.frequencyType,
        frequencyValue: t.frequencyValue,
      })
      // Point training at its habit. Nothing else assigns trainingHabitId, so
      // without this a finished session has no habit to tick.
      if (t.isTraining) await updateSettings(deviceId, { trainingHabitId: habit.id })
    }
    for (const c of customHabits) {
      await createHabit({ name: c.name, frequencyType: c.frequencyType, frequencyValue: c.frequencyValue })
    }
    setSaving(false)
    setStep('split')
  }

  /**
   * The last step, and the one that was missing: without it a fresh install
   * landed on Today with no training set up and had to find Splits alone.
   * Skipping is allowed — Train offers the same picker.
   */
  async function chooseSplit(templateId: string | null) {
    setSaving(true)
    try {
      if (templateId) await instantiateTemplate(templateId)
      await completeOnboarding(deviceId)
      navigate('/', { replace: true })
    } finally {
      setSaving(false)
    }
  }

  if (step === 'loading') return null

  if (step === 'welcome') {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-5 px-6 pt-[max(3rem,env(safe-area-inset-top))]">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-accent)]">Kusuo</span>
          <h1 className="text-[28px] font-medium tracking-[-0.02em] text-[var(--color-text-primary)]">
            Habits, and the training that goes with them
          </h1>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          A few daily habits, and a proper log for the days you lift. No streak-shaming, no account,
          no server — this phone holds the only copy.
        </p>
        <ul className="flex flex-col">
          {[
            'Today shows what is left and what is next — nothing else.',
            'Train logs weight, reps and RPE set by set, from your split.',
            'This iPhone writes. A Mac can read your history, never edit it.',
          ].map((line) => (
            <li
              key={line}
              className="py-2.5 text-sm text-[var(--color-text-primary)]"
              style={{ borderBottom: '1px solid var(--color-divider)' }}
            >
              {line}
            </li>
          ))}
        </ul>
        <PrimaryButton onClick={() => setStep('role')}>Set it up</PrimaryButton>
      </main>
    )
  }

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
      <main className="flex min-h-dvh flex-col justify-center gap-5 px-6 pt-[max(3rem,env(safe-area-inset-top))]">
        <StepIndicator step={step} />
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">
            A little about you
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Only what the app needs to show sensible numbers. Skip any of it.
          </p>
        </div>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            submitYou()
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              What should I call you
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-base text-[var(--color-text-primary)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              Bodyweight
            </span>
            <input
              inputMode="decimal"
              value={bodyweight}
              onChange={(e) => setBodyweight(e.target.value)}
              placeholder={units}
              className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-base text-[var(--color-text-primary)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            />
          </label>

          <Segmented<Units>
            label="Weight units"
            value={units}
            onChange={setUnits}
            options={[
              { value: 'kg', label: 'Kilograms' },
              { value: 'lb', label: 'Pounds' },
            ]}
          />

          <PrimaryButton type="submit">Continue</PrimaryButton>
          <button
            type="button"
            onClick={() => submitYou(true)}
            className="min-h-11 text-sm text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            Skip — I'll fill this in later
          </button>
        </form>
      </main>
    )
  }


  // templates
  if (step === 'split') {
    return (
      <main className="flex min-h-dvh flex-col gap-5 px-6 pb-10 pt-[max(3rem,env(safe-area-inset-top))]">
        <StepIndicator step={step} />
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">
            Which split are you running?
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Comes in as a template you can rearrange. Switch or edit it whenever.
          </p>
        </div>
        <ul className="flex flex-col">
          {SPLIT_TEMPLATES.map((template) => (
            <li key={template.id}>
              <button
                onClick={() => chooseSplit(template.id)}
                disabled={saving}
                className="flex min-h-11 w-full items-center justify-between gap-3 py-3 text-left disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                style={{ borderBottom: '1px solid var(--color-divider)' }}
              >
                <span className="text-sm text-[var(--color-text-primary)]">{template.name}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {template.days.length} days
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button
          onClick={() => chooseSplit(null)}
          disabled={saving}
          className="min-h-11 text-sm text-[var(--color-text-secondary)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          Skip — I'm not lifting yet
        </button>
      </main>
    )
  }

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
