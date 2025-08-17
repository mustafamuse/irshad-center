'use client'

import * as React from 'react'

import { format } from 'date-fns'
import {
  Calendar as CalendarIcon,
  Search,
  ChevronDown,
  Filter,
} from 'lucide-react'
import { DateRange } from 'react-day-picker'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import { StudentFilters } from './types'

interface FilterBarProps {
  filters: StudentFilters
  onFilterChange: <K extends keyof StudentFilters>(
    key: K,
    value: StudentFilters[K]
  ) => void
  batches: Array<{ id: string; name: string }>
  hasActiveFilters: boolean
  onReset: () => void
}

export function FilterBar({
  filters,
  onFilterChange,
  batches,
  hasActiveFilters,
  onReset,
}: FilterBarProps) {
  const [isFiltersExpanded, setIsFiltersExpanded] = React.useState(false)
  const dateRange = filters.dateRange.range

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    onFilterChange('dateRange', {
      ...filters.dateRange,
      range: {
        from: range?.from ?? null,
        to: range?.to ?? null,
      },
      preset: null,
    })
  }

  const handleTimelineFilter = (
    timelineType: typeof filters.timeline.active
  ) => {
    // Clear existing date range when using timeline filters
    onFilterChange('dateRange', {
      ...filters.dateRange,
      range: { from: null, to: null },
      preset: null,
    })

    // Set timeline filter
    onFilterChange('timeline', {
      active: timelineType,
    })
  }

  const getTimelineFilterLabel = (timelineFilter: string) => {
    const labels = {
      'enrolled-today': '🆕 Enrolled Today',
      'enrolled-week': '📈 Enrolled This Week',
      'enrolled-month': '📅 Enrolled This Month',
      'active-today': '⚡ Active Today',
      'active-week': '📈 Active This Week',
      'active-month': '📊 Active This Month',
    }
    return labels[timelineFilter as keyof typeof labels] || timelineFilter
  }

  return (
    <div className="space-y-4">
      {/* Mobile Filter Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Filters</h2>
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-xs sm:hidden">
              {Object.values(filters).reduce((count, filter) => {
                if (typeof filter === 'object' && filter !== null) {
                  if ('query' in filter && filter.query) count++
                  if ('selected' in filter && filter.selected) {
                    if (Array.isArray(filter.selected)) {
                      if (filter.selected.length > 0) count++
                    } else {
                      count++
                    }
                  }
                  if ('active' in filter && filter.active) count++
                  if (
                    'range' in filter &&
                    (filter.range.from || filter.range.to)
                  )
                    count++
                }
                return count
              }, 0)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="text-xs"
            >
              <span className="hidden sm:inline">Clear All</span>
              <span className="sm:hidden">Clear</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
            className="sm:hidden"
          >
            <Filter className="h-4 w-4" />
            <ChevronDown
              className={`ml-1 h-3 w-3 transition-transform ${isFiltersExpanded ? 'rotate-180' : ''}`}
            />
          </Button>
        </div>
      </div>

      {/* Active Filter Indicators */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 rounded-lg bg-muted/50 p-3">
          <span className="text-xs text-muted-foreground">Active filters:</span>

          {filters.search.query && (
            <Badge variant="secondary" className="text-xs">
              Search: "{filters.search.query}"
              <button
                onClick={() =>
                  onFilterChange('search', { ...filters.search, query: '' })
                }
                className="ml-1 hover:text-red-600"
                title="Clear search"
              >
                ✕
              </button>
            </Badge>
          )}

          {filters.batch.selected && (
            <Badge variant="secondary" className="text-xs">
              Batch:{' '}
              {filters.batch.selected === 'unassigned'
                ? 'Unassigned'
                : batches.find((b) => b.id === filters.batch.selected)?.name}
              <button
                onClick={() =>
                  onFilterChange('batch', { ...filters.batch, selected: null })
                }
                className="ml-1 hover:text-red-600"
                title="Clear batch filter"
              >
                ✕
              </button>
            </Badge>
          )}

          {filters.status.selected.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              Status: {filters.status.selected.length} selected
              <button
                onClick={() =>
                  onFilterChange('status', { ...filters.status, selected: [] })
                }
                className="ml-1 hover:text-red-600"
                title="Clear status filters"
              >
                ✕
              </button>
            </Badge>
          )}

          {/* Timeline Filter Badge */}
          {filters.timeline.active && (
            <Badge variant="secondary" className="text-xs">
              {getTimelineFilterLabel(filters.timeline.active)}
              <button
                onClick={() => onFilterChange('timeline', { active: null })}
                className="ml-1 hover:text-red-600"
                title="Clear timeline filter"
              >
                ✕
              </button>
            </Badge>
          )}

          {/* Date Range Badge (only show if no timeline filter) */}
          {!filters.timeline.active &&
            (filters.dateRange.range.from || filters.dateRange.range.to) && (
              <Badge variant="secondary" className="text-xs">
                Date Range:{' '}
                {dateRange?.from ? format(dateRange.from, 'MMM dd') : '?'} -{' '}
                {dateRange?.to ? format(dateRange.to, 'MMM dd') : '?'}
                <button
                  onClick={() => handleDateRangeSelect(undefined)}
                  className="ml-1 hover:text-red-600"
                  title="Clear date range"
                >
                  ✕
                </button>
              </Badge>
            )}
        </div>
      )}

      {/* Main Filter Content - Collapsible on Mobile */}
      <div
        className={`grid gap-4 ${isFiltersExpanded ? 'block' : 'hidden sm:block'}`}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Search */}
          <div className="space-y-2">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={filters.search.query}
                onChange={(e) =>
                  onFilterChange('search', {
                    ...filters.search,
                    query: e.target.value,
                  })
                }
                className="pl-8"
              />
            </div>
          </div>

          {/* Batch Filter */}
          <div className="space-y-2">
            <Label>Batch</Label>
            <Select
              value={filters.batch.selected ?? 'all'}
              onValueChange={(value) =>
                onFilterChange('batch', {
                  ...filters.batch,
                  selected: value === 'all' ? null : value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All Batches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Batches</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {batches
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  <span className="text-muted-foreground">
                    {filters.status.selected.length === 0
                      ? 'Filter status...'
                      : `${filters.status.selected.length} selected`}
                  </span>
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Filter status..."
                    className="h-9"
                  />
                  <CommandEmpty>No status found.</CommandEmpty>
                  <CommandGroup>
                    {filters.status.selected.length > 0 && (
                      <>
                        <CommandItem
                          onSelect={() => {
                            onFilterChange('status', {
                              ...filters.status,
                              selected: [],
                            })
                          }}
                          className="text-red-600"
                        >
                          Clear All Status Filters
                        </CommandItem>
                        <CommandSeparator />
                      </>
                    )}
                    {['enrolled', 'registered', 'withdrawn', 'on_leave'].map(
                      (status) => (
                        <CommandItem
                          key={status}
                          value={status}
                          onSelect={() => {
                            console.log('Status selection changed:', {
                              status,
                              currentlySelected: filters.status.selected,
                            })
                            const isSelected =
                              filters.status.selected.includes(status)
                            const newSelected = isSelected
                              ? filters.status.selected.filter(
                                  (s) => s !== status
                                )
                              : [...filters.status.selected, status]
                            console.log('New status selection:', {
                              newSelected,
                              action: isSelected ? 'removing' : 'adding',
                            })
                            onFilterChange('status', {
                              ...filters.status,
                              selected: newSelected,
                            })
                          }}
                        >
                          <div className="flex w-full items-center space-x-2">
                            <Checkbox
                              checked={filters.status.selected.includes(status)}
                              onCheckedChange={(checked) => {
                                const newSelected = checked
                                  ? [...filters.status.selected, status]
                                  : filters.status.selected.filter(
                                      (s) => s !== status
                                    )
                                onFilterChange('status', {
                                  ...filters.status,
                                  selected: newSelected,
                                })
                              }}
                            />
                            <span className="flex-1 text-sm">
                              {status === 'enrolled'
                                ? 'Enrolled'
                                : status === 'registered'
                                  ? 'Registered'
                                  : status === 'withdrawn'
                                    ? 'Withdrawn'
                                    : status === 'on_leave'
                                      ? 'On Leave'
                                      : status}
                            </span>
                          </div>
                        </CommandItem>
                      )
                    )}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Timeline Filters */}
        <div className="space-y-3">
          <Label>Timeline Filters</Label>

          {/* Quick Timeline Actions */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Button
              size="sm"
              variant={
                filters.timeline.active === 'enrolled-today'
                  ? 'default'
                  : 'outline'
              }
              onClick={() => handleTimelineFilter('enrolled-today')}
              className="text-xs"
            >
              <span className="hidden sm:inline">🆕 Enrolled Today</span>
              <span className="sm:hidden">🆕 Today</span>
            </Button>
            <Button
              size="sm"
              variant={
                filters.timeline.active === 'active-week'
                  ? 'default'
                  : 'outline'
              }
              onClick={() => handleTimelineFilter('active-week')}
              className="text-xs"
            >
              <span className="hidden sm:inline">📈 Active This Week</span>
              <span className="sm:hidden">📈 Week</span>
            </Button>
            <Button
              size="sm"
              variant={
                filters.timeline.active === 'enrolled-month'
                  ? 'default'
                  : 'outline'
              }
              onClick={() => handleTimelineFilter('enrolled-month')}
              className="text-xs"
            >
              <span className="hidden sm:inline">📅 Enrolled This Month</span>
              <span className="sm:hidden">📅 Month</span>
            </Button>
          </div>

          {/* Secondary Timeline Options */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Button
              size="sm"
              variant={
                filters.timeline.active === 'enrolled-week'
                  ? 'default'
                  : 'outline'
              }
              onClick={() => handleTimelineFilter('enrolled-week')}
              className="text-xs"
            >
              <span className="hidden sm:inline">📊 Enrolled This Week</span>
              <span className="sm:hidden">📊 E-Week</span>
            </Button>
            <Button
              size="sm"
              variant={
                filters.timeline.active === 'active-today'
                  ? 'default'
                  : 'outline'
              }
              onClick={() => handleTimelineFilter('active-today')}
              className="text-xs"
            >
              <span className="hidden sm:inline">⚡ Active Today</span>
              <span className="sm:hidden">⚡ Today</span>
            </Button>
            <Button
              size="sm"
              variant={
                filters.timeline.active === 'active-month'
                  ? 'default'
                  : 'outline'
              }
              onClick={() => handleTimelineFilter('active-month')}
              className="text-xs"
            >
              <span className="hidden sm:inline">📊 Active This Month</span>
              <span className="sm:hidden">📊 A-Month</span>
            </Button>
          </div>

          {/* Advanced Date Range Option */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
              >
                Custom Date Range <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3">
              <div className="rounded-lg border p-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal sm:w-[240px]',
                          !dateRange && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, 'LLL dd, y')} -{' '}
                              {format(dateRange.to, 'LLL dd, y')}
                            </>
                          ) : (
                            format(dateRange.from, 'LLL dd, y')
                          )
                        ) : (
                          <span>Pick a date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from || undefined}
                        selected={
                          dateRange?.from && dateRange?.to
                            ? { from: dateRange.from, to: dateRange.to }
                            : undefined
                        }
                        onSelect={(range) => {
                          // Clear timeline filter when using custom date range
                          onFilterChange('timeline', { active: null })
                          handleDateRangeSelect(range)
                        }}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                  {(dateRange?.from || dateRange?.to) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDateRangeSelect(undefined)}
                      className="px-2"
                      title="Clear date range"
                    >
                      ✕
                    </Button>
                  )}
                  <Select
                    value={filters.dateRange.field}
                    onValueChange={(
                      value: 'enrollmentDate' | 'lastPaymentDate'
                    ) =>
                      onFilterChange('dateRange', {
                        ...filters.dateRange,
                        field: value,
                      })
                    }
                  >
                    <SelectTrigger className="w-full sm:w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enrollmentDate">
                        Created Date
                      </SelectItem>
                      <SelectItem value="lastPaymentDate">
                        Updated Date
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  )
}
