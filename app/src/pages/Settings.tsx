import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router'
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
import type { Settings as SettingsType, Theme } from '../db/schema'
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

  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<BackupPayload | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
