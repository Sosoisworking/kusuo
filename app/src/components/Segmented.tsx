export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

/**
 * A row of mutually exclusive choices. Used for every either/or setting so they
 * read as one decision rather than a column of unrelated switches, and so the
 * chosen one is marked by the accent rather than by being the only thing left.
 */
export default function Segmented<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string
  hint?: string
  value: T
  options: SegmentedOption<T>[]
  onChange: (next: T) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-[var(--color-text-primary)]">{label}</legend>
      {hint && <p className="text-xs text-[var(--color-text-secondary)]">{hint}</p>}
      <div className="flex gap-2">
        {options.map((option) => {
          const chosen = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={chosen}
              onClick={() => onChange(option.value)}
              className="flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-md)] px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              style={{
                color: chosen ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                boxShadow: `inset 0 0 0 1px ${chosen ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: chosen ? 'var(--color-surface)' : 'transparent',
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
