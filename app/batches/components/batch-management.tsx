'use client'

import { useState } from 'react'

import { Plus, UserPlus, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { createBatch } from '@/lib/actions/batch-actions'

import { AssignStudentsDialog } from './assign-students'
import { DeleteStudentSheet } from './delete-student-sheet'
import { useBatches } from '../hooks/use-batches'

export function BatchManagement() {
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateSheet, setShowCreateSheet] = useState(false)
  const {
    data: batches = [],
    isLoading: isLoadingBatches,
    invalidateBatches,
  } = useBatches()

  async function handleCreateBatch(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      await createBatch(name)
      toast.success('Batch created successfully')
      setName('')
      setShowCreateSheet(false)
      await invalidateBatches()
    } catch (error) {
      console.error('Failed to create batch:', error)
      toast.error('Failed to create batch')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Batch Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Create and manage student batches
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          <Sheet open={showCreateSheet} onOpenChange={setShowCreateSheet}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Create Batch</span>
                <span className="sm:hidden">Create</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Create New Batch</SheetTitle>
                <SheetDescription>
                  Create a new batch to organize your students
                </SheetDescription>
              </SheetHeader>
              <form onSubmit={handleCreateBatch} className="space-y-6">
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
                    disabled={isLoading}
                  />
                </div>
                <SheetFooter>
                  <Button
                    type="submit"
                    disabled={!name || isLoading}
                    className="w-full"
                  >
                    Create Batch
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>

          <AssignStudentsDialog>
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              <UserPlus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Assign Students</span>
              <span className="sm:hidden">Assign</span>
            </Button>
          </AssignStudentsDialog>

          <DeleteStudentSheet />
        </div>
      </div>

      {/* Batches Grid */}
      {isLoadingBatches ? (
        <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center text-muted-foreground">
            Loading batches...
          </div>
        </div>
      ) : batches.length === 0 ? (
        <div className="flex h-[200px] flex-col items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              No batches created yet
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShowCreateSheet(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create your first batch
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {batches.map((batch) => (
            <Card
              key={batch.id}
              className="flex flex-col justify-between p-3 transition-all hover:shadow-md sm:p-4"
            >
              <div className="space-y-2 sm:space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="line-clamp-2 text-sm font-medium sm:text-base">
                      {batch.name}
                    </h3>
                    {batch.startDate && (
                      <p className="text-xs text-muted-foreground">
                        Starts: {new Date(batch.startDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                    <div className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium">
                      {batch.studentCount} student
                      {batch.studentCount !== 1 ? 's' : ''}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Edit Batch</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600">
                          Delete Batch
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
