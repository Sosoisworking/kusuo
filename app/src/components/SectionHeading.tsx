/**
 * The label above a plain list — small caps, then a hairline that fades out
 * rather than ruling all the way across. It is a heading, not a box: the list
 * under it stays a list, and only things you act on get a card.
 *
 * The rule is decorative, so it is hidden from the accessibility tree; the
 * heading level is real, because these sections are how the screen is skimmed.
 */
export default function SectionHeading({
  children,
  level = 2,
}: {
  children: React.ReactNode
  level?: 2 | 3
}) {
  const Tag = level === 2 ? 'h2' : 'h3'
  return (
    <div className="flex items-center gap-2.5">
      <Tag className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
        {children}
      </Tag>
      <span
        aria-hidden="true"
        className="h-px flex-1"
        style={{ background: 'linear-gradient(90deg, var(--color-border), transparent)' }}
      />
    </div>
  )
}
