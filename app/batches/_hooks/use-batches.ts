'use client'

import { useCallback } from 'react'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  useBatchStore,
  useBatches as useBatchesSelector,
} from '../_store/batch.store'
// Removed useBatchService import - using API calls instead
import {
  CreateBatchDto,
  UpdateBatchDto,
  BatchAssignment,
  BatchTransfer,
} from '../_types'

export function useBatches() {
  const batches = useBatchesSelector()
  const queryClient = useQueryClient()

  const {
    setBatchesLoading,
    setBatchesError,
    setBatches,
    addBatch,
    updateBatch,
    removeBatch,
    selectedBatch,
    selectBatch,
  } = useBatchStore()

  // Refresh batches
  const refreshBatches = useCallback(async () => {
    try {
      setBatchesLoading(true, 'Refreshing batches...')
      const response = await fetch('/api/batches')
      const result = await response.json()

      if (result.success && result.data) {
        setBatches(result.data)
        setBatchesError(null)
        toast.success('Batches refreshed successfully')
      } else {
        setBatchesError(result.error || 'Failed to refresh batches')
        toast.error('Failed to refresh batches')
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      setBatchesError(errorMessage)
      toast.error('Failed to refresh batches')
    } finally {
      setBatchesLoading(false)
    }
  }, [setBatches, setBatchesError, setBatchesLoading])

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
    onMutate: () => {
      setBatchesLoading(true, 'Creating batch...')
    },
    onSuccess: (newBatch) => {
      addBatch({
        id: newBatch.id,
        name: newBatch.name,
        startDate: newBatch.startDate?.toISOString() ?? null,
        studentCount: 0,
      })
      toast.success('Batch created successfully')
      refreshBatches()
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create batch'
      )
    },
    onSettled: () => {
      setBatchesLoading(false)
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
    onMutate: () => {
      setBatchesLoading(true, 'Updating batch...')
    },
    onSuccess: ({ id, data }) => {
      updateBatch(id, {
        name: data.name,
        startDate: data.startDate?.toISOString() ?? null,
      })
      toast.success('Batch updated successfully')
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update batch'
      )
    },
    onSettled: () => {
      setBatchesLoading(false)
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
    onMutate: () => {
      setBatchesLoading(true, 'Deleting batch...')
    },
    onSuccess: (id) => {
      removeBatch(id)
      toast.success('Batch deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete batch'
      )
    },
    onSettled: () => {
      setBatchesLoading(false)
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
      refreshBatches()
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
      refreshBatches()
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

    // Actions
    refreshBatches,
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
