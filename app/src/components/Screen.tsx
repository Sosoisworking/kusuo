interface ScreenProps {
  title: string
  /** Small line above the title — a date, a split name, a count. */
  eyebrow?: string
  /** Rendered at the trailing edge of the header, e.g. the profile button. */
  action?: React.ReactNode
  children: React.ReactNode
}

/**
 * Shared page frame. Owns the things every screen must get right and none
 * should restate: dynamic viewport height, the safe-area insets top and bottom,
 * and enough bottom padding to clear the six-tab bar.
 */
export default function Screen({ title, eyebrow, action, children }: ScreenProps) {
  return (
    <main className="flex min-h-dvh flex-col gap-6 px-5 pb-28 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          {eyebrow && (
            <span className="text-xs text-[var(--color-text-secondary)]">{eyebrow}</span>
          )}
          <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">{title}</h1>
        </div>
        {action}
      </header>
      {children}
    </main>
  )
}

/**
 * Empty state. One sentence saying what is true and, where there is one, the
 * action that changes it. It explains; it does not encourage.
 */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-5">
      {children}
    </div>
  )
}
