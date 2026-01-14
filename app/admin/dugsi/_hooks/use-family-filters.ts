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
  return useMemo(() => applyAllFilters(families, options), [families, options])
}
