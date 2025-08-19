'use client'

import { useState } from 'react'

import { UserPlus, ArrowRightLeft } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { AssignmentActions } from './assignment-actions'
import { BatchSelector } from './batch-selector'
import { StudentSelector } from './student-selector'
import { TransferProgress } from './transfer-progress'
import { useBatches } from '../../_hooks/use-batches'
import { useStudents } from '../../_hooks/use-students'
import { useBatchStore } from '../../_store/batch.store'

interface AssignStudentsFormProps {
  children?: React.ReactNode
}

export function AssignStudentsForm({ children }: AssignStudentsFormProps) {
  const [mode, setMode] = useState<'assign' | 'transfer'>('assign')
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)
  const [destinationBatchId, setDestinationBatchId] = useState<string | null>(
    null
  )

  const { isAssignDialogOpen, setAssignDialogOpen } = useBatchStore()
  const { batches, isLoading: batchesLoading } = useBatches()
  const { selectedStudentIds, clearSelection } = useStudents()

  const handleModeChange = (newMode: 'assign' | 'transfer') => {
    setMode(newMode)
    clearSelection()
    setSelectedBatch(null)
    setDestinationBatchId(null)
  }

  const handleClose = () => {
    setAssignDialogOpen(false)
    clearSelection()
    setSelectedBatch(null)
    setDestinationBatchId(null)
  }

  const canProceed = Boolean(
    selectedBatch &&
      selectedStudentIds.size > 0 &&
      (mode === 'assign' || destinationBatchId)
  )

  return (
    <Sheet open={isAssignDialogOpen} onOpenChange={setAssignDialogOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="w-full max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {mode === 'assign' ? 'Assign Students' : 'Transfer Students'}
          </SheetTitle>
          <SheetDescription>
            {mode === 'assign'
              ? 'Assign unassigned students to a batch'
              : 'Transfer students from one batch to another'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Mode Selector */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium">Operation Type</label>
            <Tabs
              value={mode}
              onValueChange={(value) =>
                handleModeChange(value as 'assign' | 'transfer')
              }
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="assign" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Assign
                </TabsTrigger>
                <TabsTrigger
                  value="transfer"
                  className="flex items-center gap-2"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Transfer
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Batch Selection */}
          <BatchSelector
            mode={mode}
            selectedBatch={selectedBatch}
            destinationBatchId={destinationBatchId}
            onSelectedBatchChange={setSelectedBatch}
            onDestinationBatchChange={setDestinationBatchId}
            batches={batches}
            isLoading={batchesLoading}
          />

          {/* Student Selection */}
          {selectedBatch && (
            <StudentSelector
              mode={mode}
              selectedBatch={selectedBatch}
              destinationBatchId={destinationBatchId}
            />
          )}

          {/* Transfer Progress */}
          <TransferProgress />

          {/* Action Buttons */}
          <AssignmentActions
            mode={mode}
            selectedBatch={selectedBatch}
            destinationBatchId={destinationBatchId}
            canProceed={canProceed}
            onClose={handleClose}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
