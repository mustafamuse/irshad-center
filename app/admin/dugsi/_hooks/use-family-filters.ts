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
  return useMemo(
    () => applyAllFilters(families, options),
    [
      families,
      options.tab,
      options.searchQuery,
      options.advancedFilters,
    ]
  )
}
