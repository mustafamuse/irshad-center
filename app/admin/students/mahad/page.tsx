import { Metadata } from 'next'
import { Suspense } from 'react'
import { getStudentsWithBatch } from '@/lib/db/queries/student'
import { getBatches } from '@/lib/db/queries/batch'
import { MahadStudentsDirectory } from './mahad-students-directory'
import { Providers } from '@/app/providers'

export const metadata: Metadata = {
  title: 'MAHAD Students | Student Management',
  description: 'Manage MAHAD program student profiles and information',
}

function Loading() {
  return <div className="p-4 text-muted-foreground">Loading students...</div>
}

export default async function MahadStudentsPage() {
  // Fetch data in parallel
  const [students, batches] = await Promise.all([
    getStudentsWithBatch(),
    getBatches(),
  ])

  return (
    <Providers>
      <Suspense fallback={<Loading />}>
        <MahadStudentsDirectory
          students={students}
          batches={batches}
        />
      </Suspense>
    </Providers>
  )
}