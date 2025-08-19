'use client'

interface StudentsHeaderProps {
  totalCount: number
  filteredCount: number
  hasActiveFilters: boolean
}

export function StudentsHeader({
  totalCount,
  filteredCount,
  hasActiveFilters,
}: StudentsHeaderProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Students</h2>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {hasActiveFilters ? (
          <span>
            Showing {filteredCount} of {totalCount} students
          </span>
        ) : (
          <span>{totalCount} students total</span>
        )}
      </div>
    </div>
  )
}
