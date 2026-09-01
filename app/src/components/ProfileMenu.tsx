import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { initials } from '../lib/format'

interface Item {
  to: string
  label: string
}

const ITEMS: Item[] = [
  { to: '/settings', label: 'Settings' },
  { to: '/settings/data', label: 'Your data' },
  { to: '/settings/share', label: 'Share' },
  { to: '/reflection', label: 'Reflect' },
  { to: '/goals', label: 'Goals' },
]

/**
 * The initials button, and what it opens.
 *
 * It used to be a link straight to Settings, which made the most-tapped corner
 * of the app a one-way door to a preferences screen. The menu keeps the tab bar
 * at six while giving the surfaces that lost a tab somewhere to be reached from.
 */
export default function ProfileMenu({ name }: { name: string | undefined }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Your profile"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      >
        {initials(name) || '·'}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-20 flex w-56 flex-col rounded-[var(--radius-md)] bg-[var(--color-surface)] p-2"
          style={{ boxShadow: 'var(--shadow-lg)' }}
        >
          <div className="px-2 pb-2 pt-1">
            <p className="text-sm text-[var(--color-text-primary)]">{name ?? 'This device'}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Stored on this device only</p>
          </div>
          {ITEMS.map((item) => (
            <Link
              key={item.to}
              role="menuitem"
              to={item.to}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center rounded-[var(--radius-sm)] px-2 text-sm text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              {item.label}
            </Link>
          ))}
          <p className="px-2 pb-1 pt-2 text-xs text-[var(--color-text-secondary)]">
            This iPhone holds the only copy. Clearing Safari's data removes it — keep an export.
          </p>
        </div>
      )}
    </div>
  )
}
