import type { StudentWithBatch } from '@/lib/db/queries/student'
import type { BatchWithCount } from '@/lib/types/batch'
import { StudentsTable } from '../students-table'
import { Card } from '@/components/ui/card'
import { Users } from 'lucide-react'

interface AllStudentsTabProps {
  students: StudentWithBatch[]
  batches: BatchWithCount[]
}

export function AllStudentsTab({ students, batches }: AllStudentsTabProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">
              All Students
            </h3>
            <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">
              Complete student directory with advanced filtering and search.
              {students.length} total student{students.length !== 1 ? 's' : ''} enrolled.
            </p>
          </div>
        </div>
      </Card>

      {/* Students Table with Full Functionality */}
      <StudentsTable students={students} batches={batches} />
    </div>
  )
}
