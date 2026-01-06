'use client'

import { useEffect, useState } from 'react'

import { Shift } from '@prisma/client'
import { Loader2, Plus, Save } from 'lucide-react'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { useActionHandler } from '../../_hooks/use-action-handler'
import type { ClassWithDetails } from '../../_types'
import { createClassAction, updateClassAction } from '../../actions'

interface ClassFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  classData?: ClassWithDetails | null
}

export function ClassFormDialog({
  open,
  onOpenChange,
  mode,
  classData,
}: ClassFormDialogProps) {
  const [name, setName] = useState('')
  const [shift, setShift] = useState<Shift | ''>('')
  const [description, setDescription] = useState('')

  const isEditMode = mode === 'edit'

  const { execute: createClass, isPending: isCreating } = useActionHandler(
    createClassAction,
    {
      successMessage: 'Class created successfully',
      onSuccess: () => handleClose(),
    }
  )

  const { execute: updateClass, isPending: isUpdating } = useActionHandler(
    updateClassAction,
    {
      successMessage: 'Class updated successfully',
      onSuccess: () => handleClose(),
    }
  )

  const isPending = isCreating || isUpdating

  useEffect(() => {
    if (isEditMode && classData) {
      setName(classData.name)
      setShift(classData.shift)
      setDescription(classData.description ?? '')
    } else if (!isEditMode) {
      setName('')
      setShift('')
      setDescription('')
    }
  }, [isEditMode, classData, open])

  const handleClose = () => {
    onOpenChange(false)
    setName('')
    setShift('')
    setDescription('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isEditMode && classData) {
      await updateClass({
        classId: classData.id,
        name: name.trim(),
        description: description.trim() || undefined,
      })
    } else {
      if (!shift) return
      await createClass({
        name: name.trim(),
        shift,
        description: description.trim() || undefined,
      })
    }
  }

  const isValid = name.trim() && (isEditMode || shift)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? 'Edit Class' : 'Create New Class'}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? 'Update the class name and description.'
                : 'Create a new class for teacher and student assignment.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="class-name">
                Class Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="class-name"
                placeholder="e.g., Quran Level 1, Hifz Group A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                autoFocus
              />
            </div>

            {!isEditMode && (
              <div className="space-y-2">
                <Label htmlFor="class-shift">
                  Shift <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={shift}
                  onValueChange={(v) => setShift(v as Shift)}
                  disabled={isPending}
                >
                  <SelectTrigger id="class-shift">
                    <SelectValue placeholder="Select shift..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MORNING">Morning</SelectItem>
                    <SelectItem value="AFTERNOON">Afternoon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="class-description">Description (optional)</Label>
              <Textarea
                id="class-description"
                placeholder="Brief description of this class..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isPending}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !isValid}>
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
                  Create Class
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
