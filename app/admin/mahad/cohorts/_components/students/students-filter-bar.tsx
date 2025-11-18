'use client'

import { useMemo, useState, useEffect } from 'react'

import { SubscriptionStatus } from '@prisma/client'
import { Search, X, Filter } from 'lucide-react'
import { useDebouncedCallback } from 'use-debounce'

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
import { BatchWithCount } from '@/lib/types/batch'
import { StudentStatus, getStudentStatusDisplay } from '@/lib/types/student'
import { getSubscriptionStatusDisplay } from '@/lib/utils/subscription-status'

import { useURLFilters } from '../../_hooks/use-url-filters'

interface StudentsFilterBarProps {
  batches: BatchWithCount[]
}

export function StudentsFilterBar({ batches }: StudentsFilterBarProps) {
  const {
    filters,
    setSearch,
    toggleBatch,
    toggleStatus,
    toggleSubscriptionStatus,
    resetFilters,
  } = useURLFilters()

  // Local state for immediate UI feedback
  const [searchInput, setSearchInput] = useState(filters.search)

  // Debounced search to avoid updating URL on every keystroke
  const debouncedSetSearch = useDebouncedCallback((value: string) => {
    setSearch(value)
  }, 300)

  // Sync local search with URL when it changes externally
  // Cancel pending debounced updates to prevent race conditions
  useEffect(() => {
    setSearchInput(filters.search)
    debouncedSetSearch.cancel()
    // Note: debouncedSetSearch is intentionally omitted from deps as it's a
    // stable reference from useDebouncedCallback and doesn't need to trigger re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search])

  // Local state for controlled Select components
  const [batchSelectValue, setBatchSelectValue] = useState('')
  const [statusSelectValue, setStatusSelectValue] = useState('')
  const [subscriptionStatusSelectValue, setSubscriptionStatusSelectValue] =
    useState('')

  // Compute active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.search) count++
    if (filters.batchIds.length > 0) count++
    if (filters.statuses.length > 0) count++
    if (filters.subscriptionStatuses.length > 0) count++
    return count
  }, [filters])

  const hasActiveFilters = activeFilterCount > 0

  const statusOptions: StudentStatus[] = [
    StudentStatus.REGISTERED,
    StudentStatus.ENROLLED,
    StudentStatus.ON_LEAVE,
    StudentStatus.WITHDRAWN,
  ]

  const subscriptionStatusOptions: SubscriptionStatus[] = [
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'trialing',
    'incomplete',
    'incomplete_expired',
    'paused',
  ]

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search students..."
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value)
            debouncedSetSearch(e.target.value)
          }}
          className="h-11 pl-10 pr-10"
        />
        {searchInput && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 p-0"
            onClick={() => {
              setSearchInput('')
              setSearch('')
            }}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Clear search</span>
          </Button>
        )}
      </div>

      {/* Filter Section */}
      <div className="space-y-3">
        {/* Filter Label - Hidden on Mobile */}
        <div className="hidden items-center gap-2 sm:flex">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            Filters:
          </span>
        </div>

        {/* Filter Controls - Stacked on Mobile, Row on Desktop */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          {/* Batch Filter */}
          <Select
            value={batchSelectValue}
            onValueChange={(value) => {
              if (value) {
                toggleBatch(value)
                setBatchSelectValue('')
              }
            }}
          >
            <SelectTrigger className="h-11 w-full sm:w-[180px]">
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
            value={statusSelectValue}
            onValueChange={(value) => {
              if (value) {
                toggleStatus(value as StudentStatus)
                setStatusSelectValue('')
              }
            }}
          >
            <SelectTrigger className="h-11 w-full sm:w-[140px]">
              <SelectValue placeholder="Status..." />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {getStudentStatusDisplay(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Subscription Status Filter */}
          <Select
            value={subscriptionStatusSelectValue}
            onValueChange={(value) => {
              if (value) {
                toggleSubscriptionStatus(value as SubscriptionStatus)
                setSubscriptionStatusSelectValue('')
              }
            }}
          >
            <SelectTrigger className="h-11 w-full sm:w-[200px]">
              <SelectValue placeholder="Subscription Status..." />
            </SelectTrigger>
            <SelectContent>
              {subscriptionStatusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {getSubscriptionStatusDisplay(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Active Batch Filters */}
          {filters.batchIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {filters.batchIds.map((batchId) => {
                const batch = batches.find((b) => b.id === batchId)
                return batch ? (
                  <Badge
                    key={batchId}
                    variant="secondary"
                    className="h-9 cursor-pointer px-3"
                    onClick={() => toggleBatch(batchId)}
                  >
                    {batch.name}
                    <X className="ml-1.5 h-3.5 w-3.5" />
                  </Badge>
                ) : null
              })}
            </div>
          )}

          {/* Active Status Filters */}
          {filters.statuses.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {filters.statuses.map((status) => (
                <Badge
                  key={status}
                  variant="secondary"
                  className="h-9 cursor-pointer px-3"
                  onClick={() => toggleStatus(status)}
                >
                  {getStudentStatusDisplay(status as StudentStatus)}
                  <X className="ml-1.5 h-3.5 w-3.5" />
                </Badge>
              ))}
            </div>
          )}

          {/* Active Subscription Status Filters */}
          {filters.subscriptionStatuses.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {filters.subscriptionStatuses.map((status) => (
                <Badge
                  key={status}
                  variant="secondary"
                  className="h-9 cursor-pointer px-3"
                  onClick={() => toggleSubscriptionStatus(status)}
                >
                  {getSubscriptionStatusDisplay(status as SubscriptionStatus)}
                  <X className="ml-1.5 h-3.5 w-3.5" />
                </Badge>
              ))}
            </div>
          )}

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetFilters()
                setBatchSelectValue('')
                setStatusSelectValue('')
                setSubscriptionStatusSelectValue('')
              }}
              className="h-9 w-full sm:ml-auto sm:w-auto"
            >
              Clear All ({activeFilterCount})
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
