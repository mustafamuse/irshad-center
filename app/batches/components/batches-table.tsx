'use client'

import { memo, useCallback } from 'react'

import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'

import { enhancedColumns } from './enhanced-columns'
import { MobileStudentCard } from './mobile-student-card'
import { useBatchData } from '../hooks/use-batch-data'
import { useBatches } from '../hooks/use-batches'
import { useEnhancedFilteredStudents } from './filters/enhanced-use-filtered-students'
import { FilterBar } from './filters/filter-bar'
import { useStudentFilters } from './filters/use-student-filters'

// Memoized search performance indicator
const SearchPerformanceIndicator = memo(function SearchPerformanceIndicator({
  searchTime,
  resultCount,
  totalCount,
  hasActiveSearch,
}: {
  searchTime: number
  resultCount: number
  totalCount: number
  hasActiveSearch: boolean
}) {
  if (!hasActiveSearch) return null

  const isSlowSearch = searchTime > 100 // More than 100ms is considered slow

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>
        {resultCount} of {totalCount} students
      </span>
      <Badge
        variant={isSlowSearch ? 'destructive' : 'secondary'}
        className="text-xs"
      >
        {searchTime.toFixed(1)}ms
      </Badge>
    </div>
  )
})

export function BatchesTable() {
  // Fetch data
  const { data: students = [], isLoading } = useBatchData()
  const { data: batches = [] } = useBatches()

  // Use our filter system
  const { filters, setFilter, resetFilters, hasActiveFilters } =
    useStudentFilters()

  // Get enhanced filtered students with search highlighting
  const {
    students: filteredStudents,
    totalResults,
    searchTime,
  } = useEnhancedFilteredStudents(students, filters)

  // Memoize the filter change handler to prevent unnecessary re-renders
  const handleFilterChange = useCallback(setFilter, [setFilter])

  const hasActiveSearch = Boolean(filters.search.query.trim())

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="text-muted-foreground">Loading students...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
          Students
        </h2>
        <div className="flex items-center gap-2 sm:gap-4">
          <SearchPerformanceIndicator
            searchTime={searchTime}
            resultCount={totalResults}
            totalCount={students.length}
            hasActiveSearch={hasActiveSearch}
          />
          {hasActiveFilters && !hasActiveSearch && (
            <Badge variant="outline" className="text-xs">
              {totalResults} filtered
            </Badge>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        batches={batches}
        hasActiveFilters={hasActiveFilters}
        onReset={resetFilters}
      />

      {/* Mobile Card View (hidden on larger screens) */}
      <div className="grid gap-3 sm:hidden">
        {filteredStudents.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No students found matching your filters.
          </div>
        ) : (
          filteredStudents.map((student) => (
            <MobileStudentCard key={student.id} student={student} />
          ))
        )}
      </div>

      {/* Desktop Table View (hidden on mobile) */}
      <div className="hidden sm:block">
        <DataTable columns={enhancedColumns} data={filteredStudents} />
      </div>
    </div>
  )
}
