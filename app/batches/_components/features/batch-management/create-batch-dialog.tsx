'use client'

import { useState } from 'react'

import { Plus } from 'lucide-react'

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

import { useBatches } from '../../../_hooks/use-batches'
import { useBatchStore } from '../../../_store/batch.store'

interface CreateBatchDialogProps {
  children?: React.ReactNode
}

export function CreateBatchDialog({ children }: CreateBatchDialogProps) {
  const [name, setName] = useState('')
  const { isCreateBatchDialogOpen, setCreateBatchDialogOpen } = useBatchStore()
  const { createBatch, isCreating } = useBatches()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      await createBatch({ name: name.trim() })
      setName('')
      setCreateBatchDialogOpen(false)
    } catch {
      // Error handling is done in the hook
    }
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
              disabled={isCreating}
              autoFocus
            />
          </div>

          <SheetFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isCreating}>
              {isCreating ? 'Creating...' : 'Create Batch'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
