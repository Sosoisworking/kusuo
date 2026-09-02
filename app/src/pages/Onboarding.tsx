import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { PrimaryButton, SecondaryButton } from '../components/Button'
import { createHabit } from '../db/habits'
import { seedExercises } from '../db/exercises'
import { appendBodyweight } from '../db/bodyweight'
import { importBackup, InvalidBackupError, parseBackup } from '../db/backup'
import { instantiateTemplate } from '../db/splits'
import { todayLocalDate } from '../lib/date'
import { toKg } from '../lib/units'
import Segmented from '../components/Segmented'
import { SPLIT_TEMPLATES } from '../lib/splitTemplates'
import { completeOnboarding, createSettings, getOrCreateDeviceId, getSettings, updateSettings } from '../db/settings'
import type { DeviceRole, FrequencyType, Units } from '../db/schema'
import { STARTER_TEMPLATES } from '../lib/templates'

type Step =
  | 'loading'
  | 'welcome'
  | 'restore'
  | 'role'
  | 'confirmReader'
  | 'name'
  | 'templates'
  | 'split'

/**
 * The numbered part of the writer path. Setting up from scratch asks four
 * questions; arriving with a backup has already answered the last two, so the
 * dots count to two rather than lying about how much is left.
 */
const SETUP_STEPS: Step[] = ['role', 'name', 'templates', 'split']
const RESTORE_STEPS: Step[] = ['role', 'name']

/**
 * True when this is the installed home-screen app rather than a Safari tab.
 *
 * iOS gives a standalone web app a storage partition of its own, so an install
 * opens to an empty database even when Safari is full of the same user's
 * history. That is not something the app can fix, so the first run has to say
 * it — and it should only say it where it is true.
 */
function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    // iOS set this long before it supported the media query, and still does.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function StepIndicator({ step, steps }: { step: Step; steps: Step[] }) {
  const index = steps.indexOf(step)
  if (index < 0) return null
  return (
    <div className="flex gap-2" role="img" aria-label={`Step ${index + 1} of ${steps.length}`}>
      {steps.map((s, i) => (
        <span
          key={s}
          className="h-1.5 w-6 rounded-full"
          style={{ background: i <= index ? 'var(--color-accent)' : 'var(--color-border)' }}
        />
      ))}
    </div>
  )
}

/**
 * One frame for every step.
 *
 * Each step used to choose its own top padding and its own vertical alignment,
 * so the dots sat against the Dynamic Island on two of them and halfway down an
 * empty screen on the other two. Here they start on the same line every time —
 * `--space-safe-top`, which is the status-bar inset plus a breath when the app
 * is installed and 2.5rem in Safari, where there is no inset.
 */
function StepFrame({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <main
      className={`flex min-h-dvh flex-col gap-6 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[var(--space-safe-top)] ${className}`}
    >
      {children}
    </main>
  )
}

export default function Onboarding() {
  const navigate = useNavigate()
  const [deviceId] = useState(getOrCreateDeviceId)
  const [standalone] = useState(isStandalone)
  const [step, setStep] = useState<Step>('loading')
  const [name, setName] = useState('')
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set())
  const [customHabits, setCustomHabits] = useState<{ name: string; frequencyType: FrequencyType; frequencyValue: number }[]>([])
  const [customName, setCustomName] = useState('')
  const [customFrequency, setCustomFrequency] = useState<'daily' | 'weekly'>('daily')
  const [units, setUnits] = useState<Units>('kg')
  const [bodyweight, setBodyweight] = useState('')
  const [saving, setSaving] = useState(false)
  const [restored, setRestored] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const restoreInputRef = useRef<HTMLInputElement>(null)

  const steps = restored ? RESTORE_STEPS : SETUP_STEPS

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

  /**
   * The bridge across the storage partition, and the reason it lives here
   * rather than on Your data: that screen is behind `onboardingComplete`, so
   * before this existed the only route to an import was to set the app up from
   * scratch first and then replace it — which reads, correctly, like being
   * asked to throw the old data away.
   *
   * No reverse-import guard. That check asks whether this device holds writes
   * newer than the file; a device that has not finished its first run holds
   * none, which is the precondition for being on this screen at all.
   */
  async function handleRestoreFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setRestoreError(null)
    setRestoring(true)
    try {
      await importBackup(parseBackup(await file.text()))
      setRestored(true)
      setStep('role')
    } catch (err) {
      setRestoreError(
        err instanceof InvalidBackupError
          ? err.message
          : "Couldn't read that file — pick it again.",
      )
    } finally {
      setRestoring(false)
    }
  }

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
    // A restored device already has its habits and its split. Sending it on to
    // the pickers would offer to create a second set on top of the first.
    if (restored) {
      await completeOnboarding(deviceId)
      navigate('/', { replace: true })
      return
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
      <StepFrame className="gap-5">
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
        {/*
          Said here, and only here, because here is where it is true. An install
          opens on an empty first run even when Safari is full of the same
          user's history, and saying nothing lets them conclude the data is
          gone. It is not — it is on the other side of a partition iOS will not
          let the app reach, and the export file is the way across.
        */}
        {standalone && (
          <div className="flex flex-col gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Used Kusuo in Safari before this?
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              iOS gives an installed app its own storage, separate from the browser's. Nothing you
              logged in Safari was deleted — it is still in Safari. Bring it over with an export.
            </p>
          </div>
        )}
        {/* Anchored low: the reading is at the top, the actions are under the thumb. */}
        <div className="mt-auto flex flex-col gap-3 pt-4">
          <PrimaryButton onClick={() => setStep('role')}>Set it up</PrimaryButton>
          <SecondaryButton onClick={() => setStep('restore')}>
            I have a Kusuo backup
          </SecondaryButton>
        </div>
      </StepFrame>
    )
  }

  if (step === 'restore') {
    return (
      <StepFrame className="gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">
            Bring your data over
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            A backup file carries every habit, session, record and reflection. It replaces what is
            on this device, which on a first run is nothing.
          </p>
        </div>
        <ol className="flex flex-col">
          {[
            'In Safari, open Kusuo and go to Settings, then Your data.',
            'Tap Export as JSON and save the file — Files, or anywhere you can find it again.',
            'Come back here and pick it.',
          ].map((line, i) => (
            <li
              key={line}
              className="flex gap-3 py-2.5 text-sm text-[var(--color-text-primary)]"
              style={{ borderBottom: '1px solid var(--color-divider)' }}
            >
              <span aria-hidden="true" className="text-[var(--color-text-secondary)]">
                {i + 1}
              </span>
              {line}
            </li>
          ))}
        </ol>
        {restoreError && (
          <p role="alert" className="text-xs text-[var(--color-text-secondary)]">
            {restoreError}
          </p>
        )}
        <input
          ref={restoreInputRef}
          type="file"
          accept="application/json"
          onChange={handleRestoreFile}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />
        <div className="mt-auto flex flex-col gap-3 pt-4">
          <PrimaryButton onClick={() => restoreInputRef.current?.click()} disabled={restoring}>
            {restoring ? 'Importing…' : 'Pick a backup file'}
          </PrimaryButton>
          <SecondaryButton onClick={() => setStep('welcome')} disabled={restoring}>
            Go back
          </SecondaryButton>
        </div>
      </StepFrame>
    )
  }

  if (step === 'role') {
    return (
      <StepFrame>
        <StepIndicator step={step} steps={steps} />
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">
            Which device is this?
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Your iPhone is where you'll check things off — your Mac is just for looking back.
          </p>
        </div>
        {restored && (
          <p role="status" className="text-sm text-[var(--color-accent)]">
            Your backup is in. Two questions left.
          </p>
        )}
        <div className="mt-auto flex flex-col gap-3">
          <PrimaryButton onClick={() => pickRole('writer')}>This is my iPhone</PrimaryButton>
          <SecondaryButton onClick={() => pickRole('reader')}>This is my Mac</SecondaryButton>
        </div>
      </StepFrame>
    )
  }

  if (step === 'confirmReader') {
    return (
      <StepFrame>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">Just to confirm</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            This device will be view-only — you'll see your habits here, but you'll always check
            them off on your iPhone.
          </p>
        </div>
        <div className="mt-auto flex flex-col gap-3">
          <PrimaryButton onClick={confirmReader}>Sounds right</PrimaryButton>
          <SecondaryButton onClick={() => setStep('role')}>Go back</SecondaryButton>
        </div>
      </StepFrame>
    )
  }

  if (step === 'name') {
    return (
      <StepFrame className="gap-5">
        <StepIndicator step={step} steps={steps} />
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
              // No autoFocus: opening the keyboard on arrival hides Continue
              // and Skip behind it before you have read the question.
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
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

          {/*
            The one step whose actions are not anchored to the foot of the
            screen. The keyboard is up here, and `100dvh` does not shrink for
            it on iOS, so a bottom-anchored Continue would sit underneath it.
          */}
          <PrimaryButton type="submit">Continue</PrimaryButton>
          <button
            type="button"
            onClick={() => submitYou(true)}
            className="min-h-11 text-sm text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            Skip — I'll fill this in later
          </button>
        </form>
      </StepFrame>
    )
  }

  if (step === 'split') {
    return (
      <StepFrame className="gap-5">
        <StepIndicator step={step} steps={steps} />
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
        {/*
          Not row eight. Grey text directly under a seven-row list is read as a
          dimmed member of that list, which is why it could not be found at all.
          It is a different kind of answer, so it leaves the list, sits at the
          foot of the screen where every other step puts its actions, and takes
          the accent that marks the interactive thing everywhere else in
          Nocturne. It stays quieter than choosing by being one line against
          seven, with no fill behind it.
        */}
        <div className="mt-auto flex flex-col gap-1 pt-6">
          <button
            onClick={() => chooseSplit(null)}
            disabled={saving}
            className="min-h-11 self-start text-left text-sm font-medium text-[var(--color-accent)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            I'm not lifting yet
          </button>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Kusuo works on habits alone. Train has the same list when you want one.
          </p>
        </div>
      </StepFrame>
    )
  }

  // templates
  return (
    <StepFrame>
      <StepIndicator step={step} steps={steps} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">
          Pick a few habits to start
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          You can add, edit, or remove any of these later.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
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

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <PrimaryButton onClick={finish} disabled={saving || !hasSelection}>
          Get started
        </PrimaryButton>
        {!hasSelection && (
          <p className="text-xs text-[var(--color-text-secondary)]">
            Pick at least one habit to continue.
          </p>
        )}
      </div>
    </StepFrame>
  )
}
