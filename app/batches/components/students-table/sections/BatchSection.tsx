import { BookOpen } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { BatchWithCount } from '@/lib/types/batch'

import type { StudentFormData } from '../../../types/student-form'
import { StudentMoneyField } from '../fields/StudentMoneyField'
import { StudentSelectField } from '../fields/StudentSelectField'

interface BatchSectionProps {
  formData: StudentFormData
  isEditing: boolean
  isPending: boolean
  updateField: <K extends keyof StudentFormData>(
    field: K,
    value: StudentFormData[K]
  ) => void
  batches: BatchWithCount[]
  currentBatchName: string | null
  studentStatus: string | null
}

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
    { value: 'none', label: 'No Batch' },
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
    <div className="space-y-4 border-t pt-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <BookOpen className="h-4 w-4" />
        Batch & Payment Information
      </h3>

      <div className="space-y-3">
        <StudentSelectField
          id="batchId"
          label="Batch Assignment"
          value={formData.batchId}
          options={batchOptions}
          isEditing={isEditing}
          onChange={(value) => updateField('batchId', value)}
          disabled={isPending}
          displayValue={currentBatchName || 'No Batch Assigned'}
          placeholder="Select a batch"
        />

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Status</label>
          <div className="flex items-center gap-2">
            <Badge variant={getStatusVariant(studentStatus)}>
              {formatStatus(studentStatus)}
            </Badge>
          </div>
        </div>

        <StudentMoneyField
          id="monthlyRate"
          label="Monthly Rate"
          value={formData.monthlyRate}
          isEditing={isEditing}
          onChange={(value) => updateField('monthlyRate', value)}
          disabled={isPending}
        />
      </div>
    </div>
  )
}
