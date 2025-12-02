import { BookOpen } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { BatchWithCount } from '@/lib/types/batch'

import type { StudentFormData } from '../../../_types'
import { StudentSelectField } from '../fields/StudentSelectField'

interface BatchSectionProps {
  /** Current form data state */
  formData: StudentFormData
  /** Whether the form is in edit mode */
  isEditing: boolean
  /** Whether a save operation is pending */
  isPending: boolean
  /** Callback to update a form field */
  updateField: <K extends keyof StudentFormData>(
    field: K,
    value: StudentFormData[K]
  ) => void
  /** Available batches for selection */
  batches: BatchWithCount[]
  /** Current batch name for display in view mode */
  currentBatchName: string | null
  /** Student's current enrollment status */
  studentStatus: string | null
}

/**
 * BatchSection - Form section for cohort assignment and status display
 *
 * Allows selecting a cohort from available batches and displays
 * the student's current enrollment status.
 */
export function BatchSection({
  formData,
  isEditing,
  isPending,
  updateField,
  batches,
  currentBatchName,
  studentStatus,
}: BatchSectionProps) {
  const batchOptions = [
    { value: 'none', label: 'No Cohort' },
    ...batches.map((batch) => ({
      value: batch.id,
      label: `${batch.name} (${batch.studentCount} students)`,
    })),
  ]

  const getStatusVariant = (status: string | null) => {
    switch (status) {
      case 'ACTIVE':
        return 'default'
      case 'PENDING':
        return 'secondary'
      case 'GRADUATED':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const formatStatus = (status: string | null) => {
    if (!status) return 'No Status'
    return status.charAt(0) + status.slice(1).toLowerCase()
  }

  return (
    <div className="space-y-3 border-t pt-4 sm:space-y-4 sm:pt-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <BookOpen className="h-4 w-4" />
        Cohort & Payment Information
      </h3>

      <div className="space-y-2 sm:space-y-3">
        <StudentSelectField
          id="batchId"
          label="Cohort Assignment"
          value={formData.batchId}
          options={batchOptions}
          isEditing={isEditing}
          onChange={(value) => updateField('batchId', value)}
          disabled={isPending}
          displayValue={currentBatchName || 'No Cohort Assigned'}
          placeholder="Select a cohort"
        />

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Status</label>
          <div className="flex items-center gap-2">
            <Badge variant={getStatusVariant(studentStatus)}>
              {formatStatus(studentStatus)}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  )
}
