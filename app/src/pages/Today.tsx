import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import { listActiveHabits } from '../db/habits'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import type { Settings } from '../db/schema'

export default function Today() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings | undefined>()
  const [habitCount, setHabitCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const deviceId = getOrCreateDeviceId()
    Promise.all([getSettings(deviceId), listActiveHabits()]).then(([s, habits]) => {
      if (cancelled) return
      setSettings(s)
      setHabitCount(habits.length)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return null
  if (!settings || !settings.onboardingComplete) return <Navigate to="/onboarding" replace />

  const isReader = settings.deviceRole === 'reader'

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">
        {settings.userName ? `Hi, ${settings.userName}` : 'Kusuo'}
      </h1>
      <p className="text-sm text-[var(--color-text-secondary)]">
        {isReader
          ? `Viewing only — ${habitCount} habit${habitCount === 1 ? '' : 's'} on record. Log on your phone.`
          : `${habitCount} habit${habitCount === 1 ? '' : 's'} ready for today.`}
      </p>
    </main>
  )
}
