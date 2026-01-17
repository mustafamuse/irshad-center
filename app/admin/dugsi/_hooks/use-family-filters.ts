'use client'

import { useMemo } from 'react'

import { Shift } from '@prisma/client'

import { Family, FamilyFilters, TabValue, SearchField } from '../_types'
import { applyAllFilters } from '../_utils/filters'

export function useFamilyFilters(
  families: Family[],
  options: {
    tab: TabValue
    searchQuery: string
    searchField?: SearchField
    advancedFilters: FamilyFilters
    quickShift?: Shift | null
  }
): Family[] {
  const { tab, searchQuery, searchField, advancedFilters, quickShift } = options
  const dateFilter = advancedFilters.dateFilter
  const hasHealthInfo = advancedFilters.hasHealthInfo

  return useMemo(
    () =>
      applyAllFilters(families, {
        tab,
        searchQuery,
        searchField,
        advancedFilters: { dateFilter, hasHealthInfo },
        quickShift,
      }),
    [
      families,
      tab,
      searchQuery,
      searchField,
      dateFilter,
      hasHealthInfo,
      quickShift,
    ]
  )
}
