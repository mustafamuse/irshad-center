'use client'

import { Search, Filter } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { AdvancedFilters } from './advanced-filters'
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
        <Button
          variant="outline"
          onClick={() => setAdvancedFiltersOpen(!showAdvancedFilters)}
          className="gap-2"
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
      </div>

      {showAdvancedFilters && (
        <div
          id="advanced-filters-panel"
          role="region"
          aria-label="Advanced filters"
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
