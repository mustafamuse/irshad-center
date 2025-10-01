'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useUIStore, useSelectedBatch } from '../store/ui-store'
import {
  CreateBatchDto,
  UpdateBatchDto,
  BatchAssignment,
  BatchTransfer,
  BatchWithCount,
} from '@/lib/types/batch'

/**
 * Hook for batch operations
 * Now accepts batches data as prop from Server Component
 * @param batches - Optional array of batches (defaults to empty array for backward compatibility)
 */
export function useBatches(batches: BatchWithCount[] = []) {
  const queryClient = useQueryClient()
  const selectedBatchId = useSelectedBatch()
  const { selectBatch } = useUIStore()

  // Get selected batch object
  const selectedBatch =
    batches.find((b) => b.id === selectedBatchId) || null

  // Create batch mutation
  const createBatchMutation = useMutation({
    mutationFn: async (input: CreateBatchDto) => {
      const response = await fetch('/api/batches/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to create batch')
      }

      return result.data
    },
    onSuccess: () => {
      toast.success('Batch created successfully')
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create batch'
      )
    },
  })

  // Update batch mutation
  const updateBatchMutation = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: UpdateBatchDto
    }) => {
      const response = await fetch(`/api/batches/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to update batch')
      }

      return { id, data: result.data }
    },
    onSuccess: () => {
      toast.success('Batch updated successfully')
      queryClient.invalidateQueries({ queryKey: ['batches'] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update batch'
      )
    },
  })

  // Delete batch mutation
  const deleteBatchMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/batches/${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete batch')
      }

      return id
    },
    onSuccess: (id) => {
      // Clear selection if deleted batch was selected
      if (selectedBatchId === id) {
        selectBatch(null)
      }
      toast.success('Batch deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete batch'
      )
    },
  })

  // Assign students mutation
  const assignStudentsMutation = useMutation({
    mutationFn: async (assignment: BatchAssignment) => {
      const response = await fetch('/api/batches/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(assignment),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to assign students')
      }

      return result.data
    },
    onSuccess: (result) => {
      toast.success(`Successfully assigned ${result.assignedCount} students`)
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to assign students'
      )
    },
  })

  // Transfer students mutation
  const transferStudentsMutation = useMutation({
    mutationFn: async (transfer: BatchTransfer) => {
      const response = await fetch('/api/batches/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transfer),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to transfer students')
      }

      return result.data
    },
    onSuccess: (result) => {
      toast.success(`Successfully transferred ${result.assignedCount} students`)
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to transfer students'
      )
    },
  })

  return {
    // Data
    batches,
    selectedBatch,
    batchCount: batches.length,

    // Actions
    selectBatch,

    // Mutations
    createBatch: createBatchMutation.mutate,
    updateBatch: (id: string, input: UpdateBatchDto) =>
      updateBatchMutation.mutate({ id, input }),
    deleteBatch: deleteBatchMutation.mutate,
    assignStudents: assignStudentsMutation.mutate,
    transferStudents: transferStudentsMutation.mutate,

    // Loading states
    isCreating: createBatchMutation.isPending,
    isUpdating: updateBatchMutation.isPending,
    isDeleting: deleteBatchMutation.isPending,
    isAssigning: assignStudentsMutation.isPending,
    isTransferring: transferStudentsMutation.isPending,

    // Combined loading state
    isLoading:
      createBatchMutation.isPending ||
      updateBatchMutation.isPending ||
      deleteBatchMutation.isPending ||
      assignStudentsMutation.isPending ||
      transferStudentsMutation.isPending,
  }
}
