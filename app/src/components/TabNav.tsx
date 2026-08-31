import {
  Barbell,
  CalendarBlank,
  Cards,
  Gear,
  ListNumbers,
  SunHorizon,
  type Icon,
} from '@phosphor-icons/react'
import { NavLink } from 'react-router'

interface Tab {
  to: string
  label: string
  icon: Icon
  end: boolean
}

const TABS: Tab[] = [
  { to: '/', label: 'Today', icon: SunHorizon, end: true },
  { to: '/train', label: 'Train', icon: Barbell, end: false },
  { to: '/splits', label: 'Splits', icon: Cards, end: false },
  { to: '/calendar', label: 'Calendar', icon: CalendarBlank, end: false },
  { to: '/records', label: 'Records', icon: ListNumbers, end: false },
  { to: '/settings', label: 'Settings', icon: Gear, end: false },
]

export default function TabNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-[var(--color-border)] bg-[var(--color-bg)] pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map(({ to, label, icon: TabIcon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          // Six tabs have to fit at 402px, so the horizontal padding goes and
          // the 44pt target is held by min-height plus flex-1 width.
          className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 px-0.5 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          {({ isActive }) => (
            <>
              <TabIcon
                size={19}
                weight={isActive ? 'fill' : 'regular'}
                color={isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)'}
                aria-hidden="true"
              />
              <span
                className="text-[9px] leading-none"
                style={{
                  color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
