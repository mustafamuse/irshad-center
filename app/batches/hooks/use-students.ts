'use client'

import { useCallback, useMemo } from 'react'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useUIStore, useFilters, useSelectedStudents } from '../store/ui-store'
import {
  filterStudents,
  getBatchStudentCount,
  getUnassignedStudentsCount,
  getSelectedStudentsData,
} from '../store/filter-utils'
import {
  CreateStudentDto,
  UpdateStudentDto,
  StudentStatus,
  BatchStudentData,
} from '@/lib/types/batch'

/**
 * Hook for student operations and selection management
 * Now accepts students data as prop from Server Component
 * @param students - Optional array of students (defaults to empty array for backward compatibility)
 */
export function useStudents(students: BatchStudentData[] = []) {
  const queryClient = useQueryClient()
  const filters = useFilters()
  const selectedStudentIds = useSelectedStudents()

  const {
    selectStudent,
    deselectStudent,
    selectAllStudents: selectAllAction,
    clearSelection,
    isStudentSelected,
  } = useUIStore()

  // Compute filtered students based on current filters
  const filteredStudents = useMemo(
    () => filterStudents(students, filters),
    [students, filters]
  )

  // Get selected students data
  const selectedStudents = useMemo(
    () => getSelectedStudentsData(students, selectedStudentIds),
    [students, selectedStudentIds]
  )

  // Student counts
  const unassignedCount = useMemo(
    () => getUnassignedStudentsCount(students),
    [students]
  )
  const totalCount = students.length

  const getBatchCount = useCallback(
    (batchId: string) => getBatchStudentCount(students, batchId),
    [students]
  )

  // Select all filtered students
  const selectAllStudents = useCallback(() => {
    const studentIds = filteredStudents.map((s) => s.id)
    selectAllAction(studentIds)
  }, [filteredStudents, selectAllAction])

  // Create student mutation
  const createStudentMutation = useMutation({
    mutationFn: async (input: CreateStudentDto) => {
      const response = await fetch('/api/batches/students/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to create student')
      }

      return result.data
    },
    onSuccess: () => {
      toast.success('Student created successfully')
      // Invalidate queries to trigger refetch from server
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create student'
      )
    },
  })

  // Update student mutation
  const updateStudentMutation = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: UpdateStudentDto
    }) => {
      const response = await fetch(`/api/batches/students/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to update student')
      }

      return { id, data: result.data }
    },
    onSuccess: () => {
      toast.success('Student updated successfully')
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update student'
      )
    },
  })

  // Delete student mutation
  const deleteStudentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/batches/students/${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete student')
      }

      return id
    },
    onSuccess: (id) => {
      // Remove from selection if selected
      if (selectedStudentIds.has(id)) {
        deselectStudent(id)
      }
      toast.success('Student deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete student'
      )
    },
  })

  // Bulk update status mutation
  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({
      studentIds,
      status,
    }: {
      studentIds: string[]
      status: StudentStatus
    }) => {
      const response = await fetch('/api/batches/students/bulk-update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ studentIds, status }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to update student status')
      }

      return { studentIds, status, count: result.data }
    },
    onSuccess: ({ count }) => {
      toast.success(`Updated status for ${count} students`)
      clearSelection()
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to update student status'
      )
    },
  })

  // Get duplicates
  const getDuplicatesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/batches/students/duplicates')
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to get duplicate students')
      }

      return result.data
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to get duplicate students'
      )
    },
  })

  // Resolve duplicates mutation
  const resolveDuplicatesMutation = useMutation({
    mutationFn: async ({
      keepId,
      deleteIds,
      mergeData,
    }: {
      keepId: string
      deleteIds: string[]
      mergeData: boolean
    }) => {
      const response = await fetch('/api/batches/students/duplicates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keepId, deleteIds, mergeData }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to resolve duplicates')
      }

      return deleteIds
    },
    onSuccess: (deletedIds) => {
      // Remove from selection if selected
      deletedIds.forEach((id) => {
        if (selectedStudentIds.has(id)) {
          deselectStudent(id)
        }
      })
      toast.success('Duplicate students resolved successfully')
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to resolve duplicates'
      )
    },
  })

  return {
    // Data (filtered and selected)
    students,
    filteredStudents,
    selectedStudents,
    selectedStudentIds,

    // Computed counts
    unassignedCount,
    totalCount,
    getBatchStudentCount: getBatchCount,
    filteredCount: filteredStudents.length,
    selectedCount: selectedStudentIds.size,

    // Selection actions
    selectStudent,
    deselectStudent,
    selectAllStudents,
    clearSelection,
    isStudentSelected,

    // Mutations
    createStudent: createStudentMutation.mutate,
    updateStudent: (id: string, input: UpdateStudentDto) =>
      updateStudentMutation.mutate({ id, input }),
    deleteStudent: deleteStudentMutation.mutate,
    bulkUpdateStatus: (studentIds: string[], status: StudentStatus) =>
      bulkUpdateStatusMutation.mutate({ studentIds, status }),
    getDuplicates: getDuplicatesMutation.mutate,
    resolveDuplicates: (
      keepId: string,
      deleteIds: string[],
      mergeData = false
    ) => resolveDuplicatesMutation.mutate({ keepId, deleteIds, mergeData }),

    // Loading states
    isCreating: createStudentMutation.isPending,
    isUpdating: updateStudentMutation.isPending,
    isDeleting: deleteStudentMutation.isPending,
    isBulkUpdating: bulkUpdateStatusMutation.isPending,
    isGettingDuplicates: getDuplicatesMutation.isPending,
    isResolvingDuplicates: resolveDuplicatesMutation.isPending,

    // Mutation data
    duplicates: getDuplicatesMutation.data,

    // Combined loading state
    isLoading:
      createStudentMutation.isPending ||
      updateStudentMutation.isPending ||
      deleteStudentMutation.isPending ||
      bulkUpdateStatusMutation.isPending ||
      getDuplicatesMutation.isPending ||
      resolveDuplicatesMutation.isPending,
  }
}
