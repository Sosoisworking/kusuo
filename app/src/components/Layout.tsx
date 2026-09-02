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
          // Offset by the inset rather than padded through it, so the banner
          // begins where the status-bar mask in shell.css ends. Padding would
          // have put its own surface colour behind the mask's ground colour and
          // shown a seam on any device with a real inset.
          className="fixed inset-x-0 top-[env(safe-area-inset-top)] z-20 bg-[var(--color-surface)] px-5 py-1.5 text-center text-xs text-[var(--color-text-secondary)]"
        >
          Viewing only — log on your iPhone.
        </p>
      )}
      <Outlet />
      <TabNav />
    </>
  )
}
