import type { Student } from '@prisma/client'
import type { StudentWithBatch } from '@/lib/db/queries/student'
import type { BatchWithCount } from '@/lib/types/batch'
import { StudentsTable } from '../students-table'
import { Card } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

interface NeedsAttentionTabProps {
  students: StudentWithBatch[]
  batches: BatchWithCount[]
  studentsWithPayment: Student[]
}

export function NeedsAttentionTab({
  students,
  batches,
  studentsWithPayment,
}: NeedsAttentionTabProps) {
  // Filter to only students needing attention (non-active subscriptions)
  const needsAttentionIds = new Set(
    studentsWithPayment
      .filter(
        (s) => s.subscriptionStatus !== 'active' && s.subscriptionStatus !== null
      )
      .map((s) => s.id)
  )

  const filteredStudents = students.filter((s) => needsAttentionIds.has(s.id))

  return (
    <div className="space-y-6">
      {/* Header with Context */}
      <Card className="border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div>
            <h3 className="font-semibold text-amber-900 dark:text-amber-100">
              Students Requiring Attention
            </h3>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
              {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} with incomplete, past due, or other payment issues.
              Use the "Verify Bank Account" action for students needing bank verification.
            </p>
          </div>
        </div>
      </Card>

      {/* Students Table */}
      {filteredStudents.length > 0 ? (
        <StudentsTable
          students={filteredStudents}
          batches={batches}
        />
      ) : (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full bg-green-100 p-4 dark:bg-green-900">
              <AlertCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold">All Clear!</h3>
            <p className="text-muted-foreground">
              No students requiring attention at this time.
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
