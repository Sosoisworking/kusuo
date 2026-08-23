import { NavLink } from 'react-router'

function TodayIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={active ? 1.8 : 1.5}>
      <rect x="3" y="4" width="14" height="13" rx="2" />
      <path d="M3 8h14M7 2.5v3M13 2.5v3" strokeLinecap="round" />
    </svg>
  )
}

function ProgressIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={active ? 1.8 : 1.5}>
      <path d="M4 16V10M10 16V4M16 16v-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const TABS = [
  { to: '/', label: 'Today', icon: TodayIcon, end: true },
  { to: '/progress', label: 'Progress', icon: ProgressIcon, end: false },
] as const

export default function TabNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-[var(--color-border)] bg-[var(--color-bg)] pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className="flex min-h-11 flex-1 flex-col items-center gap-1 px-4 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          {({ isActive }) => (
            <>
              <span style={{ color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                <Icon active={isActive} />
              </span>
              <span
                className="text-xs"
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
