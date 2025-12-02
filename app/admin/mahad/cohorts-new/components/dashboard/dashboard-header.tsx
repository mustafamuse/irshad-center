'use client'

import { Plus, UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { useMahadUIStore } from '../../store'

export function DashboardHeader() {
  const openDialogWithData = useMahadUIStore((s) => s.openDialogWithData)

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Mahad Cohorts
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Manage students, batches, and enrollment
        </p>
      </div>

      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button
          variant="outline"
          onClick={() => openDialogWithData('assignStudents')}
          className="w-full sm:w-auto"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Assign Students
        </Button>
        <Button
          onClick={() => openDialogWithData('createBatch')}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Batch
        </Button>
      </div>
    </div>
  )
}
