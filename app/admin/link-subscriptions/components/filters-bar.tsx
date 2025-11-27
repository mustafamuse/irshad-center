'use client'

import { Search, X } from 'lucide-react'

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
import { Slider } from '@/components/ui/slider'

export interface Filters {
  search: string
  program: 'ALL' | 'MAHAD' | 'DUGSI'
  status: 'ALL' | 'active' | 'trialing' | 'past_due' | 'canceled'
  amountRange: [number, number]
}

interface FiltersBarProps {
  filters: Filters
  onFiltersChange: (filters: Filters) => void
  maxAmount: number
  minAmount: number
}

export function FiltersBar({
  filters,
  onFiltersChange,
  maxAmount,
  minAmount,
}: FiltersBarProps) {
  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const hasActiveFilters =
    filters.search !== '' ||
    filters.program !== 'ALL' ||
    filters.status !== 'ALL' ||
    filters.amountRange[0] !== minAmount ||
    filters.amountRange[1] !== maxAmount

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      program: 'ALL',
      status: 'ALL',
      amountRange: [minAmount, maxAmount],
    })
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Filters</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-7 text-xs"
          >
            <X className="mr-1 h-3 w-3" />
            Clear All
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Name, email, ID..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Program
          </label>
          <Select
            value={filters.program}
            onValueChange={(value) =>
              updateFilter('program', value as Filters['program'])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Programs</SelectItem>
              <SelectItem value="MAHAD">Mahad</SelectItem>
              <SelectItem value="DUGSI">Dugsi</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Status
          </label>
          <Select
            value={filters.status}
            onValueChange={(value) =>
              updateFilter('status', value as Filters['status'])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trialing">Trialing</SelectItem>
              <SelectItem value="past_due">Past Due</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Amount Range
            </label>
            <Badge variant="secondary" className="text-xs">
              ${(filters.amountRange[0] / 100).toFixed(0)} - $
              {(filters.amountRange[1] / 100).toFixed(0)}
            </Badge>
          </div>
          <Slider
            value={filters.amountRange}
            onValueChange={(value) =>
              updateFilter('amountRange', value as [number, number])
            }
            min={minAmount}
            max={maxAmount}
            step={100}
            className="w-full"
          />
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {filters.search && (
            <Badge variant="secondary" className="text-xs">
              Search: {filters.search}
              <button
                onClick={() => updateFilter('search', '')}
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.program !== 'ALL' && (
            <Badge variant="secondary" className="text-xs">
              Program: {filters.program}
              <button
                onClick={() => updateFilter('program', 'ALL')}
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.status !== 'ALL' && (
            <Badge variant="secondary" className="text-xs capitalize">
              Status: {filters.status.replace('_', ' ')}
              <button
                onClick={() => updateFilter('status', 'ALL')}
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {(filters.amountRange[0] !== minAmount ||
            filters.amountRange[1] !== maxAmount) && (
            <Badge variant="secondary" className="text-xs">
              Amount: ${(filters.amountRange[0] / 100).toFixed(0)} - $
              {(filters.amountRange[1] / 100).toFixed(0)}
              <button
                onClick={() =>
                  updateFilter('amountRange', [minAmount, maxAmount])
                }
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
