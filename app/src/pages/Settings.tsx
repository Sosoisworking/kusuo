import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { PrimaryButton, SecondaryButton } from '../components/Button'
import Screen from '../components/Screen'
import Segmented from '../components/Segmented'
import { listActiveHabits } from '../db/habits'
import type { Habit, Settings as SettingsType, Theme, Units, WeekStart } from '../db/schema'
import { getOrCreateDeviceId, getSettings, signOutDevice, updateSettings } from '../db/settings'
import { applyTheme } from '../lib/theme'

const SET_CHOICES = [2, 3, 4, 5]

/**
 * The stamp is minted in UTC by vite.config.ts, so "05:40" read against a phone
 * showing 06:40 says nothing about which build is running. Shown in the
 * device's own clock with the zone named, it can be compared to the status bar.
 * A stamp that is not an instant — the test build calls itself "test" — is
 * shown exactly as it came.
 */
function formatBuild(id: string): string {
  const at = new Date(`${id.replace(' ', 'T')}:00Z`)
  if (Number.isNaN(at.getTime())) return id
  // Not dateStyle/timeStyle: naming the zone is only allowed alongside the
  // individual components, and the zone is the whole point of this line.
  return at.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

export default function Settings() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<SettingsType | undefined>()
  const [habits, setHabits] = useState<Habit[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  const needRefreshRef = useRef(needRefresh)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<string | null>(null)
  const [confirmingLogOut, setConfirmingLogOut] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  /*
    A waiting build is offered, never taken.

    This used to call `updateServiceWorker(true)` the moment one arrived, which
    skips waiting and reloads the page. `registerType` is 'prompt' and there was
    no prompt: the screen could reload under a half-typed name, and because the
    reload happened before the check's own two-second wait was up, the only
    status the button could ever show was "You're up to date." A new version is
    now a button you press when you are ready.
  */
  useEffect(() => {
    needRefreshRef.current = needRefresh
  }, [needRefresh])

  useEffect(() => {
    let cancelled = false
    Promise.all([getSettings(getOrCreateDeviceId()), listActiveHabits()]).then(([s, h]) => {
      if (cancelled) return
      setSettings(s)
      setHabits(h)
      setName(s?.userName ?? '')
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleCheckForUpdate() {
    setCheckingUpdate(true)
    setUpdateStatus(null)
    /*
      Offline, `update()` rejects because the script cannot be fetched. That is
      not a failure worth retrying — telling someone on a train to tap again
      sends them round a loop that cannot close until they have signal.

      `navigator.onLine` only reads the failure; it never gates the attempt. It
      answers "attached to a network", not "can reach the server", and it is
      wrong in both directions — measured false on a simulator that was serving
      this very page. Trusting it up front would refuse a check that would have
      worked.
    */
    const offline = () => navigator.onLine === false
    try {
      const registration = await navigator.serviceWorker?.getRegistration()
      await registration?.update()
    } catch {
      // The connection can drop between the check above and the fetch below.
      setUpdateStatus(
        offline()
          ? 'No connection — Kusuo will look again when you are back online.'
          : "Couldn't reach the update — give it another tap.",
      )
      setCheckingUpdate(false)
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setCheckingUpdate(false)
    // Finding one is not a message: `needRefresh` puts the offer on the screen,
    // and saying both would be the same news twice.
    if (!needRefreshRef.current) setUpdateStatus("You're up to date.")
  }

  /**
   * Saves optimistically and puts the old value back if the write fails. A
   * setting that appears to take and silently did not is worse than one that
   * visibly refuses.
   */
  async function save(changes: Partial<SettingsType>) {
    if (!settings) return
    const previous = settings
    const next = { ...settings, ...changes }
    setSettings(next)
    setError(null)
    if (changes.theme) applyTheme(changes.theme)
    try {
      await updateSettings(settings.deviceId, changes)
    } catch {
      setSettings(previous)
      if (changes.theme) applyTheme(previous.theme)
      setError("Couldn't save that — give it another tap.")
    }
  }

  /**
   * Forgets this device and returns to the first-run questions. The record is
   * not read or written — logging out is not resetting, and the difference is
   * the whole reason this button needed a step in front of it.
   */
  async function handleLogOut() {
    if (!settings) return
    setLoggingOut(true)
    setError(null)
    try {
      await signOutDevice(settings.deviceId)
      // The theme was one of the preferences just forgotten, so the app stops
      // holding it rather than carrying it into a device with no settings.
      applyTheme('system')
      navigate('/onboarding', { replace: true })
    } catch {
      setLoggingOut(false)
      setError("Couldn't log out — give it another tap.")
    }
  }

  async function saveName() {
    if (!settings) return
    const trimmed = name.trim()
    if (trimmed === (settings.userName ?? '')) return
    await save({ userName: trimmed || undefined })
  }

  if (loading) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6">
        <div className="h-6 w-32 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface)]" />
        <div className="h-4 w-24 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface)]" />
      </main>
    )
  }
  if (!settings || !settings.onboardingComplete) return <Navigate to="/onboarding" replace />

  const isWriter = settings.deviceRole === 'writer'

  return (
    <Screen title="Settings" eyebrow="Defaults and data">
      {error && (
        <p role="alert" className="text-xs text-[var(--color-text-secondary)]">
          {error}
        </p>
      )}

      <Segmented<Units>
        label="Weight units"
        value={settings.units}
        onChange={(units) => save({ units })}
        options={[
          { value: 'kg', label: 'Kilograms' },
          { value: 'lb', label: 'Pounds' },
        ]}
      />

      <Segmented<WeekStart>
        label="Week starts on"
        hint="Drives the week strip, the calendar and every weekly target."
        value={settings.weekStart}
        onChange={(weekStart) => save({ weekStart })}
        options={[
          { value: 'monday', label: 'Monday' },
          { value: 'sunday', label: 'Sunday' },
        ]}
      />

      <Segmented<Theme>
        label="Theme"
        value={settings.theme}
        onChange={(theme) => save({ theme })}
        options={[
          { value: 'system', label: 'Auto' },
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' },
        ]}
      />

      {isWriter && (
        <Segmented<string>
          label="Sets per new exercise"
          hint="What a movement starts with when you add it from the directory."
          value={String(settings.defaultSets)}
          onChange={(value) => save({ defaultSets: Number(value) })}
          options={SET_CHOICES.map((n) => ({ value: String(n), label: String(n) }))}
        />
      )}

      {isWriter && (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">Your name</span>
          <input
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            placeholder="Your name"
            className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-base text-[var(--color-text-primary)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          />
        </label>
      )}

      {/*
        Which habit a finished session ticks. It is set at onboarding only if the
        Fitness template was kept, so without this a session can silently tick
        nothing and the promise on Today goes unmet.
      */}
      {isWriter && habits.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-[var(--color-text-primary)]">
            Training habit
          </legend>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Finishing a session ticks this off for that day.
          </p>
          <div className="flex flex-col">
            {habits.map((habit) => {
              const chosen = habit.id === settings.trainingHabitId
              return (
                <button
                  key={habit.id}
                  type="button"
                  aria-pressed={chosen}
                  onClick={() =>
                    save({ trainingHabitId: chosen ? undefined : habit.id })
                  }
                  className="flex min-h-11 items-center justify-between gap-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                  style={{ borderBottom: '1px solid var(--color-divider)' }}
                >
                  <span className="text-sm text-[var(--color-text-primary)]">{habit.name}</span>
                  {chosen && <span className="text-xs text-[var(--color-accent)]">Ticked</span>}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      <Link
        to="/settings/data"
        className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      >
        <span className="flex flex-col">
          <span className="text-sm text-[var(--color-text-primary)]">Your data</span>
          <span className="text-xs text-[var(--color-text-secondary)]">
            Export, import, reset
          </span>
        </span>
        <span aria-hidden="true" className="text-[var(--color-text-secondary)]">
          ›
        </span>
      </Link>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Updates</h2>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Installed to your home screen? New versions wait quietly until you check.
        </p>
        {needRefresh ? (
          <>
            <p role="status" className="text-xs text-[var(--color-text-primary)]">
              A new version is ready. Reloading takes a second and changes nothing you have
              logged.
            </p>
            <PrimaryButton onClick={() => updateServiceWorker(true)}>
              Reload into the new version
            </PrimaryButton>
          </>
        ) : (
          <>
            <SecondaryButton onClick={handleCheckForUpdate} disabled={checkingUpdate}>
              {checkingUpdate ? 'Checking…' : 'Check for updates'}
            </SecondaryButton>
            {updateStatus && (
              <p role="status" className="text-xs text-[var(--color-text-secondary)]">
                {updateStatus}
              </p>
            )}
          </>
        )}
        {/* Naming the running build is what makes the button above checkable. */}
        <p className="text-xs text-[var(--color-text-secondary)]">Build {formatBuild(__BUILD_ID__)}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Log out</h2>
        <p className="text-xs text-[var(--color-text-secondary)]">
          There is no account here, so this is the nearest true thing: this {isWriter ? 'iPhone' : 'Mac'}{' '}
          forgets its role, your name and these preferences, and asks the first-run questions again.
          Your habits, sessions, goals and reflections are untouched.
        </p>
        {confirmingLogOut ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-[var(--color-text-primary)]">
              Log out of this {isWriter ? 'iPhone' : 'Mac'}?
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Nothing is deleted. Erasing the record itself is Your data › Reset all data.
            </p>
            {/* The way back is the filled one: logging out is the step with a
                consequence, even though the consequence is not deletion. */}
            <PrimaryButton onClick={() => setConfirmingLogOut(false)} disabled={loggingOut}>
              Stay logged in
            </PrimaryButton>
            <SecondaryButton onClick={handleLogOut} disabled={loggingOut}>
              {loggingOut ? 'Logging out…' : 'Log out'}
            </SecondaryButton>
          </div>
        ) : (
          <SecondaryButton onClick={() => setConfirmingLogOut(true)}>Log out</SecondaryButton>
        )}
      </section>
    </Screen>
  )
}
