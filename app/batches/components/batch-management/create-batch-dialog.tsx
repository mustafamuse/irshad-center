'use client'

import { useState, useTransition } from 'react'

import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet'

import { createBatchAction } from '../../actions'
import { useLegacyActions, useCreateBatchDialogState } from '../../store/ui-store'

interface CreateBatchDialogProps {
  children?: React.ReactNode
}

export function CreateBatchDialog({ children }: CreateBatchDialogProps) {
  const [name, setName] = useState('')
  const [isPending, startTransition] = useTransition()
  const isCreateBatchDialogOpen = useCreateBatchDialogState()
  const { setCreateBatchDialogOpen } = useLegacyActions()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    startTransition(async () => {
      const formData = new FormData()
      formData.append('name', name.trim())

      const result = await createBatchAction(formData)
      if (result.success) {
        toast.success('Batch created successfully')
        setName('')
        setCreateBatchDialogOpen(false)
      } else {
        toast.error(result.error || 'Failed to create batch')
      }
    })
  }

  const handleClose = () => {
    setCreateBatchDialogOpen(false)
    setName('')
  }

  return (
    <Sheet
      open={isCreateBatchDialogOpen}
      onOpenChange={setCreateBatchDialogOpen}
    >
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Batch
          </SheetTitle>
          <SheetDescription>
            Create a new batch to organize your students
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="mt-6 space-y-2">
            <label
              htmlFor="name"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Batch Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter batch name..."
              disabled={isPending}
              autoFocus
            />
          </div>

          <SheetFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isPending}>
              {isPending ? 'Creating...' : 'Create Batch'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
