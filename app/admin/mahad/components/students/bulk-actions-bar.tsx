'use client'

import { useEffect, useState } from 'react'

import * as Sentry from '@sentry/nextjs'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Loader2,
  X,
  GraduationCap,
  Download,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
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
import type { BulkDeleteWarnings } from '@/lib/db/queries/student'

import {
  assignStudentsAction,
  bulkDeleteStudentsAction,
  getBulkDeleteWarningsAction,
} from '../../_actions'
import { MahadBatch, MahadStudent } from '../../_types'
import { useMahadUIStore } from '../../store'

interface BulkActionsBarProps {
  selectedStudents: MahadStudent[]
  batches: MahadBatch[]
}

function pluralizeStudent(count: number): string {
  return count === 1 ? 'student' : 'students'
}

function captureError(
  error: unknown,
  operation: string,
  context: { studentCount: number; studentIds: string[] }
): void {
  Sentry.captureException(error, {
    tags: { component: 'BulkActionsBar', operation },
    extra: context,
  })
}

function getErrorDescription(error: unknown): string {
  return error instanceof Error ? error.message : 'An error occurred'
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
  const [deleteWarnings, setDeleteWarnings] =
    useState<BulkDeleteWarnings | null>(null)
  const clearSelection = useMahadUIStore((state) => state.clearSelected)

  const selectedCount = selectedStudents.length
  const studentIds = selectedStudents.map((s) => s.id)

  const studentIdsKey = studentIds.join(',')
  useEffect(() => {
    if (!deleteDialogOpen || studentIds.length === 0) {
      setDeleteWarnings(null)
      return
    }

    let cancelled = false
    getBulkDeleteWarningsAction(studentIds)
      .then((result) => {
        if (cancelled) return
        if (result.success && result.data) {
          setDeleteWarnings(result.data)
        } else {
          toast.error('Failed to load deletion warnings')
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Failed to load deletion warnings')
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteDialogOpen, studentIdsKey])

  async function handleBulkAssign(): Promise<void> {
    if (!selectedBatchId) {
      toast.error('Please select a batch')
      return
    }

    setIsAssigning(true)

    try {
      const result = await assignStudentsAction(selectedBatchId, studentIds)

      if (result.success && result.data) {
        const { assignedCount, failedAssignments } = result.data
        const message = `${failedAssignments.length > 0 ? 'Assigned' : 'Successfully assigned'} ${assignedCount} ${pluralizeStudent(assignedCount)}`

        if (failedAssignments.length > 0) {
          toast.warning(`${message}. ${failedAssignments.length} failed.`)
        } else {
          toast.success(message)
        }

        clearSelection()
        setAssignDialogOpen(false)
        setSelectedBatchId('')
      } else {
        toast.error(result.error || 'Failed to assign students')
      }
    } catch (error) {
      captureError(error, 'bulkAssign', {
        studentCount: selectedCount,
        studentIds,
      })
      toast.error('Failed to assign students', {
        description: getErrorDescription(error),
      })
    } finally {
      setIsAssigning(false)
    }
  }

  async function handleBulkDelete(): Promise<void> {
    setIsDeleting(true)

    try {
      const result = await bulkDeleteStudentsAction(studentIds)

      if (result.success && result.data) {
        const { deletedCount, failedDeletes } = result.data
        const message = `${failedDeletes.length > 0 ? 'Deleted' : 'Successfully deleted'} ${deletedCount} ${pluralizeStudent(deletedCount)}`

        if (failedDeletes.length > 0) {
          toast.warning(`${message}. ${failedDeletes.length} failed.`)
        } else {
          toast.success(message)
        }

        clearSelection()
        setDeleteDialogOpen(false)
      } else {
        toast.error(result.error || 'Failed to delete students')
      }
    } catch (error) {
      captureError(error, 'bulkDelete', {
        studentCount: selectedCount,
        studentIds,
      })
      toast.error('Failed to delete students', {
        description: getErrorDescription(error),
      })
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleBulkExport(): Promise<void> {
    setIsExporting(true)

    try {
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
        `Exported ${selectedCount} ${pluralizeStudent(selectedCount)}`,
        {
          icon: <CheckCircle2 className="h-4 w-4" />,
        }
      )

      clearSelection()
    } catch (error) {
      captureError(error, 'bulkExport', {
        studentCount: selectedCount,
        studentIds,
      })
      toast.error('Failed to export students', {
        description: getErrorDescription(error),
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
                  {selectedCount} {pluralizeStudent(selectedCount)} selected
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

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Students to Batch</DialogTitle>
            <DialogDescription>
              Assign {selectedCount} selected {pluralizeStudent(selectedCount)}{' '}
              to a batch.
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
                  Assign {selectedCount} {pluralizeStudent(selectedCount)}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete Students</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedCount} selected{' '}
              {pluralizeStudent(selectedCount)}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteWarnings &&
            (deleteWarnings.studentsWithSiblings > 0 ||
              deleteWarnings.studentsWithAttendance > 0 ||
              deleteWarnings.studentsWithActiveSubscription > 0 ||
              deleteWarnings.studentsWithPaymentHistory > 0) && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="space-y-1">
                  {deleteWarnings.studentsWithSiblings > 0 && (
                    <p>
                      {deleteWarnings.studentsWithSiblings}{' '}
                      {pluralizeStudent(deleteWarnings.studentsWithSiblings)}{' '}
                      have sibling relationships that will be removed.
                    </p>
                  )}
                  {deleteWarnings.studentsWithAttendance > 0 && (
                    <p>
                      {deleteWarnings.studentsWithAttendance}{' '}
                      {pluralizeStudent(deleteWarnings.studentsWithAttendance)}{' '}
                      have attendance records that will be deleted.
                    </p>
                  )}
                  {deleteWarnings.studentsWithActiveSubscription > 0 && (
                    <p>
                      {deleteWarnings.studentsWithActiveSubscription}{' '}
                      {pluralizeStudent(
                        deleteWarnings.studentsWithActiveSubscription
                      )}{' '}
                      have active subscriptions.
                    </p>
                  )}
                  {deleteWarnings.studentsWithPaymentHistory > 0 && (
                    <p>
                      {deleteWarnings.studentsWithPaymentHistory}{' '}
                      {pluralizeStudent(
                        deleteWarnings.studentsWithPaymentHistory
                      )}{' '}
                      have payment history that will be deleted.
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

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
                  Delete {selectedCount} {pluralizeStudent(selectedCount)}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
