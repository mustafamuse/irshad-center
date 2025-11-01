/**
 * Custom hook for filtering families
 * Memoized filter application for better performance
 */

'use client'

import { useMemo } from 'react'

import { Family, FamilyFilters, TabValue } from '../_types'
import { applyAllFilters } from '../_utils/filters'

export function useFamilyFilters(
  families: Family[],
  options: {
    tab: TabValue
    searchQuery: string
    advancedFilters: FamilyFilters
  }
): Family[] {
  // Extract filter values to avoid complex expressions in dependency array
  const dateRangeStart = options.advancedFilters.dateRange?.start?.getTime()
  const dateRangeEnd = options.advancedFilters.dateRange?.end?.getTime()
  const schoolsLength = options.advancedFilters.schools.length
  const schoolsJoin = options.advancedFilters.schools.join(',')
  const gradesLength = options.advancedFilters.grades.length
  const gradesJoin = options.advancedFilters.grades.join(',')
  const hasHealthInfo = options.advancedFilters.hasHealthInfo

  return useMemo(
    () => applyAllFilters(families, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // We extract all individual properties from options above to prevent unnecessary re-renders
    // Including 'options' directly would cause re-renders on every object reference change
    [
      families,
      options.tab,
      options.searchQuery,
      dateRangeStart,
      dateRangeEnd,
      schoolsLength,
      schoolsJoin,
      gradesLength,
      gradesJoin,
      hasHealthInfo,
    ]
  )
}
