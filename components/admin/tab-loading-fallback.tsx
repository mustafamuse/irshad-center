'use client'

/**
 * TabLoadingFallback - Shared loading skeleton for tab content
 *
 * Provides a consistent loading state across admin dashboard tabs
 */
export function TabLoadingFallback() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 w-full rounded bg-muted" />
      <div className="h-96 rounded-lg bg-muted" />
    </div>
  )
}
