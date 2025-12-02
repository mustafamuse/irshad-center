'use client'

import { useState, useTransition } from 'react'

import { useRouter } from 'next/navigation'

import { AlertTriangle, CheckCircle2, Loader2, Trash2 } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'

import { resolveDuplicatesAction } from '../../../cohorts/_actions'
import { DuplicateGroup } from '../../_types'
import { useDialogState, useMahadUIStore } from '../../store'

interface ResolveDuplicatesDialogProps {
  group: DuplicateGroup | null
}

export function ResolveDuplicatesDialog({
  group,
}: ResolveDuplicatesDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mergeData, setMergeData] = useState(false)

  const openDialog = useDialogState()
  const closeDialog = useMahadUIStore((s) => s.closeDialog)

  const isOpen = openDialog === 'resolveDuplicates' && group !== null

  const handleOpenChange = (open: boolean) => {
    if (!open && isPending) return
    if (!open) {
      closeDialog()
      setMergeData(false)
    }
  }

  const handleResolve = () => {
    if (!group) return

    startTransition(async () => {
      const deleteIds = group.duplicateRecords.map((r) => r.id)
      const result = await resolveDuplicatesAction(
        group.keepRecord.id,
        deleteIds,
        mergeData
      )

      if (result.success) {
        toast.success(
          `Resolved ${deleteIds.length} duplicate${deleteIds.length !== 1 ? 's' : ''}`
        )
        handleOpenChange(false)
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to resolve duplicates')
      }
    })
  }

  if (!group) return null

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Resolve Duplicate Records
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Found {group.students.length} records with matching{' '}
                <Badge variant="outline" className="mx-1">
                  {group.matchType}
                </Badge>
                <span className="font-medium">{group.matchValue}</span>
              </p>

              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 dark:bg-green-950">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Keep: {group.keepRecord.name}
                    </p>
                    <p className="truncate text-xs text-green-600 dark:text-green-400">
                      {group.keepRecord.batch?.name || 'Unassigned'}
                      {group.keepRecord.subscription && ' (has subscription)'}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Will be deleted:
                  </p>
                  {group.duplicateRecords.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center gap-2 rounded-md bg-red-50 p-2 dark:bg-red-950"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-red-800 dark:text-red-200">
                          {record.name}
                        </p>
                        <p className="truncate text-xs text-red-600 dark:text-red-400">
                          {record.batch?.name || 'Unassigned'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-2">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="merge-data"
              checked={mergeData}
              onCheckedChange={(checked) => setMergeData(checked === true)}
              disabled={isPending}
              aria-label="Merge data from duplicates before deletion"
            />
            <div className="space-y-1">
              <label
                htmlFor="merge-data"
                className="cursor-pointer text-sm font-medium leading-none"
              >
                Merge data before deletion
              </label>
              <p className="text-xs text-muted-foreground">
                Copy any missing information from duplicate records to the kept
                record.
              </p>
            </div>
          </div>
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleResolve}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resolving...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete {group.duplicateRecords.length} Duplicate
                {group.duplicateRecords.length !== 1 ? 's' : ''}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
