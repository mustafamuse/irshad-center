'use client'

import { useState, useTransition } from 'react'

import { Shift } from '@prisma/client'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { SHIFT_BADGES } from '@/lib/constants/dugsi'

import { updateTeacherShiftsAction } from '../actions'

interface Props {
  teacherId: string
  currentShifts: Shift[]
  onUpdate?: (shifts: Shift[]) => void
}

export function ManageShiftsTab({ teacherId, currentShifts, onUpdate }: Props) {
  const [shifts, setShifts] = useState<Shift[]>(currentShifts)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const hasChanges =
    shifts.length !== currentShifts.length ||
    !shifts.every((s) => currentShifts.includes(s))

  function toggleShift(shift: Shift) {
    setSaved(false)
    if (shifts.includes(shift)) {
      setShifts(shifts.filter((s) => s !== shift))
    } else {
      setShifts([...shifts, shift])
    }
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateTeacherShiftsAction({ teacherId, shifts })
      if (result.success) {
        setSaved(true)
        onUpdate?.(shifts)
      } else {
        setError(result.error || 'Failed to save')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <p className="mb-4 text-sm text-muted-foreground">
          Select which shifts this teacher is assigned to work.
        </p>

        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="morning"
              checked={shifts.includes('MORNING')}
              onCheckedChange={() => toggleShift('MORNING')}
            />
            <Label
              htmlFor="morning"
              className="flex cursor-pointer items-center gap-2"
            >
              <span
                className={`inline-block rounded px-2 py-0.5 text-xs ${SHIFT_BADGES.MORNING.className}`}
              >
                {SHIFT_BADGES.MORNING.label}
              </span>
            </Label>
          </div>

          <div className="flex items-center space-x-3">
            <Checkbox
              id="afternoon"
              checked={shifts.includes('AFTERNOON')}
              onCheckedChange={() => toggleShift('AFTERNOON')}
            />
            <Label
              htmlFor="afternoon"
              className="flex cursor-pointer items-center gap-2"
            >
              <span
                className={`inline-block rounded px-2 py-0.5 text-xs ${SHIFT_BADGES.AFTERNOON.className}`}
              >
                {SHIFT_BADGES.AFTERNOON.label}
              </span>
            </Label>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {saved && !hasChanges && (
          <p className="mt-3 text-sm text-green-600">Shifts saved</p>
        )}

        <div className="mt-4">
          <Button
            onClick={handleSave}
            disabled={isPending || !hasChanges}
            className="w-full"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Shifts
          </Button>
        </div>
      </div>
    </div>
  )
}
