import { Suspense } from 'react'

import { Loader2 } from 'lucide-react'

import { getDugsiTeachers } from '@/lib/db/queries/teacher'

import { getClassesAction } from './_components/actions'
import { AttendanceTaking } from './_components/attendance-taking'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Attendance',
}

async function AttendanceData() {
  const [classesResult, teachers] = await Promise.all([
    getClassesAction(),
    getDugsiTeachers(),
  ])

  const classes =
    classesResult.success && classesResult.data ? classesResult.data : []

  return <AttendanceTaking classes={classes} teachers={teachers} />
}

export default function AttendancePage() {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto max-w-4xl p-4 py-8">
        <Suspense
          fallback={
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <AttendanceData />
        </Suspense>
      </div>
    </div>
  )
}
