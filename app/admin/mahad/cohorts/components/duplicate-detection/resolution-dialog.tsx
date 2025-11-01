'use client'

import { useState, useTransition } from 'react'

import { AlertTriangle } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { DuplicateGroup } from '@/lib/types/batch'

import { resolveDuplicatesAction } from '../../actions'

interface ResolutionDialogProps {
  group: DuplicateGroup
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ResolutionDialog({
  group,
  open,
  onOpenChange,
}: ResolutionDialogProps) {
  const [mergeData, setMergeData] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleResolve = async () => {
    startTransition(async () => {
      const deleteIds = group.duplicateRecords.map((record) => record.id)
      const result = await resolveDuplicatesAction(
        group.keepRecord.id,
        deleteIds,
        mergeData
      )
      if (result.success) {
        toast.success('Duplicate students resolved successfully')
        onOpenChange(false)
      } else {
        toast.error(result.error || 'Failed to resolve duplicates')
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Resolve Duplicate Records
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                You are about to delete {group.duplicateRecords.length}{' '}
                duplicate records for <strong>{group.email}</strong>.
              </p>
              <p>
                The record for <strong>{group.keepRecord.name}</strong> will be
                kept.
              </p>
              {group.hasSiblingGroup && (
                <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">
                  ⚠️ This student has sibling relationships that may be
                  affected.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="merge-data"
              checked={mergeData}
              onCheckedChange={(checked) => setMergeData(checked === true)}
            />
            <label
              htmlFor="merge-data"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Merge data from duplicate records before deletion
            </label>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            This will copy any missing information from duplicate records to the
            kept record.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleResolve}
            disabled={isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {isPending ? 'Resolving...' : 'Delete Duplicates'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
