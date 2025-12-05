'use client'

import { useState } from 'react'

import { Program } from '@prisma/client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

import { bulkAssignProgramsAction } from '../actions'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  teacher: {
    id: string
    name: string
    programs: Program[]
  }
  onSuccess?: () => void
}

const PROGRAM_OPTIONS: Array<{
  value: Program
  label: string
  description: string
}> = [
  {
    value: 'MAHAD_PROGRAM',
    label: 'Mahad',
    description: 'Mahad Islamic Institute program',
  },
  {
    value: 'DUGSI_PROGRAM',
    label: 'Dugsi',
    description: 'Weekend Islamic school program',
  },
  {
    value: 'YOUTH_EVENTS',
    label: 'Youth Events',
    description: 'Youth activities and events',
  },
]

export function ManageProgramsDialog({
  open,
  onOpenChange,
  teacher,
  onSuccess,
}: Props) {
  const [selectedPrograms, setSelectedPrograms] = useState<Program[]>(
    teacher.programs
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleProgramToggle(program: Program, checked: boolean) {
    setSelectedPrograms((prev) =>
      checked ? [...prev, program] : prev.filter((p) => p !== program)
    )
  }

  async function handleSubmit() {
    setIsSubmitting(true)
    setError(null)

    const result = await bulkAssignProgramsAction({
      teacherId: teacher.id,
      programs: selectedPrograms,
    })

    setIsSubmitting(false)

    if (result.success) {
      onOpenChange(false)
      onSuccess?.()
    } else {
      setError(result.error || 'Failed to update programs')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Programs</DialogTitle>
          <DialogDescription>
            Assign {teacher.name} to programs. They can teach in multiple
            programs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            {PROGRAM_OPTIONS.map((program) => {
              const isChecked = selectedPrograms.includes(program.value)

              return (
                <div
                  key={program.value}
                  className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-accent/50"
                >
                  <Checkbox
                    id={program.value}
                    checked={isChecked}
                    onCheckedChange={(checked) =>
                      handleProgramToggle(program.value, checked === true)
                    }
                    disabled={isSubmitting}
                  />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor={program.value}
                      className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {program.label}
                      {teacher.programs.includes(program.value) && (
                        <Badge variant="secondary" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {program.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Programs'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
