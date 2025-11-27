'use client'

import { useCallback, useMemo, useState } from 'react'

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { OrphanedSubscription, StudentMatch } from '../actions'
import { Filters, FiltersBar } from './filters-bar'
import { MultiSubscriptionCard } from './multi-subscription-card'
import { SubscriptionCard } from './subscription-card'

type SortField = 'date' | 'amount' | 'status' | 'name'
type SortDirection = 'asc' | 'desc'

interface SubscriptionsListClientProps {
  subsWithMatches: Array<{ sub: OrphanedSubscription; matches: StudentMatch[] }>
  multiSubsByCustomer: Map<string, OrphanedSubscription[]>
  multiSubsMatchesMap: Map<string, StudentMatch[]>
  noMatchesWithMatches: Array<{
    sub: OrphanedSubscription
    matches: StudentMatch[]
  }>
  allSubscriptions: OrphanedSubscription[]
}

export function SubscriptionsListClient({
  subsWithMatches: initialSubsWithMatches,
  multiSubsByCustomer: initialMultiSubsByCustomer,
  multiSubsMatchesMap,
  noMatchesWithMatches: initialNoMatchesWithMatches,
  allSubscriptions,
}: SubscriptionsListClientProps) {
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [filters, setFilters] = useState<Filters>({
    search: '',
    program: 'ALL',
    status: 'ALL',
    amountRange: [
      Math.min(...allSubscriptions.map((s) => s.amount)),
      Math.max(...allSubscriptions.map((s) => s.amount)),
    ],
  })

  const minAmount = Math.min(...allSubscriptions.map((s) => s.amount))
  const maxAmount = Math.max(...allSubscriptions.map((s) => s.amount))

  const applyFilters = useCallback(
    (items: Array<{ sub: OrphanedSubscription; matches: StudentMatch[] }>) => {
      return items.filter(({ sub }) => {
        if (filters.program !== 'ALL' && sub.program !== filters.program) {
          return false
        }

        if (filters.status !== 'ALL' && sub.status !== filters.status) {
          return false
        }

        if (
          sub.amount < filters.amountRange[0] ||
          sub.amount > filters.amountRange[1]
        ) {
          return false
        }

        if (filters.search) {
          const searchLower = filters.search.toLowerCase()
          const matchesSearch =
            sub.customerName?.toLowerCase().includes(searchLower) ||
            sub.customerEmail?.toLowerCase().includes(searchLower) ||
            sub.customerId.toLowerCase().includes(searchLower) ||
            sub.id.toLowerCase().includes(searchLower)
          if (!matchesSearch) return false
        }

        return true
      })
    },
    [filters]
  )

  const sortItems = useCallback(
    (items: Array<{ sub: OrphanedSubscription; matches: StudentMatch[] }>) => {
      return [...items].sort((a, b) => {
        let comparison = 0

        switch (sortField) {
          case 'date':
            comparison = a.sub.created.getTime() - b.sub.created.getTime()
            break
          case 'amount':
            comparison = a.sub.amount - b.sub.amount
            break
          case 'status':
            comparison = a.sub.status.localeCompare(b.sub.status)
            break
          case 'name':
            comparison = (a.sub.customerName || '').localeCompare(
              b.sub.customerName || ''
            )
            break
        }

        return sortDirection === 'asc' ? comparison : -comparison
      })
    },
    [sortField, sortDirection]
  )

  const filteredAndSortedSubsWithMatches = useMemo(() => {
    const filtered = applyFilters(initialSubsWithMatches)
    return sortItems(filtered)
  }, [initialSubsWithMatches, applyFilters, sortItems])

  const filteredAndSortedNoMatches = useMemo(() => {
    const filtered = applyFilters(initialNoMatchesWithMatches)
    return sortItems(filtered)
  }, [initialNoMatchesWithMatches, applyFilters, sortItems])

  const filteredMultiSubsByCustomer = useMemo(() => {
    const filtered = new Map<string, OrphanedSubscription[]>()
    for (const [customerId, subs] of Array.from(
      initialMultiSubsByCustomer.entries()
    )) {
      const filteredSubs = subs.filter((sub) => {
        if (filters.program !== 'ALL' && sub.program !== filters.program) {
          return false
        }
        if (filters.status !== 'ALL' && sub.status !== filters.status) {
          return false
        }
        if (
          sub.amount < filters.amountRange[0] ||
          sub.amount > filters.amountRange[1]
        ) {
          return false
        }
        if (filters.search) {
          const searchLower = filters.search.toLowerCase()
          const matchesSearch =
            sub.customerName?.toLowerCase().includes(searchLower) ||
            sub.customerEmail?.toLowerCase().includes(searchLower) ||
            sub.customerId.toLowerCase().includes(searchLower) ||
            sub.id.toLowerCase().includes(searchLower)
          if (!matchesSearch) return false
        }
        return true
      })
      if (filteredSubs.length > 0) {
        filtered.set(customerId, filteredSubs)
      }
    }
    return filtered
  }, [initialMultiSubsByCustomer, filters])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const SortButton = ({
    field,
    label,
  }: {
    field: SortField
    label: string
  }) => {
    const isActive = sortField === field
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleSort(field)}
        className="h-8 gap-1 text-xs"
      >
        {label}
        {isActive ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </Button>
    )
  }

  return (
    <div className="space-y-6">
      <FiltersBar
        filters={filters}
        onFiltersChange={setFilters}
        minAmount={minAmount}
        maxAmount={maxAmount}
      />

      <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Sort by:</span>
          <SortButton field="date" label="Date" />
          <SortButton field="amount" label="Amount" />
          <SortButton field="status" label="Status" />
          <SortButton field="name" label="Name" />
        </div>
        <div className="text-xs text-muted-foreground sm:text-sm">
          Showing{' '}
          {filteredAndSortedSubsWithMatches.length +
            filteredAndSortedNoMatches.length +
            Array.from(filteredMultiSubsByCustomer.values()).reduce(
              (sum, subs) => sum + subs.length,
              0
            )}{' '}
          of {allSubscriptions.length} subscriptions
        </div>
      </div>

      <div className="space-y-4">
        {filteredAndSortedSubsWithMatches.length === 0 &&
        filteredAndSortedNoMatches.length === 0 &&
        filteredMultiSubsByCustomer.size === 0 ? (
          <div className="rounded-lg border bg-muted/50 p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <svg
                className="h-6 w-6 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">
              No subscriptions match your filters
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try adjusting your search or filter criteria to see more results
            </p>
          </div>
        ) : (
          <>
            {filteredAndSortedSubsWithMatches.length > 0 && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-3 sm:p-4">
                  <p className="text-sm font-medium text-foreground">
                    Easy Matches ({filteredAndSortedSubsWithMatches.length})
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    These subscriptions have customer emails that match students
                    in the database.
                  </p>
                </div>
                {filteredAndSortedSubsWithMatches.map(({ sub, matches }) => (
                  <SubscriptionCard
                    key={sub.id}
                    subscription={sub}
                    potentialMatches={matches}
                  />
                ))}
              </div>
            )}

            {filteredMultiSubsByCustomer.size > 0 && (
              <div className="space-y-4">
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950 sm:p-4">
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                    Multiple Subscriptions ({filteredMultiSubsByCustomer.size}{' '}
                    customers)
                  </p>
                  <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
                    These customers have multiple subscriptions. They may be
                    paying for themselves and other students.
                  </p>
                </div>
                {Array.from(filteredMultiSubsByCustomer.entries()).map(
                  ([customerId, subs]) => (
                    <MultiSubscriptionCard
                      key={customerId}
                      customerId={customerId}
                      customerEmail={subs[0].customerEmail || ''}
                      customerName={subs[0].customerName || 'No Name'}
                      subscriptions={subs}
                      potentialMatchesMap={multiSubsMatchesMap}
                    />
                  )
                )}
              </div>
            )}

            {filteredAndSortedNoMatches.length > 0 && (
              <div className="space-y-4">
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950 sm:p-4">
                  <p className="text-sm font-medium text-red-900 dark:text-red-100">
                    Manual Review Required ({filteredAndSortedNoMatches.length})
                  </p>
                  <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                    These subscriptions have no obvious matches in the database.
                    Use the search function to manually find and link the
                    correct student.
                  </p>
                </div>
                {filteredAndSortedNoMatches.map(({ sub, matches }) => (
                  <SubscriptionCard
                    key={sub.id}
                    subscription={sub}
                    potentialMatches={matches}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
