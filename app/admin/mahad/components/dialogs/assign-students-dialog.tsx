'use client'

import { useState, useTransition, useMemo } from 'react'

import { useRouter } from 'next/navigation'

import { Loader2, UserPlus, Check } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { assignStudentsAction } from '../../_actions'
import { MahadBatch, MahadStudent } from '../../_types'
import { useDialogState, useMahadUIStore } from '../../store'

/**
 * Props for AssignStudentsDialog component.
 */
interface AssignStudentsDialogProps {
  /** All students in the system (assigned and unassigned) */
  students: MahadStudent[]
  /** Available batches to assign students to */
  batches: MahadBatch[]
}

/**
 * Dialog for bulk-assigning unassigned students to a batch.
 *
 * Features:
 * - Shows only students without a batch assignment
 * - Multi-select with checkboxes
 * - Select all / deselect all toggle
 * - Batch dropdown selector showing student counts
 * - Dynamic submit button text showing selection count and target batch
 * - Handles partial success (some assignments fail)
 * - Scrollable student list for large datasets
 * - Empty state when all students are already assigned
 *
 * Opens when `openDialog === 'assignStudents'` in the Zustand store.
 *
 * @example
 * // Trigger from dashboard header
 * openDialogWithData('assignStudents')
 *
 * // Render in parent component with data
 * <AssignStudentsDialog students={allStudents} batches={availableBatches} />
 */
export function AssignStudentsDialog({
  students,
  batches,
}: AssignStudentsDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedBatchId, setSelectedBatchId] = useState<string>('')
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    new Set()
  )

  const openDialog = useDialogState()
  const closeDialog = useMahadUIStore((s) => s.closeDialog)

  const isOpen = openDialog === 'assignStudents'

  const unassignedStudents = useMemo(
    () => students.filter((s) => !s.batchId),
    [students]
  )

  const handleOpenChange = (open: boolean) => {
    if (!open && isPending) return
    if (!open) {
      closeDialog()
      setSelectedBatchId('')
      setSelectedStudentIds(new Set())
    }
  }

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selectedStudentIds.size === unassignedStudents.length) {
      setSelectedStudentIds(new Set())
    } else {
      setSelectedStudentIds(new Set(unassignedStudents.map((s) => s.id)))
    }
  }

  const handleSubmit = () => {
    if (!selectedBatchId) {
      toast.error('Please select a batch')
      return
    }

    if (selectedStudentIds.size === 0) {
      toast.error('Please select at least one student')
      return
    }

    startTransition(async () => {
      const result = await assignStudentsAction(
        selectedBatchId,
        Array.from(selectedStudentIds)
      )

      if (result.success && result.data) {
        const { assignedCount, failedAssignments } = result.data
        if (failedAssignments.length > 0) {
          toast.warning(
            `Assigned ${assignedCount} student${assignedCount !== 1 ? 's' : ''}. ${failedAssignments.length} failed.`
          )
        } else {
          toast.success(
            `Successfully assigned ${assignedCount} student${assignedCount !== 1 ? 's' : ''}`
          )
        }
        handleOpenChange(false)
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to assign students')
      }
    })
  }

  const selectedBatch = batches.find((b) => b.id === selectedBatchId)

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Students to Batch</DialogTitle>
          <DialogDescription>
            Select students to assign to a batch. Only unassigned students are
            shown.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="target-batch">Target Batch</Label>
            <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
              <SelectTrigger id="target-batch">
                <SelectValue placeholder="Select a batch" />
              </SelectTrigger>
              <SelectContent>
                {batches.map((batch) => (
                  <SelectItem key={batch.id} value={batch.id}>
                    {batch.name} ({batch.studentCount} students)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Select Students ({selectedStudentIds.size} of{' '}
                {unassignedStudents.length})
              </Label>
              {unassignedStudents.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={toggleAll}
                >
                  {selectedStudentIds.size === unassignedStudents.length
                    ? 'Deselect All'
                    : 'Select All'}
                </Button>
              )}
            </div>

            {unassignedStudents.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Check className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  All students are already assigned to batches
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  New enrollments will appear here automatically
                </p>
              </div>
            ) : (
              <ScrollArea className="h-64 rounded-md border">
                <div className="space-y-2 p-4">
                  {unassignedStudents.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center space-x-3 rounded-md p-2 hover:bg-muted/50"
                    >
                      <Checkbox
                        id={student.id}
                        checked={selectedStudentIds.has(student.id)}
                        onCheckedChange={() => toggleStudent(student.id)}
                        disabled={isPending}
                        aria-label={`Select ${student.name}`}
                      />
                      <label
                        htmlFor={student.id}
                        className="min-w-0 flex-1 cursor-pointer text-sm"
                      >
                        <span className="block truncate font-medium">
                          {student.name}
                        </span>
                        {student.email && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {student.email}
                          </span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isPending || !selectedBatchId || selectedStudentIds.size === 0
            }
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Assign {selectedStudentIds.size} Student
                {selectedStudentIds.size !== 1 ? 's' : ''}
                {selectedBatch ? ` to ${selectedBatch.name}` : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
