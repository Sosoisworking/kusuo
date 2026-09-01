import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router'
import BackLink from '../components/BackLink'
import { PrimaryButton, SecondaryButton } from '../components/Button'
import {
  buildBackup,
  importBackup,
  InvalidBackupError,
  isReverseImport,
  parseBackup,
  recordBackupExported,
  serializeBackup,
  type BackupPayload,
} from '../db/backup'
import { db, type Settings as SettingsType } from '../db/schema'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import { todayLocalDate } from '../lib/date'

function formatBackupDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function deviceRoleText(role: SettingsType['deviceRole']): string {
  return role === 'writer'
    ? 'Where you log. Your Mac only reads.'
    : 'View only. Log on your iPhone.'
}

/**
 * Everything that moves data in or out of the device, on one screen.
 *
 * These sat among the preferences, which put "erase everything" a thumb's width
 * from "dark mode". Consequence belongs together and behind a step.
 */
export default function YourData() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<SettingsType | undefined>()
  const [error, setError] = useState<string | null>(null)

  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<BackupPayload | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [resetOpen, setResetOpen] = useState(false)
  const [resetTyped, setResetTyped] = useState('')
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    let cancelled = false
    getSettings(getOrCreateDeviceId()).then((s) => {
      if (cancelled) return
      setSettings(s)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleExport() {
    if (!settings) return
    setExporting(true)
    setError(null)
    try {
      const payload = await buildBackup()
      const blob = new Blob([serializeBackup(payload)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kusuo-backup-${todayLocalDate()}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      await recordBackupExported(settings.deviceId)
      setSettings((s) => (s ? { ...s, lastBackupAt: Date.now() } : s))
    } catch {
      setError("Couldn't export — give it another tap.")
    } finally {
      setExporting(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportError(null)
    setImportSuccess(null)
    try {
      const payload = parseBackup(await file.text())
      if (await isReverseImport(payload)) setPendingImport(payload)
      else await runImport(payload)
    } catch (err) {
      setImportError(
        err instanceof InvalidBackupError
          ? err.message
          : "Couldn't read that file — give it another tap.",
      )
    }
  }

  async function runImport(payload: BackupPayload) {
    setImporting(true)
    setImportError(null)
    try {
      await importBackup(payload)
      setImportSuccess(
        `Imported ${payload.habits.length} habit${payload.habits.length === 1 ? '' : 's'}.`,
      )
      setPendingImport(null)
    } catch {
      setImportError("Couldn't import — give it another tap.")
    } finally {
      setImporting(false)
    }
  }

  /**
   * Clears this device and returns to the first-run questions. Settings go too,
   * so the device role is asked again rather than silently inherited. The
   * deviceId in localStorage is kept deliberately — it identifies the hardware,
   * not the record, and reusing it keeps event authorship consistent.
   */
  async function handleReset() {
    setResetting(true)
    setError(null)
    try {
      await db.transaction(
        'rw',
        [
          db.habits,
          db.habitEvents,
          db.goals,
          db.reflections,
          db.exercises,
          db.splits,
          db.sessionEvents,
          db.sessionMarks,
          db.settings,
        ],
        async () => {
          await Promise.all([
            db.habits.clear(),
            db.habitEvents.clear(),
            db.goals.clear(),
            db.reflections.clear(),
            db.exercises.clear(),
            db.splits.clear(),
            db.sessionEvents.clear(),
            db.sessionMarks.clear(),
            db.settings.clear(),
          ])
        },
      )
      window.location.replace(`${import.meta.env.BASE_URL}onboarding`)
    } catch {
      setResetting(false)
      setError("Couldn't erase everything — nothing was removed.")
    }
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

  if (pendingImport) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 pb-28 pt-[max(3rem,env(safe-area-inset-top))] text-center">
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">
          This device has newer data
        </h1>
        <p className="max-w-xs text-sm text-[var(--color-text-secondary)]">
          Importing this backup replaces what's here — including activity newer than the backup
          itself. That newer data will be lost.
        </p>
        {importError && (
          <p role="alert" className="text-xs text-[var(--color-text-secondary)]">
            {importError}
          </p>
        )}
        <div className="flex w-full max-w-xs flex-col gap-3">
          <PrimaryButton onClick={() => runImport(pendingImport)} disabled={importing}>
            {importing ? 'Importing…' : 'Import anyway'}
          </PrimaryButton>
          <SecondaryButton onClick={() => setPendingImport(null)} disabled={importing}>
            Go back
          </SecondaryButton>
        </div>
      </main>
    )
  }

  if (resetOpen) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 pb-28 pt-[max(3rem,env(safe-area-inset-top))] text-center">
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7 text-[var(--color-accent)]"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          aria-hidden="true"
        >
          <path d="M12 3.5 1.8 20.5h20.4L12 3.5Z" strokeLinejoin="round" />
          <path d="M12 10v4.5M12 17.4v.1" strokeLinecap="round" />
        </svg>
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">Reset all data?</h1>
        <p className="max-w-xs text-sm text-[var(--color-text-secondary)]">
          Deletes every habit, session, record and reflection on this device. There is no backup
          unless you exported one. This cannot be undone.
        </p>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <SecondaryButton onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export first'}
          </SecondaryButton>
          <label className="flex flex-col gap-1 text-left text-sm text-[var(--color-text-secondary)]">
            Type RESET to confirm
            <input
              value={resetTyped}
              onChange={(event) => setResetTyped(event.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            />
          </label>
          <SecondaryButton
            onClick={handleReset}
            disabled={resetTyped.trim() !== 'RESET' || resetting}
          >
            {resetting ? 'Erasing…' : 'Reset all data'}
          </SecondaryButton>
          <SecondaryButton
            onClick={() => {
              setResetOpen(false)
              setResetTyped('')
            }}
          >
            Keep my data
          </SecondaryButton>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-5 pb-28 pt-[max(3rem,env(safe-area-inset-top))]">
      <BackLink label="Back to Settings" />

      <header className="flex flex-col gap-0.5">
        <span className="text-xs text-[var(--color-text-secondary)]">Export, import, reset</span>
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">Your data</h1>
      </header>

      {error && (
        <p role="alert" className="text-xs text-[var(--color-text-secondary)]">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Export as JSON</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Habits, sessions, records and reflections.{' '}
            {settings.lastBackupAt
              ? `Last export ${formatBackupDate(settings.lastBackupAt)}.`
              : 'Never exported.'}
          </p>
        </div>
        <PrimaryButton onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export as JSON'}
        </PrimaryButton>
      </section>

      {isWriter && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium text-[var(--color-text-primary)]">
              Import a backup
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Replaces everything on this device with the file's contents.
            </p>
          </div>
          <SecondaryButton onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? 'Importing…' : 'Pick a file'}
          </SecondaryButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleFileChange}
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
          />
          {importError && (
            <p role="alert" className="text-xs text-[var(--color-text-secondary)]">
              {importError}
            </p>
          )}
          {importSuccess && (
            <p role="status" className="text-xs text-[var(--color-text-secondary)]">
              {importSuccess}
            </p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-[var(--color-text-primary)]">
          {isWriter ? 'This iPhone' : 'This Mac'}
        </h2>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {deviceRoleText(settings.deviceRole)}
        </p>
      </section>

      {isWriter && (
        <section
          className="flex flex-col gap-3 rounded-[var(--radius-md)] p-4"
          style={{ boxShadow: 'inset 0 0 0 1px var(--color-border)' }}
        >
          <div className="flex items-center gap-2">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 shrink-0 text-[var(--color-accent)]"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              aria-hidden="true"
            >
              <path d="M12 3.5 1.8 20.5h20.4L12 3.5Z" strokeLinejoin="round" />
              <path d="M12 10v4.5M12 17.4v.1" strokeLinecap="round" />
            </svg>
            <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Reset all data</h2>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Deletes every habit, session, record and reflection on this device. There is no backup
            unless you exported one. This cannot be undone.
          </p>
          <SecondaryButton onClick={() => setResetOpen(true)}>Reset all data…</SecondaryButton>
        </section>
      )}

      <p className="text-xs text-[var(--color-text-secondary)]">
        No account, no server, no telemetry. The export file is the only copy that ever leaves this
        device.
      </p>
    </main>
  )
}
