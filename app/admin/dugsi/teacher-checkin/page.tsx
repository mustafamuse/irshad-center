import { Suspense } from 'react'

import { Loader2 } from 'lucide-react'
import { Metadata } from 'next'

import { getDugsiTeachers } from '@/lib/db/queries/teacher'

import { CheckInPageContent } from './_components/checkin-page-content'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Teacher Check-In Admin | Dugsi',
  description: 'View teacher check-in history and manage attendance',
}

async function CheckInData() {
  const teachers = await getDugsiTeachers()

  return <CheckInPageContent teachers={teachers} />
}

export default function TeacherCheckInAdminPage() {
  return (
    <div className="container mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
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
  )
}
