import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { useRegisterSW } from 'virtual:pwa-register/react'
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
import { getOrCreateDeviceId, getSettings, updateSettings } from '../db/settings'
import { db, type Settings as SettingsType, type Theme } from '../db/schema'
import { todayLocalDate } from '../lib/date'
import { applyTheme } from '../lib/theme'
import { PrimaryButton, SecondaryButton } from '../components/Button'

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
]

function deviceRoleText(role: SettingsType['deviceRole']): string {
  return role === 'writer'
    ? 'This is your iPhone — the device you use to add and check off habits.'
    : "This is your Mac — view only. Log habits on your iPhone."
}

function formatBackupDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export default function Settings() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<SettingsType | undefined>()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetTyped, setResetTyped] = useState('')
  const [resetting, setResetting] = useState(false)

  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<BackupPayload | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  const needRefreshRef = useRef(needRefresh)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<string | null>(null)

  useEffect(() => {
    needRefreshRef.current = needRefresh
    if (needRefresh) updateServiceWorker(true)
  }, [needRefresh, updateServiceWorker])

  async function handleCheckForUpdate() {
    setCheckingUpdate(true)
    setUpdateStatus(null)
    try {
      const registration = await navigator.serviceWorker?.getRegistration()
      await registration?.update()
    } catch {
      setUpdateStatus("Couldn't check — give it another tap.")
      setCheckingUpdate(false)
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setCheckingUpdate(false)
    if (!needRefreshRef.current) setUpdateStatus("You're up to date.")
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const deviceId = getOrCreateDeviceId()
      const s = await getSettings(deviceId)
      if (cancelled) return
      setSettings(s)
      setName(s?.userName ?? '')
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function saveTheme(theme: Theme) {
    if (!settings || theme === settings.theme) return
    const prev = settings
    setSettings({ ...settings, theme })
    applyTheme(theme)
    setError(null)
    try {
      await updateSettings(settings.deviceId, { theme })
    } catch {
      setSettings(prev)
      applyTheme(prev.theme)
      setError("Couldn't save that — give it another tap.")
    }
  }

  async function saveName() {
    if (!settings) return
    const trimmed = name.trim()
    if (trimmed === (settings.userName ?? '')) return
    setError(null)
    try {
      await updateSettings(settings.deviceId, { userName: trimmed || undefined })
      setSettings((s) => (s ? { ...s, userName: trimmed || undefined } : s))
    } catch {
      setError("Couldn't save that — give it another tap.")
    }
  }

  /**
   * The honest equivalent of a log out in an app with no account: clear this
   * device and go back to the first-run questions. Settings goes too, so the
   * device role is asked again rather than silently inherited. The deviceId in
   * localStorage is deliberately kept — it identifies the hardware, not the
   * record, and reusing it keeps event authorship consistent.
   */
  async function handleReset() {
    setResetting(true)
    setError(null)
    try {
      await db.transaction(
        'rw',
        [db.habits, db.habitEvents, db.goals, db.reflections, db.exercises, db.splits, db.sessionEvents, db.sessionMarks, db.settings],
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

  async function handleExport() {
    if (!settings) return
    setExporting(true)
    setError(null)
    try {
      const payload = await buildBackup()
      const json = serializeBackup(payload)
      const blob = new Blob([json], { type: 'application/json' })
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

  function triggerImport() {
    setImportError(null)
    setImportSuccess(null)
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportError(null)
    setImportSuccess(null)
    try {
      const text = await file.text()
      const payload = parseBackup(text)
      if (await isReverseImport(payload)) {
        setPendingImport(payload)
      } else {
        await runImport(payload)
      }
    } catch (err) {
      setImportError(err instanceof InvalidBackupError ? err.message : "Couldn't read that file — give it another tap.")
    }
  }

  async function runImport(payload: BackupPayload) {
    setImporting(true)
    setImportError(null)
    try {
      await importBackup(payload)
      setImportSuccess(`Imported ${payload.habits.length} habit${payload.habits.length === 1 ? '' : 's'}.`)
      setPendingImport(null)
    } catch {
      setImportError("Couldn't import — give it another tap.")
    } finally {
      setImporting(false)
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

  if (pendingImport) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 pb-28 pt-[max(3rem,env(safe-area-inset-top))] text-center">
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">This device has newer data</h1>
        <p className="max-w-xs text-sm text-[var(--color-text-secondary)]">
          Importing this backup replaces what's here — including activity newer than the backup itself. That newer
          data will be lost.
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
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">Erase everything?</h1>
        <p className="max-w-xs text-sm text-[var(--color-text-secondary)]">
          Every habit, completion, reflection, goal and training session on this device goes. Kusuo
          keeps no copy anywhere else, so there is nothing to restore from unless you export first.
        </p>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <SecondaryButton onClick={handleExport}>Export first</SecondaryButton>
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
          <SecondaryButton onClick={handleReset} disabled={resetTyped.trim() !== 'RESET' || resetting}>
            {resetting ? 'Erasing…' : 'Erase everything'}
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
    <main className="flex min-h-dvh flex-col items-center gap-6 px-6 pb-28 pt-[max(3rem,env(safe-area-inset-top))] text-center">
      <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">Settings</h1>

      {error && (
        <p role="alert" className="text-xs text-[var(--color-text-secondary)]">
          {error}
        </p>
      )}

      <div className="flex w-full max-w-xs flex-col gap-2 text-left">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">Theme</span>
        <div className="flex gap-2">
          {THEME_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => saveTheme(value)}
              aria-pressed={settings.theme === value}
              className="min-h-11 flex-1 rounded-[var(--radius-sm)] px-3 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              style={{
                background: settings.theme === value ? 'var(--color-accent)' : 'transparent',
                color: settings.theme === value ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2 text-left">
        <label className="text-sm font-medium text-[var(--color-text-primary)]" htmlFor="settings-name">
          Your name
        </label>
        <input
          id="settings-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          placeholder="Your name"
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base text-[var(--color-text-primary)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        />
      </div>

      <div className="w-full max-w-xs rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-left">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">This device</span>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{deviceRoleText(settings.deviceRole)}</p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3 text-left">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">Updates</span>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Installed to your home screen? New versions wait quietly until you check.
        </p>
        <SecondaryButton onClick={handleCheckForUpdate} disabled={checkingUpdate}>
          {checkingUpdate ? 'Checking…' : 'Check for updates'}
        </SecondaryButton>
        {updateStatus && (
          <p role="status" className="text-xs text-[var(--color-text-secondary)]">
            {updateStatus}
          </p>
        )}
        {/* Naming the running build is what makes the button above checkable. */}
        <p className="text-xs text-[var(--color-text-secondary)]">Build {__BUILD_ID__}</p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3 text-left">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">Start over</span>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Erases every habit, completion, reflection, goal and session on this device, and returns
          to the first-run questions. There is no account and no copy on a server, so this cannot be
          undone — export first if you want to keep any of it.
        </p>
        <SecondaryButton onClick={() => setResetOpen(true)}>Start over on this device</SecondaryButton>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2 text-left">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">More</span>
        <Link
          to="/reflection"
          className="min-h-11 flex items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          Reflection
        </Link>
        <Link
          to="/goals"
          className="min-h-11 flex items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          Goals
        </Link>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3 text-left">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">Backup</span>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {settings.lastBackupAt ? `Last backup: ${formatBackupDate(settings.lastBackupAt)}` : 'Never backed up yet.'}
        </p>
        <PrimaryButton onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export backup'}
        </PrimaryButton>

        <SecondaryButton onClick={triggerImport} disabled={importing}>
          {importing ? 'Importing…' : 'Import backup'}
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
      </div>
    </main>
  )
}
