/**
 * Live Region Component
 * Announces dynamic content changes to screen readers
 */
'use client'

interface LiveRegionProps {
  children: React.ReactNode
  /**
   * Politeness level
   * - polite: waits for user to finish current task
   * - assertive: interrupts user immediately
   */
  politeness?: 'polite' | 'assertive'
  /**
   * Atomic: whether to read entire region or just changes
   */
  atomic?: boolean
}

export function LiveRegion({
  children,
  politeness = 'polite',
  atomic = false,
}: LiveRegionProps) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic={atomic}
      className="sr-only"
    >
      {children}
    </div>
  )
}
