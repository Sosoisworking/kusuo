export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = '', ...rest } = props
  return (
    <button
      {...rest}
      className={`min-h-11 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-base font-medium text-[var(--color-bg)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] ${className}`}
    />
  )
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = '', ...rest } = props
  return (
    <button
      {...rest}
      className={`min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] px-6 py-3 text-base font-medium text-[var(--color-text-primary)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] ${className}`}
    />
  )
}
