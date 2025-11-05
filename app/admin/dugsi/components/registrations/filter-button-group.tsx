/**
 * Filter Button Group Component
 * Reusable button group for date filters with consistent styling
 */
'use client'

import { Layers, List } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { DateFilter } from '../../_types'

interface FilterOption {
  value: DateFilter
  label: string
  ariaLabel?: string
}

interface FilterButtonGroupProps {
  activeFilter: DateFilter
  onFilterChange: (filter: DateFilter) => void
  groupByDate: boolean
  onGroupByDateChange: (grouped: boolean) => void
  className?: string
}

const DATE_FILTER_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Time', ariaLabel: 'Show all registrations' },
  { value: 'today', label: 'Today', ariaLabel: "Show today's registrations" },
  {
    value: 'yesterday',
    label: 'Yesterday',
    ariaLabel: "Show yesterday's registrations",
  },
  {
    value: 'thisWeek',
    label: 'This Week',
    ariaLabel: "Show this week's registrations",
  },
  {
    value: 'lastWeek',
    label: 'Last Week',
    ariaLabel: "Show last week's registrations",
  },
]

export function FilterButtonGroup({
  activeFilter,
  onFilterChange,
  groupByDate,
  onGroupByDateChange,
  className,
}: FilterButtonGroupProps) {
  return (
    <div
      className={cn('flex flex-wrap gap-2', className)}
      role="group"
      aria-label="Date filter options"
    >
      {DATE_FILTER_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={activeFilter === option.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterChange(option.value)}
          className="text-xs transition-all duration-200 sm:text-sm"
          aria-label={option.ariaLabel || option.label}
          aria-pressed={activeFilter === option.value}
        >
          {option.label}
        </Button>
      ))}

      <Button
        variant={groupByDate ? 'default' : 'outline'}
        size="sm"
        onClick={() => onGroupByDateChange(!groupByDate)}
        className="text-xs transition-all duration-200 sm:text-sm"
        aria-label={
          groupByDate ? 'Disable date grouping' : 'Enable date grouping'
        }
        aria-pressed={groupByDate}
      >
        {groupByDate ? (
          <>
            <Layers className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Grouped
          </>
        ) : (
          <>
            <List className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Group by Date
          </>
        )}
      </Button>
    </div>
  )
}
