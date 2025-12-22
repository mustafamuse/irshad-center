'use client'

import { useState } from 'react'

import { Program, Shift } from '@prisma/client'

import { ErrorAlert } from '@/app/admin/_components/error-alert'
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
import {
  PROGRAM_LABELS,
  PROGRAM_DESCRIPTIONS,
  TEACHER_PROGRAMS,
} from '@/lib/constants/program-ui'

import { bulkAssignProgramsAction } from '../actions'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  teacher: {
    id: string
    name: string
    programs: Program[]
    dugsiShifts: Shift[]
  }
  onSuccess?: () => void
}

export function ManageProgramsDialog({
  open,
  onOpenChange,
  teacher,
  onSuccess,
}: Props) {
  const [selectedPrograms, setSelectedPrograms] = useState<Program[]>(
    teacher.programs
  )
  const [selectedShifts, setSelectedShifts] = useState<Shift[]>(
    teacher.dugsiShifts
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDugsiSelected = selectedPrograms.includes('DUGSI_PROGRAM')

  function handleProgramToggle(program: Program, checked: boolean) {
    setSelectedPrograms((prev) =>
      checked ? [...prev, program] : prev.filter((p) => p !== program)
    )
    if (program === 'DUGSI_PROGRAM' && !checked) {
      setSelectedShifts([])
    }
  }

  function handleShiftToggle(shift: Shift, checked: boolean) {
    setSelectedShifts((prev) =>
      checked ? [...prev, shift] : prev.filter((s) => s !== shift)
    )
  }

  async function handleSubmit() {
    if (isDugsiSelected && selectedShifts.length === 0) {
      setError('Please select at least one shift for Dugsi program')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const result = await bulkAssignProgramsAction({
      teacherId: teacher.id,
      programs: selectedPrograms,
      dugsiShifts: isDugsiSelected ? selectedShifts : undefined,
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
            {TEACHER_PROGRAMS.map((program) => {
              const isChecked = selectedPrograms.includes(program)

              return (
                <div key={program} className="space-y-2">
                  <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-accent/50">
                    <Checkbox
                      id={program}
                      checked={isChecked}
                      onCheckedChange={(checked) =>
                        handleProgramToggle(program, checked === true)
                      }
                      disabled={isSubmitting}
                    />
                    <div className="flex-1 space-y-1">
                      <Label
                        htmlFor={program}
                        className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {PROGRAM_LABELS[program]}
                        {teacher.programs.includes(program) && (
                          <Badge variant="secondary" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {PROGRAM_DESCRIPTIONS[program]}
                      </p>
                    </div>
                  </div>

                  {program === 'DUGSI_PROGRAM' && isChecked && (
                    <div className="ml-7 rounded-lg border border-dashed p-3">
                      <p className="mb-2 text-sm font-medium">
                        Shifts <span className="text-destructive">*</span>
                      </p>
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="shift-morning"
                            checked={selectedShifts.includes('MORNING')}
                            onCheckedChange={(checked) =>
                              handleShiftToggle('MORNING', checked === true)
                            }
                            disabled={isSubmitting}
                          />
                          <Label htmlFor="shift-morning" className="text-sm">
                            Morning
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="shift-afternoon"
                            checked={selectedShifts.includes('AFTERNOON')}
                            onCheckedChange={(checked) =>
                              handleShiftToggle('AFTERNOON', checked === true)
                            }
                            disabled={isSubmitting}
                          />
                          <Label htmlFor="shift-afternoon" className="text-sm">
                            Afternoon
                          </Label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {error && <ErrorAlert message={error} />}
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
