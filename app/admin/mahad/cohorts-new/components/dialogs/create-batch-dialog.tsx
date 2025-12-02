'use client'

import { useState, useTransition } from 'react'

import { useRouter } from 'next/navigation'

import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { createBatchAction } from '../../../cohorts/_actions'
import { useDialogState, useMahadUIStore } from '../../store'

/**
 * Dialog for creating new batches in the Mahad program.
 *
 * Features:
 * - Batch name (required) with validation
 * - Optional start date picker
 * - Loading state with spinner during creation
 * - Auto-reset on close
 * - Toast notifications for success/error
 *
 * Opens when `openDialog === 'createBatch'` in the Zustand store.
 *
 * @example
 * // Trigger from dashboard header
 * openDialogWithData('createBatch')
 *
 * // Render in parent component
 * <CreateBatchDialog />
 */
export function CreateBatchDialog() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')

  const openDialog = useDialogState()
  const closeDialog = useMahadUIStore((s) => s.closeDialog)

  const isOpen = openDialog === 'createBatch'

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeDialog()
      setName('')
      setStartDate('')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Batch name is required')
      return
    }

    const formData = new FormData()
    formData.set('name', name.trim())
    if (startDate) {
      formData.set('startDate', startDate)
    }

    startTransition(async () => {
      const result = await createBatchAction(formData)

      if (result.success) {
        toast.success(`Batch "${name}" created successfully`)
        handleOpenChange(false)
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to create batch')
      }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Batch</DialogTitle>
            <DialogDescription>
              Create a new batch to organize students into cohorts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="batch-name">
                Batch Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="batch-name"
                placeholder="e.g., Fall 2024, Beginners Group"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date (optional)</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isPending}
              />
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
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Batch
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
