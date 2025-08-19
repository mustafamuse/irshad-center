'use client'

import { useCallback } from 'react'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

// Removed useStudentService import - using API calls instead
import {
  useBatchStore,
  useStudents as useStudentsSelector,
  useFilteredStudents,
  useSelectedStudents,
} from '../_store/batch.store'
import {
  CreateStudentDto,
  UpdateStudentDto,
  StudentStatus,
  StudentFilters,
} from '../_types'

export function useStudents() {
  const students = useStudentsSelector()
  const filteredStudents = useFilteredStudents()
  const selectedStudents = useSelectedStudents()
  const queryClient = useQueryClient()

  const {
    setStudentsLoading,
    setStudentsError,
    setStudents,
    updateStudent,
    removeStudent,
    filters,
    selectedStudents: selectedStudentIds,
    selectStudent,
    deselectStudent,
    selectAllStudents,
    clearSelection,
    isStudentSelected,
    getUnassignedStudentsCount,
    getTotalStudentsCount,
    getBatchStudentCount,
  } = useBatchStore()

  // Refresh students
  const refreshStudents = useCallback(async () => {
    try {
      setStudentsLoading(true, 'Refreshing students...')
      const response = await fetch('/api/batches/students')
      const result = await response.json()

      if (result.success && result.data) {
        setStudents(result.data)
        setStudentsError(null)
        toast.success('Students refreshed successfully')
      } else {
        setStudentsError(result.error || 'Failed to refresh students')
        toast.error('Failed to refresh students')
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      setStudentsError(errorMessage)
      toast.error('Failed to refresh students')
    } finally {
      setStudentsLoading(false)
    }
  }, [setStudents, setStudentsError, setStudentsLoading])

  // Search students - using client-side filtering
  const searchStudents = useCallback(
    async (
      query: string,
      searchFilters?: StudentFilters,
      _page = 1,
      _pageSize = 50
    ) => {
      try {
        // For now, use client-side search on existing students data
        const filtered = students.filter((student) => {
          const searchQuery = query.toLowerCase()
          return (
            student.name.toLowerCase().includes(searchQuery) ||
            (student.email &&
              student.email.toLowerCase().includes(searchQuery)) ||
            (student.phone && student.phone.includes(searchQuery))
          )
        })

        return {
          students: filtered,
          totalResults: filtered.length,
          searchTime: 0,
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Search failed'
        setStudentsError(errorMessage)
        toast.error('Search failed')
        return null
      }
    },
    [students, setStudentsError]
  )

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
    onMutate: () => {
      setStudentsLoading(true, 'Creating student...')
    },
    onSuccess: () => {
      toast.success('Student created successfully')
      refreshStudents()
      queryClient.invalidateQueries({ queryKey: ['batches'] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create student'
      )
    },
    onSettled: () => {
      setStudentsLoading(false)
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
    onMutate: () => {
      setStudentsLoading(true, 'Updating student...')
    },
    onSuccess: ({ id, data }) => {
      // Update the student in the store
      updateStudent(id, {
        name: data.name,
        email: data.email,
        phone: data.phone,
        status: data.status,
        educationLevel: data.educationLevel,
        gradeLevel: data.gradeLevel,
        schoolName: data.schoolName,
      })
      toast.success('Student updated successfully')
      queryClient.invalidateQueries({ queryKey: ['batches'] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update student'
      )
    },
    onSettled: () => {
      setStudentsLoading(false)
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
    onMutate: () => {
      setStudentsLoading(true, 'Deleting student...')
    },
    onSuccess: (id) => {
      removeStudent(id)
      toast.success('Student deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['batches'] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete student'
      )
    },
    onSettled: () => {
      setStudentsLoading(false)
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
    onMutate: () => {
      setStudentsLoading(true, 'Updating student status...')
    },
    onSuccess: ({ studentIds, status, count }) => {
      // Update all affected students in the store
      studentIds.forEach((id) => {
        updateStudent(id, { status })
      })
      toast.success(`Updated status for ${count} students`)
      clearSelection()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to update student status'
      )
    },
    onSettled: () => {
      setStudentsLoading(false)
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
      // Remove deleted students from store
      deletedIds.forEach((id) => removeStudent(id))
      toast.success('Duplicate students resolved successfully')
      queryClient.invalidateQueries({ queryKey: ['batches'] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to resolve duplicates'
      )
    },
  })

  return {
    // Data
    students,
    filteredStudents,
    selectedStudents,
    selectedStudentIds,
    filters,

    // Computed
    unassignedCount: getUnassignedStudentsCount(),
    totalCount: getTotalStudentsCount(),
    getBatchStudentCount,

    // Actions
    refreshStudents,
    searchStudents,

    // Selection
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
