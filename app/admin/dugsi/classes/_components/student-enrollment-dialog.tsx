'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'

import { useRouter } from 'next/navigation'

import { Check, Loader2, UserMinus, UserPlus, Users } from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'

import type { ClassWithDetails, StudentForEnrollment } from '../../_types'
import {
  bulkEnrollStudentsAction,
  getAvailableStudentsForClassAction,
  removeStudentFromClassAction,
} from '../../actions'

interface StudentEnrollmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  classData: ClassWithDetails | null
}

export function StudentEnrollmentDialog({
  open,
  onOpenChange,
  classData,
}: StudentEnrollmentDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(false)
  const [students, setStudents] = useState<StudentForEnrollment[]>([])
  const [selectedToEnroll, setSelectedToEnroll] = useState<Set<string>>(
    new Set()
  )
  const [selectedToRemove, setSelectedToRemove] = useState<Set<string>>(
    new Set()
  )

  const availableStudents = useMemo(
    () =>
      students.filter(
        (s) => !s.isEnrolledInClass || s.currentClassName !== classData?.name
      ),
    [students, classData?.name]
  )

  const enrolledStudents = useMemo(
    () => students.filter((s) => s.currentClassName === classData?.name),
    [students, classData?.name]
  )

  useEffect(() => {
    if (open && classData) {
      setIsLoading(true)
      getAvailableStudentsForClassAction({ shift: classData.shift })
        .then((result) => {
          if (result.success && result.data) {
            setStudents(result.data)
          } else {
            setStudents([])
            toast.error('Failed to load students')
          }
        })
        .catch(() => {
          setStudents([])
          toast.error('Failed to load students')
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }, [open, classData])

  useEffect(() => {
    if (!open) {
      setStudents([])
      setSelectedToEnroll(new Set())
      setSelectedToRemove(new Set())
    }
  }, [open])

  const handleClose = () => {
    if (isPending) return
    onOpenChange(false)
  }

  const toggleEnroll = (id: string) => {
    setSelectedToEnroll((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleRemove = (id: string) => {
    setSelectedToRemove((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleAllEnroll = () => {
    if (selectedToEnroll.size === availableStudents.length) {
      setSelectedToEnroll(new Set())
    } else {
      setSelectedToEnroll(new Set(availableStudents.map((s) => s.id)))
    }
  }

  const toggleAllRemove = () => {
    if (selectedToRemove.size === enrolledStudents.length) {
      setSelectedToRemove(new Set())
    } else {
      setSelectedToRemove(new Set(enrolledStudents.map((s) => s.id)))
    }
  }

  const handleEnroll = () => {
    if (!classData || selectedToEnroll.size === 0) return

    startTransition(async () => {
      const result = await bulkEnrollStudentsAction({
        classId: classData.id,
        programProfileIds: Array.from(selectedToEnroll),
      })

      if (result.success && result.data) {
        const { enrolled, moved } = result.data
        if (moved > 0) {
          toast.success(
            `Enrolled ${enrolled} student${enrolled !== 1 ? 's' : ''} (${moved} moved from other classes)`
          )
        } else {
          toast.success(
            `Successfully enrolled ${enrolled} student${enrolled !== 1 ? 's' : ''}`
          )
        }
        setSelectedToEnroll(new Set())
        router.refresh()
        const refreshResult = await getAvailableStudentsForClassAction({
          shift: classData.shift,
        })
        if (refreshResult.success && refreshResult.data) {
          setStudents(refreshResult.data)
        }
      } else {
        toast.error(result.error || 'Failed to enroll students')
      }
    })
  }

  const handleRemove = () => {
    if (selectedToRemove.size === 0) return

    startTransition(async () => {
      const idsToRemove = Array.from(selectedToRemove)

      const results = await Promise.allSettled(
        idsToRemove.map((id) =>
          removeStudentFromClassAction({ programProfileId: id })
        )
      )

      const successCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value.success
      ).length
      const failCount = results.length - successCount

      if (failCount > 0) {
        toast.warning(
          `Removed ${successCount} student${successCount !== 1 ? 's' : ''}. ${failCount} failed.`
        )
      } else {
        toast.success(
          `Successfully removed ${successCount} student${successCount !== 1 ? 's' : ''}`
        )
      }

      setSelectedToRemove(new Set())
      router.refresh()

      if (classData) {
        const refreshResult = await getAvailableStudentsForClassAction({
          shift: classData.shift,
        })
        if (refreshResult.success && refreshResult.data) {
          setStudents(refreshResult.data)
        }
      }
    })
  }

  if (!classData) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Manage Students - {classData.name}
          </DialogTitle>
          <DialogDescription>
            Enroll or remove students from this {classData.shift.toLowerCase()}{' '}
            class.
          </DialogDescription>
        </DialogHeader>

        <div className="grid items-start gap-6 py-4 md:grid-cols-2 md:gap-4">
          <div className="space-y-2">
            <div className="flex h-9 items-center justify-between">
              <Label className="text-sm font-medium">
                Available Students ({selectedToEnroll.size}/
                {availableStudents.length})
              </Label>
              {availableStudents.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={toggleAllEnroll}
                  disabled={isPending}
                >
                  {selectedToEnroll.size === availableStudents.length
                    ? 'Deselect All'
                    : 'Select All'}
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-2 rounded-md border p-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : availableStudents.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Check className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  All {classData.shift.toLowerCase()} students are enrolled
                </p>
              </div>
            ) : (
              <ScrollArea className="h-48 rounded-md border sm:h-64">
                <div className="space-y-1 p-2">
                  {availableStudents.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`enroll-${student.id}`}
                        checked={selectedToEnroll.has(student.id)}
                        onCheckedChange={() => toggleEnroll(student.id)}
                        disabled={isPending}
                      />
                      <label
                        htmlFor={`enroll-${student.id}`}
                        className="min-w-0 flex-1 cursor-pointer text-sm"
                      >
                        <span className="block truncate font-medium">
                          {student.name}
                        </span>
                        {student.currentClassName && (
                          <span className="block truncate text-xs text-muted-foreground">
                            Currently in: {student.currentClassName}
                          </span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <Button
              onClick={handleEnroll}
              disabled={isPending || selectedToEnroll.size === 0}
              className="w-full"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enrolling...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Enroll {selectedToEnroll.size} Student
                  {selectedToEnroll.size !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex h-9 items-center justify-between">
              <Label className="text-sm font-medium">
                Enrolled Students ({selectedToRemove.size}/
                {enrolledStudents.length})
              </Label>
              {enrolledStudents.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={toggleAllRemove}
                  disabled={isPending}
                >
                  {selectedToRemove.size === enrolledStudents.length
                    ? 'Deselect All'
                    : 'Select All'}
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-2 rounded-md border p-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : enrolledStudents.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No students enrolled yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="md:hidden">
                    Select students above to enroll
                  </span>
                  <span className="hidden md:inline">
                    Select students from the left to enroll
                  </span>
                </p>
              </div>
            ) : (
              <ScrollArea className="h-48 rounded-md border sm:h-64">
                <div className="space-y-1 p-2">
                  {enrolledStudents.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`remove-${student.id}`}
                        checked={selectedToRemove.has(student.id)}
                        onCheckedChange={() => toggleRemove(student.id)}
                        disabled={isPending}
                      />
                      <label
                        htmlFor={`remove-${student.id}`}
                        className="min-w-0 flex-1 cursor-pointer text-sm"
                      >
                        <span className="block truncate font-medium">
                          {student.name}
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <Button
              variant="outline"
              onClick={handleRemove}
              disabled={isPending || selectedToRemove.size === 0}
              className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <UserMinus className="mr-2 h-4 w-4" />
                  Remove {selectedToRemove.size} Student
                  {selectedToRemove.size !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
