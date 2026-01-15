'use client'

import { useState } from 'react'

import * as Sentry from '@sentry/nextjs'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, X, GraduationCap, Download, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { assignStudentsAction, bulkDeleteStudentsAction } from '../../_actions'
import { MahadBatch, MahadStudent } from '../../_types'
import { useMahadUIStore } from '../../store'

interface BulkActionsBarProps {
  selectedStudents: MahadStudent[]
  batches: MahadBatch[]
}

export function BulkActionsBar({
  selectedStudents,
  batches,
}: BulkActionsBarProps) {
  const [isAssigning, setIsAssigning] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedBatchId, setSelectedBatchId] = useState<string>('')
  const clearSelection = useMahadUIStore((state) => state.clearSelected)

  const selectedCount = selectedStudents.length

  const handleBulkAssign = async () => {
    if (!selectedBatchId) {
      toast.error('Please select a batch')
      return
    }

    setIsAssigning(true)

    try {
      const studentIds = selectedStudents.map((s) => s.id)
      const result = await assignStudentsAction(selectedBatchId, studentIds)

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

        clearSelection()
        setAssignDialogOpen(false)
        setSelectedBatchId('')
      } else {
        toast.error(result.error || 'Failed to assign students')
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'BulkActionsBar',
          operation: 'bulkAssign',
        },
        extra: { studentCount: selectedStudents.length },
      })
      toast.error('Failed to assign students', {
        description:
          error instanceof Error ? error.message : 'An error occurred',
      })
    } finally {
      setIsAssigning(false)
    }
  }

  const handleBulkDelete = async () => {
    setIsDeleting(true)

    try {
      const studentIds = selectedStudents.map((s) => s.id)
      const result = await bulkDeleteStudentsAction(studentIds)

      if (result.success && result.data) {
        const { deletedCount, failedDeletes } = result.data

        if (failedDeletes.length > 0) {
          toast.warning(
            `Deleted ${deletedCount} student${deletedCount !== 1 ? 's' : ''}. ${failedDeletes.length} failed.`
          )
        } else {
          toast.success(
            `Successfully deleted ${deletedCount} student${deletedCount !== 1 ? 's' : ''}`
          )
        }

        clearSelection()
        setDeleteDialogOpen(false)
      } else {
        toast.error(result.error || 'Failed to delete students')
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'BulkActionsBar',
          operation: 'bulkDelete',
        },
        extra: { studentCount: selectedStudents.length },
      })
      toast.error('Failed to delete students', {
        description:
          error instanceof Error ? error.message : 'An error occurred',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBulkExport = async () => {
    setIsExporting(true)

    try {
      // Convert selected students to CSV
      const headers = ['Name', 'Email', 'Phone', 'Batch', 'Status']
      const rows = selectedStudents.map((student) => [
        student.name,
        student.email || '',
        student.phone || '',
        student.batch?.name || 'Unassigned',
        student.status,
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `mahad-students-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(
        `Exported ${selectedCount} student${selectedCount !== 1 ? 's' : ''}`,
        {
          icon: <CheckCircle2 className="h-4 w-4" />,
        }
      )

      clearSelection()
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'BulkActionsBar',
          operation: 'bulkExport',
        },
        extra: { studentCount: selectedStudents.length },
      })
      toast.error('Failed to export students', {
        description:
          error instanceof Error ? error.message : 'An error occurred',
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="sticky bottom-4 z-50 mx-auto mt-4 w-fit"
          >
            <Card className="border-primary/20 bg-background/95 px-4 py-2 shadow-lg backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {selectedCount} {selectedCount === 1 ? 'student' : 'students'}{' '}
                  selected
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAssignDialogOpen(true)}
                    disabled={isAssigning || batches.length === 0}
                  >
                    <GraduationCap className="mr-2 h-4 w-4" />
                    Assign Batch
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkExport}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Export
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <X className="mr-2 h-4 w-4" />
                        Delete
                      </>
                    )}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearSelection}>
                    <X className="mr-1 h-4 w-4" />
                    Clear
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assign Batch Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Students to Batch</DialogTitle>
            <DialogDescription>
              Assign {selectedCount} selected student
              {selectedCount !== 1 ? 's' : ''} to a batch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
              <SelectTrigger>
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
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssignDialogOpen(false)
                setSelectedBatchId('')
              }}
              disabled={isAssigning}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkAssign}
              disabled={isAssigning || !selectedBatchId}
            >
              {isAssigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <GraduationCap className="mr-2 h-4 w-4" />
                  Assign {selectedCount} Student
                  {selectedCount !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete Students</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedCount} selected student
              {selectedCount !== 1 ? 's' : ''}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Delete {selectedCount} Student{selectedCount !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
