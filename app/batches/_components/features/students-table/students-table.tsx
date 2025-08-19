'use client'

import { memo } from 'react'

import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'

import { MobileStudentsList } from './mobile-students-list'
import { createStudentColumns } from './student-columns'
import { StudentsFilterBar } from './students-filter-bar'
import { StudentsHeader } from './students-header'
import { useBatches } from '../../../_hooks/use-batches'
import { useStudentFilters } from '../../../_hooks/use-filters'
import { useStudents } from '../../../_hooks/use-students'
import { useBatchStore } from '../../../_store/batch.store'

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

export function StudentsTable() {
  const { filteredStudents, students } = useStudents()
  const { batches } = useBatches()
  const { filters, hasActiveFilters } = useStudentFilters()
  const { studentsLoading } = useBatchStore()

  // Debug removed

  const hasActiveSearch = Boolean(filters.search?.query?.trim())
  const columns = createStudentColumns()

  if (studentsLoading.isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="text-muted-foreground">
          {studentsLoading.loadingText || 'Loading students...'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <StudentsHeader
        totalCount={students.length}
        filteredCount={filteredStudents.length}
        hasActiveFilters={hasActiveFilters}
      />

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
