'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { FamilyFilters, DateFilter } from '../../_types'

interface AdvancedFiltersProps {
  filters: FamilyFilters
  onFiltersChange: (filters: FamilyFilters) => void
  shift: 'MORNING' | 'AFTERNOON' | 'all'
  onShiftChange: (shift: 'MORNING' | 'AFTERNOON' | 'all') => void
}

const DATE_FILTER_OPTIONS: Array<{
  value: DateFilter
  label: string
}> = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'lastWeek', label: 'Last Week' },
]

export function AdvancedFilters({
  filters,
  onFiltersChange,
  shift,
  onShiftChange,
}: AdvancedFiltersProps) {
  const clearAllFilters = () => {
    onFiltersChange({
      dateFilter: 'all',
      hasHealthInfo: false,
    })
    onShiftChange('all')
  }

  const hasActiveFilters =
    filters.dateFilter !== 'all' || filters.hasHealthInfo || shift !== 'all'

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Advanced Filters</h3>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-xs"
            >
              Clear All
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Date Filter Dropdown */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Date:</Label>
            <Select
              value={filters.dateFilter}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, dateFilter: value as DateFilter })
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Shift Filter */}
          <div className="flex items-center gap-2 border-l pl-4">
            <Label className="text-xs text-muted-foreground">Shift:</Label>
            <Select
              value={shift}
              onValueChange={(value) =>
                onShiftChange(value as 'MORNING' | 'AFTERNOON' | 'all')
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Shifts</SelectItem>
                <SelectItem value="MORNING">Morning</SelectItem>
                <SelectItem value="AFTERNOON">Afternoon</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Health Info Filter */}
          <div className="flex items-center gap-2 border-l pl-4">
            <Checkbox
              id="health-info"
              checked={filters.hasHealthInfo}
              onCheckedChange={(checked) =>
                onFiltersChange({
                  ...filters,
                  hasHealthInfo: !!checked,
                })
              }
            />
            <label
              htmlFor="health-info"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Has health information
            </label>
          </div>
        </div>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Active:</span>
              <div className="flex flex-wrap gap-1">
                {filters.dateFilter !== 'all' && (
                  <Badge variant="outline" className="text-xs">
                    {
                      DATE_FILTER_OPTIONS.find(
                        (opt) => opt.value === filters.dateFilter
                      )?.label
                    }
                  </Badge>
                )}
                {shift !== 'all' && (
                  <Badge variant="outline" className="text-xs">
                    {shift === 'MORNING' ? 'Morning' : 'Afternoon'} Shift
                  </Badge>
                )}
                {filters.hasHealthInfo && (
                  <Badge variant="outline" className="text-xs">
                    Health alerts
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
