/**
 * Delete Family Dialog Component
 *
 * Extracted from dugsi-dashboard for better organization.
 * Uses Zustand store for state management.
 */

'use client'

import { useTransition } from 'react'

import { useRouter } from 'next/navigation'

import { Loader2 } from 'lucide-react'
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

import { Family } from '../../_types'
import { deleteDugsiFamily } from '../../actions'
import {
  useDeleteDialogState,
  useSelectedFamilies,
  useLegacyActions,
} from '../../store'

interface DeleteFamilyDialogProps {
  families: Family[]
}

export function DeleteFamilyDialog({ families }: DeleteFamilyDialogProps) {
  const router = useRouter()
  const isOpen = useDeleteDialogState()
  const selectedFamilyKeys = useSelectedFamilies()
  const { setDeleteDialogOpen, clearSelection } = useLegacyActions()
  const [isDeleting, startDeleteTransition] = useTransition()

  const handleDelete = async () => {
    if (selectedFamilyKeys.size === 0) return

    startDeleteTransition(async () => {
      const familyIds = Array.from(selectedFamilyKeys)
      let successCount = 0
      let errorCount = 0

      for (const familyKey of familyIds) {
        // Find the first student from this family to get the ID
        const family = families.find((f) => f.familyKey === familyKey)
        if (family && family.members.length > 0) {
          const result = await deleteDugsiFamily(family.members[0].id)
          if (result.success) {
            successCount++
          } else {
            errorCount++
            console.error(`Failed to delete family ${familyKey}:`, result.error)
          }
        }
      }

      if (successCount > 0) {
        toast.success(
          `Successfully deleted ${successCount} ${successCount === 1 ? 'family' : 'families'}`
        )
        clearSelection()
        router.refresh()
      }

      if (errorCount > 0) {
        toast.error(
          `Failed to delete ${errorCount} ${errorCount === 1 ? 'family' : 'families'}`
        )
      }

      setDeleteDialogOpen(false)
    })
  }

  const selectedFamilies = Array.from(selectedFamilyKeys)
    .map((key) => families.find((f) => f.familyKey === key))
    .filter((f): f is Family => f !== undefined)

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => setDeleteDialogOpen(open)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {selectedFamilyKeys.size}{' '}
            {selectedFamilyKeys.size === 1 ? 'Family' : 'Families'}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action will permanently delete the selected{' '}
            {selectedFamilyKeys.size === 1 ? 'family' : 'families'} including:
          </AlertDialogDescription>
          <div className="space-y-2 pt-2">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>All student records</li>
              <li>Parent information</li>
              <li>Payment history</li>
              <li>Subscription data</li>
            </ul>
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
              <p className="text-sm font-semibold text-destructive">
                Warning: This action cannot be undone!
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedFamilies
                  .map(
                    (family) =>
                      `${family.members.length} student(s) from ${family.parentEmail || 'family'}`
                  )
                  .join(', ')}
              </p>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleDelete()
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              `Delete ${selectedFamilyKeys.size} ${selectedFamilyKeys.size === 1 ? 'Family' : 'Families'}`
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
