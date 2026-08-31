import { useNavigate } from 'react-router'

/**
 * Back for the screens that are not tabs. The tab bar is how you move between
 * the six main surfaces; anything reached by tapping into something needs a way
 * out that is not the browser chrome, because an installed PWA has none.
 */
export default function BackLink({ label = 'Back' }: { label?: string }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(-1)}
      aria-label={label}
      className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
    >
      <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7}>
        <path d="M12.5 4L6.5 10l6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
