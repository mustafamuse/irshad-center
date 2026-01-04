'use client'

import { useTransition } from 'react'

import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'

import { toast } from '@/components/toast'
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

import type { TeacherCheckinWithRelations } from '../_types'
import { deleteCheckinAction } from '../actions'

interface DeleteCheckinDialogProps {
  checkin: TeacherCheckinWithRelations | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteCheckinDialog({
  checkin,
  open,
  onOpenChange,
}: DeleteCheckinDialogProps) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (!checkin) return

    startTransition(async () => {
      const result = await deleteCheckinAction(checkin.id)

      if (result.success) {
        toast.success('Success', { description: result.message })
        onOpenChange(false)
      } else {
        toast.error('Error', { description: result.error })
      }
    })
  }

  if (!checkin) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Check-in Record</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this check-in record for{' '}
            <strong>{checkin.teacher.person.name}</strong> on{' '}
            {format(new Date(checkin.date), 'MMMM d, yyyy')} ({checkin.shift}{' '}
            shift)?
            <br />
            <br />
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
