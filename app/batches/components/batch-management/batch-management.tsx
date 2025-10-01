'use client'

import { UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { BatchGrid } from './batch-grid'
import { BatchHeader } from './batch-header'
import { CreateBatchDialog } from './create-batch-dialog'
import { DeleteStudentSheet } from './delete-student-sheet'
import { useBatches } from '../../hooks/use-batches'
import { useUIStore } from '../../store/ui-store'
import { AssignStudentsForm } from '../forms'

export function BatchManagement() {
  const { batches } = useBatches()
  const { setAssignDialogOpen } = useUIStore()

  return (
    <div className="space-y-4 sm:space-y-6">
      <BatchHeader />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
        <CreateBatchDialog>
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            Create Batch
          </Button>
        </CreateBatchDialog>

        <AssignStudentsForm>
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => setAssignDialogOpen(true)}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Assign Students</span>
            <span className="sm:hidden">Assign</span>
          </Button>
        </AssignStudentsForm>

        <DeleteStudentSheet />
      </div>

      <BatchGrid batches={batches} />
    </div>
  )
}
