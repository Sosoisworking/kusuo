import { useEffect, useState } from 'react'
import { Outlet } from 'react-router'
import { getOrCreateDeviceId, getSettings } from '../db/settings'
import TabNav from './TabNav'

export default function Layout() {
  const [isReader, setIsReader] = useState(false)

  useEffect(() => {
    let cancelled = false
    getSettings(getOrCreateDeviceId()).then((s) => {
      if (!cancelled) setIsReader(s?.deviceRole === 'reader')
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      {/*
        One permanent, quiet line rather than a notice repeated per screen. The
        user should never have to remember which device is authoritative, and
        the absence of write controls alone does not tell them.
      */}
      {isReader && (
        <p
          role="status"
          className="fixed inset-x-0 top-0 z-20 bg-[var(--color-surface)] px-5 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] text-center text-xs text-[var(--color-text-secondary)]"
        >
          Viewing only — log on your iPhone.
        </p>
      )}
      <Outlet />
      <TabNav />
    </>
  )
}
