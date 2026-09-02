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
      // Turned sideways, the notch housing covers one end of the bar: without
      // the side insets roughly a third of the first and last tab sits under
      // it. The background still runs edge to edge; only the tabs inset.
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-[var(--color-border)] bg-[var(--color-bg)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
    >
      {TABS.map(({ to, label, icon: TabIcon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          // Six tabs have to fit at 402px, so the horizontal padding goes and
          // the 44pt target is held by min-height plus flex-1 width.
          // `min-w-0` lets the caption be clipped rather than widen the cell,
          // which is what keeps six of these on one row.
          className="flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 overflow-hidden px-0.5 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          {({ isActive }) => (
            <>
              <TabIcon
                size={19}
                weight={isActive ? 'fill' : 'regular'}
                color={isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)'}
                aria-hidden="true"
              />
              {/* Never wraps: a caption that takes a second line makes the bar
                  taller, which moves the whole tab bar under heavy zoom and at
                  narrow widths. The icon above carries the meaning if the word
                  is clipped. */}
              <span
                className="max-w-full truncate whitespace-nowrap text-[9px] leading-none"
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
