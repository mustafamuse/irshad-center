'use client'

import { useCallback, useMemo } from 'react'

import { EducationLevel, GradeLevel } from '@prisma/client'

import { useUIStore, useFilters as useFiltersSelector } from '../store/ui-store'
import {
  countActiveFilters,
  getFilterSummary,
  isFilterActive,
} from '../store/filter-utils'
import { StudentStatus } from '@/lib/types/batch'

export function useStudentFilters() {
  const filters = useFiltersSelector()

  const {
    setSearchQuery: setSearchQueryAction,
    setSearchFields: setSearchFieldsAction,
    setBatchFilter: setBatchFilterAction,
    toggleBatchFilter: toggleBatchFilterAction,
    setIncludeUnassigned: setIncludeUnassignedAction,
    setStatusFilter: setStatusFilterAction,
    toggleStatusFilter: toggleStatusFilterAction,
    setEducationLevelFilter: setEducationLevelFilterAction,
    toggleEducationLevelFilter: toggleEducationLevelFilterAction,
    setGradeLevelFilter: setGradeLevelFilterAction,
    toggleGradeLevelFilter: toggleGradeLevelFilterAction,
    setDateRangeFilter: setDateRangeFilterAction,
    clearDateRangeFilter: clearDateRangeFilterAction,
    resetFilters: resetFiltersAction,
    hasActiveFilters: hasActiveFiltersAction,
  } = useUIStore()

  // Search management
  const setSearchQuery = useCallback(
    (query: string) => {
      setSearchQueryAction(query)
    },
    [setSearchQueryAction]
  )

  const setSearchFields = useCallback(
    (fields: ('name' | 'email' | 'phone')[]) => {
      setSearchFieldsAction(fields)
    },
    [setSearchFieldsAction]
  )

  // Batch filter management
  const setBatchFilter = useCallback(
    (batchIds: string[]) => {
      setBatchFilterAction(batchIds)
    },
    [setBatchFilterAction]
  )

  const toggleBatchFilter = useCallback(
    (batchId: string) => {
      toggleBatchFilterAction(batchId)
    },
    [toggleBatchFilterAction]
  )

  const setIncludeUnassigned = useCallback(
    (include: boolean) => {
      setIncludeUnassignedAction(include)
    },
    [setIncludeUnassignedAction]
  )

  // Status filter management
  const setStatusFilter = useCallback(
    (statuses: StudentStatus[]) => {
      setStatusFilterAction(statuses)
    },
    [setStatusFilterAction]
  )

  const toggleStatusFilter = useCallback(
    (status: StudentStatus) => {
      toggleStatusFilterAction(status)
    },
    [toggleStatusFilterAction]
  )

  // Education level filter management
  const setEducationLevelFilter = useCallback(
    (levels: EducationLevel[]) => {
      setEducationLevelFilterAction(levels)
    },
    [setEducationLevelFilterAction]
  )

  const toggleEducationLevelFilter = useCallback(
    (level: EducationLevel) => {
      toggleEducationLevelFilterAction(level)
    },
    [toggleEducationLevelFilterAction]
  )

  // Grade level filter management
  const setGradeLevelFilter = useCallback(
    (levels: GradeLevel[]) => {
      setGradeLevelFilterAction(levels)
    },
    [setGradeLevelFilterAction]
  )

  const toggleGradeLevelFilter = useCallback(
    (level: GradeLevel) => {
      toggleGradeLevelFilterAction(level)
    },
    [toggleGradeLevelFilterAction]
  )

  // Date range filter management
  const setDateRangeFilter = useCallback(
    (
      from: Date | null,
      to: Date | null,
      field: 'createdAt' | 'updatedAt' | 'dateOfBirth' = 'createdAt'
    ) => {
      setDateRangeFilterAction(from, to, field)
    },
    [setDateRangeFilterAction]
  )

  const clearDateRangeFilter = useCallback(() => {
    clearDateRangeFilterAction()
  }, [clearDateRangeFilterAction])

  // Computed values using utility functions
  const activeFilterCount = useMemo(
    () => countActiveFilters(filters),
    [filters]
  )

  const checkFilterActive = useCallback(
    (filterType: keyof typeof filters) => {
      return isFilterActive(filters, filterType)
    },
    [filters]
  )

  const filterSummary = useMemo(() => getFilterSummary(filters), [filters])

  return {
    // Current filters
    filters,

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
    resetFilters: resetFiltersAction,

    // Computed values
    hasActiveFilters: hasActiveFiltersAction(),
    activeFilterCount,
    isFilterActive: checkFilterActive,
    getFilterSummary: () => filterSummary,
  }
}
