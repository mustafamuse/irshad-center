'use client'

import { useTransition } from 'react'

import { ArrowRight, ArrowRightLeft } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { BatchWithCount } from '@/lib/types/batch'

import {
  assignStudentsAction,
  transferStudentsAction,
} from '../../actions'
import { useLegacyActions, useSelectedStudents } from '../../store/ui-store'

interface AssignmentActionsProps {
  mode: 'assign' | 'transfer'
  selectedBatch: string | null
  destinationBatchId: string | null
  canProceed: boolean
  onClose: () => void
  batches?: BatchWithCount[]
}

export function AssignmentActions({
  mode,
  selectedBatch,
  destinationBatchId,
  canProceed,
  onClose,
  batches: _batches,
}: AssignmentActionsProps) {
  const [isPending, startTransition] = useTransition()
  const selectedStudentIds = useSelectedStudents()
  const { clearSelection } = useLegacyActions()

  const handleAction = async () => {
    if (!canProceed) return

    const studentIds = Array.from(selectedStudentIds)

    startTransition(async () => {
      try {
        if (mode === 'assign' && selectedBatch) {
          const result = await assignStudentsAction(selectedBatch, studentIds)
          if (result.success) {
            toast.success(
              `Successfully assigned ${result.data?.assignedCount} students`
            )
            clearSelection()
            onClose()
          } else {
            toast.error(result.error || 'Failed to assign students')
          }
        } else if (mode === 'transfer' && selectedBatch && destinationBatchId) {
          const result = await transferStudentsAction(
            selectedBatch,
            destinationBatchId,
            studentIds
          )
          if (result.success) {
            toast.success(
              `Successfully transferred ${result.data?.transferredCount} students`
            )
            clearSelection()
            onClose()
          } else {
            toast.error(result.error || 'Failed to transfer students')
          }
        }
      } catch (error) {
        console.error('Assignment/Transfer failed:', error)
        toast.error('An unexpected error occurred')
      }
    })
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
        disabled={!canProceed || isPending}
        className="flex items-center gap-2"
      >
        {getActionIcon()}
        {getActionText()}
      </Button>

      <Button variant="outline" onClick={onClose} disabled={isPending}>
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
