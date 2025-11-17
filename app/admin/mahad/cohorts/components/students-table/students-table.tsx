'use client'

import { useMemo, useEffect } from 'react'

import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { BatchWithCount, BatchStudentData } from '@/lib/types/batch'

import { MobileStudentsList } from './mobile-students-list'
import { createStudentColumns } from './student-columns'
import { StudentsFilterBar } from './students-filter-bar'
import { useURLFilters } from '../../hooks/use-url-filters'
import { useUIStore } from '../../store/ui-store'

interface StudentsTableProps {
  students: BatchStudentData[]
  batches: BatchWithCount[]
  totalCount: number
  currentPage: number
  totalPages: number
}

export function StudentsTable({
  students,
  batches,
  totalCount,
  currentPage,
  totalPages,
}: StudentsTableProps) {
  const { filters, setPage, isPending, resetFilters } = useURLFilters()
  const setStudentSelection = useUIStore((s) => s.setStudentSelection)

  const columns = createStudentColumns(batches)

  // Check if any filters are active
  const hasFilters = useMemo(() => {
    return (
      Boolean(filters.search) ||
      filters.batchIds.length > 0 ||
      filters.statuses.length > 0 ||
      filters.subscriptionStatuses.length > 0 ||
      filters.educationLevels.length > 0 ||
      filters.gradeLevels.length > 0
    )
  }, [filters])

  // Auto-reset to page 1 if current page exceeds total pages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setPage(1)
    }
  }, [currentPage, totalPages, setPage])

  // Handler to sync table selection with Zustand store
  const handleRowSelectionChange = (selectedRows: BatchStudentData[]) => {
    const selectedIds = selectedRows.map((row) => row.id)
    setStudentSelection(selectedIds)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
          Students
        </h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {hasFilters ? (
            <span>
              Showing {students.length} of {totalCount} students
            </span>
          ) : (
            <span>{totalCount} students total</span>
          )}
        </div>
      </div>

      {/* Filters */}
      <StudentsFilterBar batches={batches} />

      {/* Empty State */}
      {students.length === 0 && hasFilters && !isPending && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            No students match your filters
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting or clearing your filters to see more results.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            className="mt-4"
          >
            Clear all filters
          </Button>
        </div>
      )}

      {/* Mobile Card View */}
      {students.length > 0 && (
        <div className="sm:hidden">
          <MobileStudentsList students={students} batches={batches} />
        </div>
      )}

      {/* Desktop Table View */}
      {students.length > 0 && (
        <div className="hidden sm:block">
          <DataTable
            columns={columns}
            data={students}
            onRowSelectionChange={handleRowSelectionChange}
          />
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1 || isPending}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === totalPages || isPending}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {isPending && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">
            Loading students...
          </span>
        </div>
      )}
    </div>
  )
}
