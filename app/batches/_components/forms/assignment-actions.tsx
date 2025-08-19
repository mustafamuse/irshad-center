'use client'

import { ArrowRight, ArrowRightLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { useBatches } from '../../_hooks/use-batches'
import { useStudents } from '../../_hooks/use-students'

interface AssignmentActionsProps {
  mode: 'assign' | 'transfer'
  selectedBatch: string | null
  destinationBatchId: string | null
  canProceed: boolean
  onClose: () => void
}

export function AssignmentActions({
  mode,
  selectedBatch,
  destinationBatchId,
  canProceed,
  onClose,
}: AssignmentActionsProps) {
  const { assignStudents, transferStudents, isLoading } = useBatches()
  const { selectedStudentIds, clearSelection } = useStudents()

  const handleAction = async () => {
    if (!canProceed) return

    const studentIds = Array.from(selectedStudentIds)

    try {
      if (mode === 'assign' && selectedBatch) {
        await assignStudents({
          batchId: selectedBatch,
          studentIds,
        })
      } else if (mode === 'transfer' && selectedBatch && destinationBatchId) {
        await transferStudents({
          fromBatchId: selectedBatch,
          toBatchId: destinationBatchId,
          studentIds,
        })
      }

      // Success - close dialog and clear selection
      clearSelection()
      onClose()
    } catch (error) {
      // Error handling is done in the hooks
      console.error('Assignment/Transfer failed:', error)
    }
  }

  const getActionText = () => {
    const count = selectedStudentIds.size
    if (mode === 'assign') {
      return `Assign ${count} Student${count !== 1 ? 's' : ''}`
    } else {
      return `Transfer ${count} Student${count !== 1 ? 's' : ''}`
    }
  }

  const getActionIcon = () => {
    return mode === 'assign' ? (
      <ArrowRight className="h-4 w-4" />
    ) : (
      <ArrowRightLeft className="h-4 w-4" />
    )
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row-reverse">
      <Button
        onClick={handleAction}
        disabled={!canProceed || isLoading}
        className="flex items-center gap-2"
      >
        {getActionIcon()}
        {getActionText()}
      </Button>

      <Button variant="outline" onClick={onClose} disabled={isLoading}>
        Cancel
      </Button>

      {selectedStudentIds.size > 0 && (
        <div className="flex items-center text-sm text-muted-foreground sm:mr-auto">
          {selectedStudentIds.size} student
          {selectedStudentIds.size !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  )
}
