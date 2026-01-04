'use client'

import { useState, useEffect } from 'react'

import { useRouter, useSearchParams } from 'next/navigation'

import { Search, Filter } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDebounce } from '@/hooks/use-debounce'
import { SHIFT_FILTER_ALL } from '@/lib/constants/dugsi'


import { AdvancedFilters } from './advanced-filters'
import { MobileFilterDrawer } from './mobile-filter-drawer'
import { SearchField } from '../../_types'
import {
  useAdvancedFiltersState,
  useDugsiFilters,
  useLegacyActions,
} from '../../store'

/**
 * Dashboard Filters Component
 *
 * Architecture Note: Hybrid Filter Strategy
 *
 * This component uses a mixed filtering approach optimized for different use cases:
 *
 * SHIFT Filter (URL searchParams + Database Filtering):
 * - Uses URL query parameters (?shift=MORNING)
 * - Filters at database level via Server Component re-render
 * - Benefits: Leverages composite index [program, shift] for performance
 * - Reduces initial payload size when filtering large datasets
 * - Server Component re-renders on param change (intentional)
 *
 * OTHER Filters (Zustand State + Client Filtering):
 * - Date filter, health info, search query
 * - Stored in Zustand state, applied client-side after data fetch
 * - Benefits: No database indexes available for these fields
 * - Instant filter updates without server round-trip
 * - Better UX for smaller filter scopes
 *
 * This hybrid approach optimizes based on filter characteristics rather than
 * enforcing consistency for its own sake.
 */
export function DashboardFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const showAdvancedFilters = useAdvancedFiltersState()
  const filters = useDugsiFilters()
  const {
    setSearchQuery,
    setSearchField,
    setAdvancedFilters,
    setAdvancedFiltersOpen,
  } = useLegacyActions()

  const shiftFromUrl =
    (searchParams.get('shift') as
      | 'MORNING'
      | 'AFTERNOON'
      | typeof SHIFT_FILTER_ALL) || SHIFT_FILTER_ALL

  const [localSearchQuery, setLocalSearchQuery] = useState(
    filters.search?.query || ''
  )
  const [localSearchField, setLocalSearchField] = useState<SearchField>(
    filters.search?.field || 'all'
  )

  const debouncedSearchQuery = useDebounce(localSearchQuery, 300)

  useEffect(() => {
    setSearchQuery(debouncedSearchQuery)
  }, [debouncedSearchQuery, setSearchQuery])

  const handleFieldChange = (field: SearchField) => {
    setLocalSearchField(field)
    setSearchField(field)
  }

  const getPlaceholder = () => {
    switch (localSearchField) {
      case 'childName':
        return 'Search by child name...'
      case 'parentName':
        return 'Search by parent name...'
      case 'email':
        return 'Search by email...'
      case 'phone':
        return 'Search by phone...'
      default:
        return 'Search by name, email, or phone...'
    }
  }

  /**
   * Updates shift filter via URL query parameters.
   *
   * Note: router.push triggers Server Component re-render. This is intentional
   * and optimal - we want fresh data from database with the new shift filter
   * applied, taking advantage of the [program, shift] composite index.
   */
  const handleShiftChange = (
    shift: 'MORNING' | 'AFTERNOON' | typeof SHIFT_FILTER_ALL
  ) => {
    const params = new URLSearchParams(searchParams.toString())
    if (shift === SHIFT_FILTER_ALL) {
      params.delete('shift')
    } else {
      params.set('shift', shift)
    }
    router.push(`?${params.toString()}`)
  }

  const advancedFilters = filters.advanced || {
    dateFilter: 'all',
    hasHealthInfo: false,
  }

  const hasActiveAdvancedFilters =
    advancedFilters.dateFilter !== 'all' ||
    advancedFilters.hasHealthInfo ||
    shiftFromUrl !== SHIFT_FILTER_ALL

  // Count active filters for mobile drawer badge
  const activeFilterCount =
    (advancedFilters.dateFilter !== 'all' ? 1 : 0) +
    (advancedFilters.hasHealthInfo ? 1 : 0) +
    (shiftFromUrl !== SHIFT_FILTER_ALL ? 1 : 0)

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-1 gap-2">
          <Select value={localSearchField} onValueChange={handleFieldChange}>
            <SelectTrigger className="w-[130px] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Fields</SelectItem>
              <SelectItem value="childName">Child Name</SelectItem>
              <SelectItem value="parentName">Parent Name</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={getPlaceholder()}
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              className="pl-9"
              aria-label="Search families"
            />
          </div>
        </div>

        {/* Desktop: Inline Advanced Filters Toggle */}
        <Button
          variant="outline"
          onClick={() => setAdvancedFiltersOpen(!showAdvancedFilters)}
          className="hidden gap-2 lg:flex"
          aria-expanded={showAdvancedFilters}
          aria-controls="advanced-filters-panel"
        >
          <Filter className="h-4 w-4" />
          Advanced Filters
          {hasActiveAdvancedFilters && (
            <Badge
              variant="secondary"
              className="ml-1"
              aria-label="Active filters"
            >
              Active
            </Badge>
          )}
        </Button>

        {/* Mobile: Filter Drawer */}
        <MobileFilterDrawer activeFilterCount={activeFilterCount}>
          <AdvancedFilters
            filters={advancedFilters}
            onFiltersChange={setAdvancedFilters}
            shift={shiftFromUrl}
            onShiftChange={handleShiftChange}
          />
        </MobileFilterDrawer>
      </div>

      {/* Desktop: Inline Advanced Filters (shown when toggled) */}
      {showAdvancedFilters && (
        <div
          id="advanced-filters-panel"
          role="region"
          aria-label="Advanced filters"
          className="hidden lg:block"
        >
          <AdvancedFilters
            filters={advancedFilters}
            onFiltersChange={setAdvancedFilters}
            shift={shiftFromUrl}
            onShiftChange={handleShiftChange}
          />
        </div>
      )}
    </>
  )
}
