import type { Student } from '@prisma/client'
import type { StudentWithBatch } from '@/lib/db/queries/student'
import type { BatchWithCount } from '@/lib/types/batch'
import { StudentsTable } from '../students-table'
import { Card } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'

interface ActiveTabProps {
  students: StudentWithBatch[]
  batches: BatchWithCount[]
  studentsWithPayment: Student[]
}

export function ActiveTab({
  students,
  batches,
  studentsWithPayment,
}: ActiveTabProps) {
  // Filter to only active subscription students
  const activeIds = new Set(
    studentsWithPayment
      .filter((s) => s.subscriptionStatus === 'active')
      .map((s) => s.id)
  )

  const filteredStudents = students.filter((s) => activeIds.has(s.id))

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
          <div>
            <h3 className="font-semibold text-green-900 dark:text-green-100">
              Active Students
            </h3>
            <p className="mt-1 text-sm text-green-800 dark:text-green-200">
              {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} with active subscriptions and good payment standing.
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
            <div className="rounded-full bg-gray-100 p-4 dark:bg-gray-800">
              <CheckCircle2 className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold">No Active Students</h3>
            <p className="text-muted-foreground">
              No students with active subscriptions found.
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
