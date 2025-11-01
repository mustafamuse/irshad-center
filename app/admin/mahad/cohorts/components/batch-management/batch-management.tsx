'use client'

import { UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { BatchWithCount, BatchStudentData } from '@/lib/types/batch'

import { BatchGrid } from './batch-grid'
import { CreateBatchDialog } from './create-batch-dialog'
import { DeleteStudentSheet } from './delete-student-sheet'
import { useLegacyActions } from '../../store/ui-store'
import { AssignStudentsForm } from '../forms'

interface BatchManagementProps {
  batches: BatchWithCount[]
  students: BatchStudentData[]
}

export function BatchManagement({ batches, students }: BatchManagementProps) {
  const { setAssignStudentsDialogOpen } = useLegacyActions()

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Cohort Management
        </h2>
        <p className="text-sm text-muted-foreground">
          Create and manage student cohorts
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
        <CreateBatchDialog>
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            Create Cohort
          </Button>
        </CreateBatchDialog>

        <AssignStudentsForm batches={batches} students={students}>
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => setAssignStudentsDialogOpen(true)}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Assign Students</span>
            <span className="sm:hidden">Assign</span>
          </Button>
        </AssignStudentsForm>

        <DeleteStudentSheet students={students} />
      </div>

      <BatchGrid batches={batches} />
    </div>
  )
}
