import type { StudentWithBatch } from '@/lib/db/queries/student'
import type { BatchWithCount } from '@/lib/types/batch'
import { BatchManagement } from '../batch-management'

interface BatchesTabProps {
  batches: BatchWithCount[]
  students: StudentWithBatch[]
}

export function BatchesTab({ batches, students }: BatchesTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Batch Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage cohorts and assign students to batches
          </p>
        </div>
      </div>

      <BatchManagement batches={batches} students={students} />
    </div>
  )
}
