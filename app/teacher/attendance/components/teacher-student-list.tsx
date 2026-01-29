import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { getStudentsByTeacher } from '@/lib/db/queries/teacher-students'

interface Props {
  teacherId: string
}

export async function TeacherStudentList({ teacherId }: Props) {
  const students = await getStudentsByTeacher(teacherId)

  if (students.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No students found
      </p>
    )
  }

  return (
    <div className="space-y-1">
      {students.map((s) => (
        <Link
          key={s.profileId}
          href={`/teacher/attendance/student/${s.profileId}`}
          className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted"
        >
          <div>
            <p className="font-medium">{s.name}</p>
            <p className="text-xs text-muted-foreground">
              {s.age != null ? `${s.age} yrs` : '—'}
            </p>
          </div>
          <Badge variant="secondary">{s.shift}</Badge>
        </Link>
      ))}
    </div>
  )
}
