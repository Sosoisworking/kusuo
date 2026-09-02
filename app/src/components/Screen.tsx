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
 *
 * The top padding is `--space-safe-top` rather than a per-screen `max()`: the
 * insets differ between Safari and the installed app, and every screen guessing
 * its own minimum is how the headings ended up on different lines. What scrolls
 * *past* the top is masked in shell.css, which padding cannot do.
 */
export default function Screen({ title, eyebrow, action, children }: ScreenProps) {
  return (
    <main className="flex min-h-dvh flex-col gap-6 pb-28 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[var(--space-safe-top)]">
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
