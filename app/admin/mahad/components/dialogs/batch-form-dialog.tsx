'use client'

import { useState, useTransition, useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { format } from 'date-fns'
import { Loader2, Plus, Save } from 'lucide-react'
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

import { createBatchAction, updateBatchAction } from '../../_actions'
import { useDialog, useMahadUIStore } from '../../store'

function formatDateForInput(date: Date | null): string {
  if (!date) return ''
  return format(date, 'yyyy-MM-dd')
}

export function BatchFormDialog() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const dialog = useDialog()
  const closeDialog = useMahadUIStore((s) => s.closeDialog)

  const isEditMode = dialog.type === 'editBatch'
  const isOpen = dialog.type === 'createBatch' || dialog.type === 'editBatch'
  const dialogData = dialog.type === 'editBatch' ? dialog.data : null

  useEffect(() => {
    if (isEditMode && dialogData) {
      setName(dialogData.name)
      setStartDate(formatDateForInput(dialogData.startDate))
      setEndDate(formatDateForInput(dialogData.endDate))
    }
  }, [isEditMode, dialogData])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeDialog()
      setName('')
      setStartDate('')
      setEndDate('')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Batch name is required')
      return
    }

    startTransition(async () => {
      if (isEditMode && dialogData) {
        const result = await updateBatchAction(dialogData.id, {
          name: name.trim(),
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
        })

        if (result.success) {
          toast.success(`Batch "${name}" updated successfully`)
          handleOpenChange(false)
          router.refresh()
        } else {
          toast.error(result.error || 'Failed to update batch')
        }
      } else {
        const formData = new FormData()
        formData.set('name', name.trim())
        if (startDate) {
          formData.set('startDate', startDate)
        }
        if (endDate) {
          formData.set('endDate', endDate)
        }

        const result = await createBatchAction(formData)

        if (result.success) {
          toast.success(`Batch "${name}" created successfully`)
          handleOpenChange(false)
          router.refresh()
        } else {
          toast.error(result.error || 'Failed to create batch')
        }
      }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? 'Edit Batch' : 'Create New Batch'}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? 'Update the batch name and dates.'
                : 'Create a new batch to organize students into cohorts.'}
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

            <div className="space-y-2">
              <Label htmlFor="end-date">End Date (optional)</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
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
                  {isEditMode ? 'Saving...' : 'Creating...'}
                </>
              ) : isEditMode ? (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
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

export { BatchFormDialog as CreateBatchDialog }
