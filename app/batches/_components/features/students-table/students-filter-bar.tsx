'use client'

import { Search, X, Filter } from 'lucide-react'

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

import { useStudentFilters } from '../../../_hooks/use-filters'
import { BatchWithCount, StudentStatus } from '../../../_types'

interface StudentsFilterBarProps {
  batches: BatchWithCount[]
}

export function StudentsFilterBar({ batches }: StudentsFilterBarProps) {
  const {
    filters,
    setSearchQuery,
    toggleBatchFilter,
    toggleStatusFilter,
    resetFilters,
    hasActiveFilters,
    activeFilterCount,
  } = useStudentFilters()

  const statusOptions: StudentStatus[] = [
    StudentStatus.ACTIVE,
    StudentStatus.INACTIVE,
    StudentStatus.GRADUATED,
    StudentStatus.SUSPENDED,
    StudentStatus.TRANSFERRED,
  ]

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search students by name, email, or phone..."
          value={filters.search?.query ?? ''}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10"
        />
        {filters.search?.query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
            onClick={() => setSearchQuery('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters:</span>
        </div>

        {/* Batch Filter */}
        <Select onValueChange={(value) => value && toggleBatchFilter(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select batch..." />
          </SelectTrigger>
          <SelectContent>
            {batches.map((batch) => (
              <SelectItem key={batch.id} value={batch.id}>
                {batch.name} ({batch.studentCount})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          onValueChange={(value) =>
            value && toggleStatusFilter(value as StudentStatus)
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status..." />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Active Filters Display */}
        {filters.batch?.selected?.map((batchId) => {
          const batch = batches.find((b) => b.id === batchId)
          return batch ? (
            <Badge
              key={batchId}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => toggleBatchFilter(batchId)}
            >
              {batch.name}
              <X className="ml-1 h-3 w-3" />
            </Badge>
          ) : null
        })}

        {filters.status?.selected?.map((status) => (
          <Badge
            key={status}
            variant="secondary"
            className="cursor-pointer"
            onClick={() => toggleStatusFilter(status)}
          >
            {status}
            <X className="ml-1 h-3 w-3" />
          </Badge>
        ))}

        {/* Reset Filters */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            className="ml-2"
          >
            Clear All ({activeFilterCount})
          </Button>
        )}
      </div>
    </div>
  )
}
