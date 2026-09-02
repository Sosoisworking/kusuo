import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router'
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
import type { Settings as SettingsType } from '../db/schema'
import { clearEverything } from '../db/tables'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import { todayLocalDate } from '../lib/date'
import { decodeWorkout, findWorkoutCode, InvalidWorkoutCodeError } from '../lib/share'
import { getActiveSplit, importWorkoutAsDay } from '../db/splits'

function formatBackupDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * What became of the file.
 *
 * Only `saved` may be recorded. It means the platform told us the hand-off
 * finished — not that the file still exists, which nothing here can know.
 * `cancelled` is the share sheet dismissed, and `unconfirmed` is a download the
 * browser reports nothing back about: on iOS its prompt can still be sitting
 * there unanswered, which is how the app came to claim a backup that was never
 * written.
 */
type ExportOutcome = 'saved' | 'cancelled' | 'unconfirmed'

function backupFile(payload: BackupPayload): File {
  return new File([serializeBackup(payload)], `kusuo-backup-${todayLocalDate()}.json`, {
    type: 'application/json',
  })
}

/**
 * How the file can leave this device.
 *
 * `share` hands it to the OS and resolves only once the hand-off finished —
 * Save to Files included. `download` is a desktop browser, where the anchor
 * writes the file itself. `preview` is the installed app with no share sheet:
 * the same anchor opens an in-app preview with "Open in…", saves nothing on
 * its own, and reports nothing back, so it must never be promised as a
 * download or recorded as a backup.
 */
type Delivery = 'share' | 'download' | 'preview'

/** True in the installed home-screen app, where a download is not a download. */
function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function deliveryFor(file: File): Delivery {
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    return 'share'
  }
  return isStandalone() ? 'preview' : 'download'
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function deliverBackup(file: File): Promise<ExportOutcome> {
  const route = deliveryFor(file)
  if (route !== 'share') {
    downloadFile(file)
    // A desktop download is the file being written. A preview is not.
    return route === 'download' ? 'saved' : 'unconfirmed'
  }
  try {
    await navigator.share({ files: [file], title: file.name })
    return 'saved'
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    // The share sheet exists and refused. A download is still a way out, but on
    // this device it is the preview that saves nothing, so it is never recorded.
    downloadFile(file)
    return 'unconfirmed'
  }
}

/** What the app can honestly say about the last copy that left this device. */
function lastExportLine(lastBackupAt: number | undefined): string {
  return lastBackupAt
    ? `Last copy exported ${formatBackupDate(lastBackupAt)}.`
    : 'No copy has been exported from this device.'
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
  const [exportNote, setExportNote] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<BackupPayload | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [pasted, setPasted] = useState('')
  const [workoutStatus, setWorkoutStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetTyped, setResetTyped] = useState('')
  const [resetting, setResetting] = useState(false)

  /*
    Probed once, from a file the shape of a real backup: what Export does — and
    what it is able to promise afterwards — differs between Safari and the
    installed app, and the copy has to say which one you are in.
  */
  const delivery = useMemo(
    () => deliveryFor(new File([''], 'kusuo-backup.json', { type: 'application/json' })),
    [],
  )
  const standalone = useMemo(isStandalone, [])

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

  /**
   * The export date is stamped from the outcome, never from the tap. It is the
   * line you read before erasing everything, so it may understate — it may
   * never overstate.
   */
  async function handleExport() {
    if (!settings) return
    setExporting(true)
    setError(null)
    setExportNote(null)
    try {
      const outcome = await deliverBackup(backupFile(await buildBackup()))
      if (outcome === 'saved') {
        await recordBackupExported(settings.deviceId)
        setSettings((s) => (s ? { ...s, lastBackupAt: Date.now() } : s))
        setExportNote('Exported.')
      } else if (outcome === 'cancelled') {
        setExportNote('Nothing was saved, so nothing was recorded.')
      } else {
        setExportNote(
          "Sent the file to your browser. Kusuo can't tell whether it was saved, so it has not recorded an export.",
        )
      }
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
   * Takes a whole pasted message, finds the code in it, and adds the workout to
   * the active split as a new day. Nothing existing is touched.
   */
  async function importWorkout() {
    setWorkoutStatus(null)
    const code = findWorkoutCode(pasted)
    if (!code) {
      setWorkoutStatus({ ok: false, message: "No Kusuo code in that — paste the whole message." })
      return
    }
    try {
      const workout = decodeWorkout(code)
      const split = await getActiveSplit()
      if (!split) {
        setWorkoutStatus({
          ok: false,
          message: 'Choose a split first — a shared workout arrives as a day inside one.',
        })
        return
      }
      const day = await importWorkoutAsDay(split.id, workout)
      setPasted('')
      setWorkoutStatus({ ok: true, message: `Added "${day.label}" to ${split.name}.` })
    } catch (err) {
      setWorkoutStatus({
        ok: false,
        message:
          err instanceof InvalidWorkoutCodeError ? err.message : "Couldn't add that — try again.",
      })
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
      await clearEverything()
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
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 pb-28 pt-[var(--space-safe-top)] text-center">
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

  const armed = resetTyped.trim() === 'RESET'

  if (resetOpen) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 pb-28 pt-[var(--space-safe-top)] text-center">
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
        <p className="max-w-xs text-xs text-[var(--color-text-secondary)]">
          {settings.lastBackupAt
            ? `You exported a copy on ${formatBackupDate(settings.lastBackupAt)}. Kusuo cannot check that the file is still there.`
            : 'No copy has been exported from this device.'}
        </p>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <SecondaryButton onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export first'}
          </SecondaryButton>
          {exportNote && (
            <p role="status" className="text-xs text-[var(--color-text-secondary)]">
              {exportNote}
            </p>
          )}
          {/*
            Nocturne holds no red, so the weight goes the other way: the way out
            is the one filled button on the screen, and erasing everything is
            bare text that stays dimmed until RESET is typed. Two identical
            outlined buttons made the two choices look interchangeable, which is
            the one thing they are not.
          */}
          <PrimaryButton
            onClick={() => {
              setResetOpen(false)
              setResetTyped('')
            }}
          >
            Keep my data
          </PrimaryButton>
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
          <button
            type="button"
            onClick={handleReset}
            disabled={!armed || resetting}
            className="min-h-11 text-sm disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            style={{ color: armed ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
          >
            {resetting ? 'Erasing…' : 'Reset all data'}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-5 pb-28 pt-[var(--space-safe-top)]">
      <BackLink label="Back to Settings" to="/settings" />

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
            {delivery === 'share'
              ? 'Opens the share sheet — choose Save to Files to keep it.'
              : delivery === 'download'
                ? 'Downloads a file.'
                : 'Opens the file. This device gives no way to confirm it was kept, so nothing is recorded.'}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {lastExportLine(settings.lastBackupAt)}
          </p>
        </div>
        <PrimaryButton onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export as JSON'}
        </PrimaryButton>
        {exportNote && (
          <p role="status" className="text-xs text-[var(--color-text-secondary)]">
            {exportNote}
          </p>
        )}
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

      {isWriter && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium text-[var(--color-text-primary)]">
              Import a shared workout
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Paste the whole message — the code is found inside it. It arrives as a new day in your
              active split; nothing you have is overwritten.
            </p>
          </div>
          <textarea
            aria-label="Paste a shared workout"
            value={pasted}
            onChange={(e) => {
              setPasted(e.target.value)
              setWorkoutStatus(null)
            }}
            rows={3}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base text-[var(--color-text-primary)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          />
          <SecondaryButton onClick={importWorkout} disabled={!pasted.trim()}>
            Add to my split
          </SecondaryButton>
          {workoutStatus && (
            <p
              role={workoutStatus.ok ? 'status' : 'alert'}
              className="text-xs text-[var(--color-text-secondary)]"
            >
              {workoutStatus.message}
            </p>
          )}
        </section>
      )}

      <Link
        to="/settings/share"
        className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      >
        <span className="flex flex-col">
          <span className="text-sm text-[var(--color-text-primary)]">Share as text</span>
          <span className="text-xs text-[var(--color-text-secondary)]">A session, with or without an import code</span>
        </span>
        <span aria-hidden="true" className="text-[var(--color-text-secondary)]">
          ›
        </span>
      </Link>

      {/*
        iOS gives an installed home-screen app a storage partition of its own, so
        the copy in Safari and the copy in the installed app are two records that
        never meet. Someone who installs Kusuo and finds it empty will think the
        history is gone; it is not, and this is the only screen that can say so.
      */}
      <section className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-[var(--color-text-primary)]">
          {isWriter ? 'This iPhone' : 'This Mac'}
        </h2>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {deviceRoleText(settings.deviceRole)}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {standalone
            ? 'You are in the installed app, which iOS keeps separate from Safari. Anything you logged in Safari stays there — export it from Safari and import it here.'
            : 'You are in Safari. Adding Kusuo to the home screen gives it separate storage, and it opens empty — export here first, then import it there.'}
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
