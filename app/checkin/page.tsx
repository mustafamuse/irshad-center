import { Suspense } from 'react'

import { Loader2 } from 'lucide-react'

import { getDugsiTeachers } from '@/lib/db/queries/teacher'

import { TeacherCheckIn } from './_components/teacher-checkin'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Teacher Check-In',
}

async function CheckInData() {
  const teachers = await getDugsiTeachers()

  return <TeacherCheckIn teachers={teachers} />
}

export default function CheckInPage() {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto max-w-lg p-4 py-8">
        <Suspense
          fallback={
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <CheckInData />
        </Suspense>
      </div>
    </div>
  )
}
