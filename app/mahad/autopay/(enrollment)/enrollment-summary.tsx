import { UserPlus2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { StudentDTO } from '@/lib/actions/get-students'
import { calculateTotal } from '@/lib/utils'

interface EnrollmentSummaryProps {
  selectedStudents: StudentDTO[]
  onAddStudents?: () => void
}

export function EnrollmentSummary({
  selectedStudents,
  onAddStudents,
}: EnrollmentSummaryProps) {
  const hasStudents = selectedStudents.length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Enrollment Summary</h3>
        {hasStudents && onAddStudents && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-primary"
            onClick={onAddStudents}
          >
            <UserPlus2 className="mr-1 h-4 w-4" /> Enroll More
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <span className="text-sm text-gray-400">Students Enrolled</span>
          {hasStudents ? (
            <ul className="space-y-1.5">
              {selectedStudents.map((student) => (
                <li
                  key={student.id}
                  className="flex items-center justify-between rounded-md bg-[#0f1729] p-4 text-sm"
                >
                  <span className="font-medium text-white">{student.name}</span>
                  <span className="font-medium tabular-nums text-white">
                    ${student.monthlyRate}/mo
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-gray-800 py-8 text-center">
              <UserPlus2 className="h-8 w-8 text-gray-600" />
              <p className="mt-2 text-sm font-medium text-gray-400">
                No students selected
              </p>
              {onAddStudents && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2 h-8 text-primary"
                  onClick={onAddStudents}
                >
                  Select Students
                </Button>
              )}
            </div>
          )}
        </div>

        {hasStudents && (
          <div className="flex items-center justify-between rounded-md bg-[#0f1729] p-4">
            <span className="text-base font-medium text-white">
              Monthly Total
            </span>
            <div className="text-right">
              <span className="text-xl font-bold tabular-nums text-white">
                ${calculateTotal(selectedStudents)}
              </span>
              <span className="ml-1 text-sm text-gray-400">per month</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
