'use client'

import { useEffect, useState, useTransition } from 'react'

import { AlertTriangle, GraduationCap, Trash2, Users } from 'lucide-react'
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
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

import type { ClassWithDetails } from '../../_types'
import { deleteClassAction, getClassDeletePreviewAction } from '../../actions'

interface DeleteClassDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  classData: ClassWithDetails | null
  onSuccess?: () => void
}

interface DeletePreview {
  teacherCount: number
  studentCount: number
}

export function DeleteClassDialog({
  open,
  onOpenChange,
  classData,
  onSuccess,
}: DeleteClassDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [preview, setPreview] = useState<DeletePreview | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  useEffect(() => {
    if (open && classData && !preview) {
      setIsLoadingPreview(true)
      getClassDeletePreviewAction({ classId: classData.id })
        .then((result) => {
          if (result.success && result.data) {
            setPreview(result.data)
          } else {
            setPreview({ teacherCount: 0, studentCount: 0 })
          }
        })
        .catch(() => {
          setPreview({ teacherCount: 0, studentCount: 0 })
        })
        .finally(() => {
          setIsLoadingPreview(false)
        })
    }
  }, [open, classData, preview])

  useEffect(() => {
    if (!open) {
      setPreview(null)
    }
  }, [open])

  const handleDelete = async () => {
    if (!classData) return

    startTransition(async () => {
      const result = await deleteClassAction({ classId: classData.id })
      if (result.success) {
        toast.success(result.message || 'Class deleted successfully')
        onOpenChange(false)
        onSuccess?.()
      } else {
        toast.error(result.error || 'Failed to delete class')
      }
    })
  }

  if (!classData) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            Delete Class
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete{' '}
                <strong>{classData.name}</strong> ({classData.shift})?
              </p>

              <div className="min-h-[60px]">
                {isLoadingPreview && (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                )}

                {!isLoadingPreview && preview && (
                  <div className="space-y-2">
                    {(preview.teacherCount > 0 || preview.studentCount > 0) && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-amber-800">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium">Warning:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {preview.teacherCount > 0 && (
                            <Badge
                              variant="outline"
                              className="border-amber-500 text-amber-700"
                            >
                              <GraduationCap className="mr-1 h-3 w-3" />
                              {preview.teacherCount}{' '}
                              {preview.teacherCount === 1
                                ? 'teacher'
                                : 'teachers'}{' '}
                              will be unassigned
                            </Badge>
                          )}
                          {preview.studentCount > 0 && (
                            <Badge
                              variant="outline"
                              className="border-amber-500 text-amber-700"
                            >
                              <Users className="mr-1 h-3 w-3" />
                              {preview.studentCount}{' '}
                              {preview.studentCount === 1
                                ? 'student'
                                : 'students'}{' '}
                              will be removed
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {preview.teacherCount === 0 &&
                      preview.studentCount === 0 && (
                        <p className="text-sm text-muted-foreground">
                          This class has no teachers or students assigned.
                        </p>
                      )}
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
            disabled={isPending || isLoadingPreview}
            className="bg-red-600 hover:bg-red-700"
          >
            {isPending ? 'Deleting...' : 'Delete Class'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
