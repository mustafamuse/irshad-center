import { useState, useCallback, useMemo } from 'react'

import { useDebounce } from '@/hooks/use-debounce'

import { StudentFilters, UseStudentFilters, DEFAULT_FILTERS } from './types'

export function useStudentFilters(): UseStudentFilters {
  const [filters, setFilters] = useState<StudentFilters>(DEFAULT_FILTERS)

  // Debounce search query to prevent too many re-renders - reduced to 200ms for faster response
  const debouncedSearch = useDebounce(filters.search.query, 200)

  const setFilter = useCallback(
    <K extends keyof StudentFilters>(key: K, value: StudentFilters[K]) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
      }))
    },
    []
  )

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
  }, [])

  const hasActiveFilters = useMemo(() => {
    return (
      !!filters.batch.selected ||
      !!filters.batch.quickFilter ||
      filters.status.selected.length > 0 ||
      !!filters.status.quickFilter ||
      !!debouncedSearch ||
      !!filters.dateRange.range.from ||
      !!filters.dateRange.range.to ||
      !!filters.timeline.active ||
      filters.academic.gradeLevel.length > 0 ||
      filters.academic.educationLevel.length > 0
    )
  }, [
    filters.batch,
    filters.status,
    debouncedSearch,
    filters.dateRange,
    filters.timeline,
    filters.academic,
  ])

  return {
    filters: {
      ...filters,
      search: {
        ...filters.search,
        query: debouncedSearch,
      },
    },
    setFilter,
    resetFilters,
    hasActiveFilters,
  }
}
