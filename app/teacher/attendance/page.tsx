import { Suspense } from 'react'

import { Card } from '@/components/ui/card'
import { getAuthenticatedTeacherId } from '@/lib/auth/get-teacher'

import { AttendanceTabs } from './components/attendance-tabs'
import { TeacherSessionHistory } from './components/teacher-session-history'
import { TeacherStats } from './components/teacher-stats'
import { TeacherStudentList } from './components/teacher-student-list'
import { TeacherTodaySessions } from './components/teacher-today-sessions'

interface Props {
  searchParams: Promise<{
    page?: string
    fromDate?: string
    toDate?: string
    classId?: string
  }>
}

export default async function TeacherAttendancePage({ searchParams }: Props) {
  const teacherId = await getAuthenticatedTeacherId()
  const resolvedSearchParams = await searchParams

  return (
    <div className="container mx-auto space-y-4 p-4 sm:space-y-6 sm:p-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Suspense
          fallback={
            <>
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="h-24 animate-pulse" />
              ))}
            </>
          }
        >
          <TeacherStats teacherId={teacherId} />
        </Suspense>
      </div>

      <Suspense fallback={<Card className="h-32 animate-pulse" />}>
        <TeacherTodaySessions teacherId={teacherId} />
      </Suspense>

      <AttendanceTabs
        sessionsContent={
          <Card className="p-4 sm:p-6">
            <Suspense fallback={<Card className="h-64 animate-pulse" />}>
              <TeacherSessionHistory
                teacherId={teacherId}
                searchParams={resolvedSearchParams}
              />
            </Suspense>
          </Card>
        }
        studentsContent={
          <Suspense fallback={<Card className="h-32 animate-pulse" />}>
            <TeacherStudentList teacherId={teacherId} />
          </Suspense>
        }
      />
    </div>
  )
}
