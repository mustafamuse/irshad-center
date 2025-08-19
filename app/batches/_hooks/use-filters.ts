'use client'

import { useCallback, useMemo } from 'react'

import { EducationLevel, GradeLevel } from '@prisma/client'

import {
  useBatchStore,
  useFilters as useFiltersSelector,
  useFilteredStudents,
} from '../_store/batch.store'
import { StudentFilters, StudentStatus } from '../_types'

export function useStudentFilters() {
  const filters = useFiltersSelector()
  const filteredStudents = useFilteredStudents()

  const {
    setFilter,
    updateSearchQuery,
    addBatchFilter,
    removeBatchFilter,
    addStatusFilter,
    removeStatusFilter,
    resetFilters,
    hasActiveFilters,
  } = useBatchStore()

  // Search management
  const setSearchQuery = useCallback(
    (query: string) => {
      updateSearchQuery(query)
    },
    [updateSearchQuery]
  )

  const setSearchFields = useCallback(
    (fields: ('name' | 'email' | 'phone')[]) => {
      setFilter('search', {
        ...filters.search,
        fields,
      })
    },
    [setFilter, filters.search]
  )

  // Batch filter management
  const setBatchFilter = useCallback(
    (batchIds: string[]) => {
      setFilter('batch', {
        ...filters.batch,
        selected: batchIds,
      })
    },
    [setFilter, filters.batch]
  )

  const toggleBatchFilter = useCallback(
    (batchId: string) => {
      if (filters.batch?.selected?.includes(batchId)) {
        removeBatchFilter(batchId)
      } else {
        addBatchFilter(batchId)
      }
    },
    [filters.batch?.selected, addBatchFilter, removeBatchFilter]
  )

  const setIncludeUnassigned = useCallback(
    (include: boolean) => {
      setFilter('batch', {
        ...(filters.batch ?? {}),
        includeUnassigned: include,
      })
    },
    [setFilter, filters.batch]
  )

  // Status filter management
  const setStatusFilter = useCallback(
    (statuses: StudentStatus[]) => {
      setFilter('status', {
        selected: statuses,
      })
    },
    [setFilter]
  )

  const toggleStatusFilter = useCallback(
    (status: StudentStatus) => {
      if (filters.status?.selected?.includes(status)) {
        removeStatusFilter(status)
      } else {
        addStatusFilter(status)
      }
    },
    [filters.status?.selected, addStatusFilter, removeStatusFilter]
  )

  // Education level filter management
  const setEducationLevelFilter = useCallback(
    (levels: EducationLevel[]) => {
      setFilter('educationLevel', {
        selected: levels,
      })
    },
    [setFilter]
  )

  const toggleEducationLevelFilter = useCallback(
    (level: EducationLevel) => {
      const current = filters.educationLevel?.selected ?? []
      const updated = current.includes(level)
        ? current.filter((l) => l !== level)
        : [...current, level]

      setEducationLevelFilter(updated)
    },
    [filters.educationLevel?.selected, setEducationLevelFilter]
  )

  // Grade level filter management
  const setGradeLevelFilter = useCallback(
    (levels: GradeLevel[]) => {
      setFilter('gradeLevel', {
        selected: levels,
      })
    },
    [setFilter]
  )

  const toggleGradeLevelFilter = useCallback(
    (level: GradeLevel) => {
      const current = filters.gradeLevel?.selected ?? []
      const updated = current.includes(level)
        ? current.filter((l) => l !== level)
        : [...current, level]

      setGradeLevelFilter(updated)
    },
    [filters.gradeLevel?.selected, setGradeLevelFilter]
  )

  // Date range filter management
  const setDateRangeFilter = useCallback(
    (
      from: Date | null,
      to: Date | null,
      field: 'createdAt' | 'updatedAt' | 'dateOfBirth' = 'createdAt'
    ) => {
      setFilter('dateRange', {
        from,
        to,
        field,
      })
    },
    [setFilter]
  )

  const clearDateRangeFilter = useCallback(() => {
    setDateRangeFilter(null, null)
  }, [setDateRangeFilter])

  // Combined filter management
  const setMultipleFilters = useCallback(
    (newFilters: Partial<StudentFilters>) => {
      Object.entries(newFilters).forEach(([key, value]) => {
        setFilter(key as keyof StudentFilters, value)
      })
    },
    [setFilter]
  )

  // Computed values
  const activeFilterCount = useMemo(() => {
    let count = 0

    if ((filters.search?.query?.length ?? 0) > 0) count++
    if ((filters.batch?.selected?.length ?? 0) > 0) count++
    if ((filters.status?.selected?.length ?? 0) > 0) count++
    if ((filters.educationLevel?.selected?.length ?? 0) > 0) count++
    if ((filters.gradeLevel?.selected?.length ?? 0) > 0) count++
    if (filters.dateRange?.from || filters.dateRange?.to) count++

    return count
  }, [filters])

  const isFilterActive = useCallback(
    (filterType: keyof StudentFilters) => {
      switch (filterType) {
        case 'search':
          return (filters.search?.query?.length ?? 0) > 0
        case 'batch':
          return (filters.batch?.selected?.length ?? 0) > 0
        case 'status':
          return (filters.status?.selected?.length ?? 0) > 0
        case 'educationLevel':
          return (filters.educationLevel?.selected?.length ?? 0) > 0
        case 'gradeLevel':
          return (filters.gradeLevel?.selected?.length ?? 0) > 0
        case 'dateRange':
          return (
            filters.dateRange?.from !== null || filters.dateRange?.to !== null
          )
        default:
          return false
      }
    },
    [filters]
  )

  const getFilterSummary = useCallback(() => {
    const summary: string[] = []

    if (filters.search?.query) {
      summary.push(`Search: "${filters.search.query}"`)
    }

    if ((filters.batch?.selected?.length ?? 0) > 0) {
      summary.push(`Batches: ${filters.batch?.selected?.length} selected`)
    }

    if ((filters.status?.selected?.length ?? 0) > 0) {
      summary.push(`Status: ${filters.status?.selected?.join(', ')}`)
    }

    if ((filters.educationLevel?.selected?.length ?? 0) > 0) {
      summary.push(
        `Education: ${filters.educationLevel?.selected?.length} levels`
      )
    }

    if ((filters.gradeLevel?.selected?.length ?? 0) > 0) {
      summary.push(`Grades: ${filters.gradeLevel?.selected?.length} levels`)
    }

    if (filters.dateRange?.from || filters.dateRange?.to) {
      summary.push('Date range applied')
    }

    return summary
  }, [filters])

  return {
    // Current filters
    filters,
    filteredStudents,

    // Search
    setSearchQuery,
    setSearchFields,

    // Batch filters
    setBatchFilter,
    toggleBatchFilter,
    setIncludeUnassigned,

    // Status filters
    setStatusFilter,
    toggleStatusFilter,

    // Education level filters
    setEducationLevelFilter,
    toggleEducationLevelFilter,

    // Grade level filters
    setGradeLevelFilter,
    toggleGradeLevelFilter,

    // Date range filters
    setDateRangeFilter,
    clearDateRangeFilter,

    // Combined operations
    setMultipleFilters,
    resetFilters,

    // Computed values
    hasActiveFilters: hasActiveFilters(),
    activeFilterCount,
    isFilterActive,
    getFilterSummary,

    // Results
    resultCount: filteredStudents.length,
  }
}
