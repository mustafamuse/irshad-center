'use client'

import { useEffect, useState, useTransition } from 'react'

import { AlertTriangle, UserX } from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BatchStudentData } from '@/lib/types/batch'

import {
  bulkDeleteStudentsAction,
  getStudentDeleteWarningsAction,
} from '../../_actions'
import { useLegacyActions, useSelectedStudents } from '../../_store/ui-store'

interface DeleteStudentSheetProps {
  students: BatchStudentData[]
}

interface AggregateWarnings {
  studentsWithSiblings: number
  studentsWithAttendance: number
}

export function DeleteStudentSheet({ students }: DeleteStudentSheetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [warnings, setWarnings] = useState<AggregateWarnings | null>(null)
  const [isLoadingWarnings, setIsLoadingWarnings] = useState(false)

  const selectedStudentIds = useSelectedStudents()
  const { clearSelection } = useLegacyActions()

  const selectedCount = selectedStudentIds.size
  const isDisabled = selectedCount === 0

  // Get selected students data
  const selectedStudents = students.filter((s) => selectedStudentIds.has(s.id))

  // Fetch warnings when dialog opens
  useEffect(() => {
    if (isOpen && selectedCount > 0 && !warnings) {
      setIsLoadingWarnings(true)

      const studentIds = Array.from(selectedStudentIds)
      Promise.all(studentIds.map((id) => getStudentDeleteWarningsAction(id)))
        .then((results) => {
          const aggregate = results.reduce(
            (acc, result) => ({
              studentsWithSiblings:
                acc.studentsWithSiblings + (result.data.hasSiblings ? 1 : 0),
              studentsWithAttendance:
                acc.studentsWithAttendance +
                (result.data.hasAttendanceRecords ? 1 : 0),
            }),
            { studentsWithSiblings: 0, studentsWithAttendance: 0 }
          )
          setWarnings(aggregate)
        })
        .catch((error) => {
          console.error('Failed to fetch delete warnings:', error)
          setWarnings({ studentsWithSiblings: 0, studentsWithAttendance: 0 })
        })
        .finally(() => {
          setIsLoadingWarnings(false)
        })
    }
  }, [isOpen, selectedCount, selectedStudentIds, warnings])

  // Reset warnings when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setWarnings(null)
    }
  }, [isOpen])

  const handleDelete = async () => {
    const studentIds = Array.from(selectedStudentIds)

    startTransition(async () => {
      const result = await bulkDeleteStudentsAction(studentIds)
      if (result.success && result.data) {
        const { deletedCount, failedDeletes } = result.data

        if (failedDeletes.length > 0) {
          toast.warning(
            `Deleted ${deletedCount} students, but ${failedDeletes.length} failed`
          )
        } else {
          toast.success(
            `Successfully deleted ${deletedCount} student${deletedCount !== 1 ? 's' : ''}`
          )
        }

        clearSelection()
        setIsOpen(false)
      } else {
        toast.error(result.error || 'Failed to delete students')
      }
    })
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          disabled={isDisabled}
        >
          <UserX className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">
            Delete Student{selectedCount !== 1 ? 's' : ''}
          </span>
          <span className="sm:hidden">Delete</span>
          {selectedCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {selectedCount}
            </Badge>
          )}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-red-500" />
            Delete {selectedCount} Student{selectedCount !== 1 ? 's' : ''}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete {selectedCount} student
                {selectedCount !== 1 ? 's' : ''}?
              </p>

              {selectedCount <= 5 && (
                <div className="rounded-md bg-muted p-2">
                  <ul className="list-inside list-disc text-sm">
                    {selectedStudents.map((student) => (
                      <li key={student.id}>{student.name}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Reserve space for warnings to prevent layout shift */}
              <div className="min-h-[60px]">
                {isLoadingWarnings && (
                  <p className="text-sm text-muted-foreground">
                    Checking for dependencies...
                  </p>
                )}

                {!isLoadingWarnings &&
                  warnings &&
                  (warnings.studentsWithSiblings > 0 ||
                    warnings.studentsWithAttendance > 0) && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-amber-800">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium">Warnings:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {warnings.studentsWithSiblings > 0 && (
                          <Badge
                            variant="outline"
                            className="border-amber-500 text-amber-700"
                          >
                            {warnings.studentsWithSiblings} with sibling
                            relationships
                          </Badge>
                        )}
                        {warnings.studentsWithAttendance > 0 && (
                          <Badge
                            variant="outline"
                            className="border-amber-500 text-amber-700"
                          >
                            {warnings.studentsWithAttendance} with attendance
                            records
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
              </div>

              <p className="text-sm font-medium text-red-600">
                This action cannot be undone.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending || isLoadingWarnings}
            className="bg-red-600 hover:bg-red-700"
          >
            {isPending
              ? 'Deleting...'
              : `Delete ${selectedCount} Student${selectedCount !== 1 ? 's' : ''}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
