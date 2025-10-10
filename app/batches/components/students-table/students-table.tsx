'use client'

import { memo, useMemo } from 'react'

import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { BatchWithCount, BatchStudentData } from '@/lib/types/batch'

import { MobileStudentsList } from './mobile-students-list'
import { createStudentColumns } from './student-columns'
import { StudentsFilterBar } from './students-filter-bar'
import { filterStudents, countActiveFilters, useFilters } from '../../store/ui-store'

// Performance indicator for search
const SearchPerformanceIndicator = memo(function SearchPerformanceIndicator({
  resultCount,
  totalCount,
  hasActiveSearch,
}: {
  resultCount: number
  totalCount: number
  hasActiveSearch: boolean
}) {
  if (!hasActiveSearch) return null

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>
        {resultCount} of {totalCount} students
      </span>
    </div>
  )
})

interface StudentsTableProps {
  students: BatchStudentData[]
  batches: BatchWithCount[]
}

export function StudentsTable({ students, batches }: StudentsTableProps) {
  const filters = useFilters()

  // Compute filtered students based on current filters
  const filteredStudents = useMemo(
    () => filterStudents(students, filters),
    [students, filters]
  )

  // Compute if there are active filters
  const activeFilterCount = useMemo(
    () => countActiveFilters(filters),
    [filters]
  )
  const hasActiveFilters = activeFilterCount > 0

  const hasActiveSearch = Boolean(filters.search?.query?.trim())
  const columns = createStudentColumns()

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Students</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {hasActiveFilters ? (
            <span>
              Showing {filteredStudents.length} of {students.length} students
            </span>
          ) : (
            <span>{students.length} students total</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchPerformanceIndicator
          resultCount={filteredStudents.length}
          totalCount={students.length}
          hasActiveSearch={hasActiveSearch}
        />
        {hasActiveFilters && !hasActiveSearch && (
          <Badge variant="outline" className="text-xs">
            {filteredStudents.length} filtered
          </Badge>
        )}
      </div>

      <StudentsFilterBar batches={batches} />

      {/* Mobile Card View (hidden on larger screens) */}
      <div className="sm:hidden">
        <MobileStudentsList students={filteredStudents} />
      </div>

      {/* Desktop Table View (hidden on mobile) */}
      <div className="hidden sm:block">
        <DataTable columns={columns} data={filteredStudents} />
      </div>
    </div>
  )
}
