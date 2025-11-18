'use client'

import { useCallback, useTransition } from 'react'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

/**
 * Hook for managing filter state via URL search params
 *
 * This replaces Zustand filter state with URL-based state, enabling:
 * - Shareable URLs
 * - Browser back/forward
 * - Persistent state on refresh
 * - Better SEO
 */
export function useURLFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Helper to update URL params
  const updateParams = useCallback(
    (updates: Record<string, string | string[] | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString())

      Object.entries(updates).forEach(([key, value]) => {
        // Remove param if null/undefined
        if (value === null || value === undefined || value === '') {
          params.delete(key)
          return
        }

        // Handle arrays
        if (Array.isArray(value)) {
          params.delete(key) // Clear existing
          if (value.length > 0) {
            value.forEach((v) => params.append(key, v))
          }
        } else {
          params.set(key, value)
        }
      })

      // Reset to page 1 when filters change (unless explicitly setting page)
      if (!updates.page) {
        params.delete('page')
      }

      // Navigate with new params (server component will re-render)
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [router, pathname, searchParams]
  )

  // Get current filter values from URL
  const getCurrentFilters = useCallback(() => {
    return {
      search: searchParams.get('search') || '',
      batchIds: searchParams.getAll('batch'),
      statuses: searchParams.getAll('status'),
      subscriptionStatuses: searchParams.getAll('subscriptionStatus'),
      educationLevels: searchParams.getAll('educationLevel'),
      gradeLevels: searchParams.getAll('gradeLevel'),
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '50', 10),
    }
  }, [searchParams])

  // Individual filter setters
  const setSearch = useCallback(
    (query: string) => {
      updateParams({ search: query || null })
    },
    [updateParams]
  )

  const toggleBatch = useCallback(
    (batchId: string) => {
      const current = searchParams.getAll('batch')
      const updated = current.includes(batchId)
        ? current.filter((id) => id !== batchId)
        : [...current, batchId]
      updateParams({ batch: updated })
    },
    [searchParams, updateParams]
  )

  const toggleStatus = useCallback(
    (status: string) => {
      const current = searchParams.getAll('status')
      const updated = current.includes(status)
        ? current.filter((s) => s !== status)
        : [...current, status]
      updateParams({ status: updated })
    },
    [searchParams, updateParams]
  )

  const toggleSubscriptionStatus = useCallback(
    (status: string) => {
      const current = searchParams.getAll('subscriptionStatus')
      const updated = current.includes(status)
        ? current.filter((s) => s !== status)
        : [...current, status]
      updateParams({ subscriptionStatus: updated })
    },
    [searchParams, updateParams]
  )

  const setPage = useCallback(
    (page: number) => {
      updateParams({ page: page.toString() })
    },
    [updateParams]
  )

  const resetFilters = useCallback(() => {
    startTransition(() => {
      router.push(pathname) // Clear all params
    })
  }, [router, pathname])

  return {
    // State
    filters: getCurrentFilters(),
    isPending, // Show loading indicator during transition

    // Actions
    setSearch,
    toggleBatch,
    toggleStatus,
    toggleSubscriptionStatus,
    setPage,
    resetFilters,
    updateParams, // Generic updater for custom filters
  }
}
