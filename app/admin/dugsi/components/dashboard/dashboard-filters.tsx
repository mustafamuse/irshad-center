'use client'

import { Search, Filter } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { AdvancedFilters } from './advanced-filters'
import { MobileFilterDrawer } from './mobile-filter-drawer'
import { DugsiRegistration } from '../../_types'
import {
  useAdvancedFiltersState,
  useDugsiFilters,
  useLegacyActions,
} from '../../store'

interface DashboardFiltersProps {
  registrations: DugsiRegistration[]
}

export function DashboardFilters({ registrations }: DashboardFiltersProps) {
  const showAdvancedFilters = useAdvancedFiltersState()
  const filters = useDugsiFilters()
  const { setSearchQuery, setAdvancedFilters, setAdvancedFiltersOpen } =
    useLegacyActions()

  const searchQuery = filters.search?.query || ''
  const advancedFilters = filters.advanced || {
    dateRange: null,
    schools: [],
    grades: [],
    hasHealthInfo: false,
  }

  const hasActiveAdvancedFilters =
    advancedFilters.dateRange ||
    advancedFilters.schools.length > 0 ||
    advancedFilters.grades.length > 0 ||
    advancedFilters.hasHealthInfo

  // Count active filters for mobile drawer badge
  const activeFilterCount =
    (advancedFilters.dateRange ? 1 : 0) +
    advancedFilters.schools.length +
    advancedFilters.grades.length +
    (advancedFilters.hasHealthInfo ? 1 : 0)

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, email, phone, or school..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Search families by name, email, phone, or school"
          />
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
            registrations={registrations}
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
            registrations={registrations}
          />
        </div>
      )}
    </>
  )
}
