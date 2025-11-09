import { Metadata } from 'next'
import { Suspense } from 'react'
import { findDuplicateStudents } from '@/lib/db/queries/student'
import { DuplicatesManager } from './duplicates-manager'

export const metadata: Metadata = {
  title: 'Duplicate Detection | Student Management',
  description: 'Identify and resolve duplicate student records',
}

function Loading() {
  return <div className="p-4 text-muted-foreground">Scanning for duplicates...</div>
}

export default async function DuplicatesPage() {
  const duplicateGroups = await findDuplicateStudents()

  // Transform the data to match the expected format
  const duplicates = duplicateGroups.map(group => ({
    name: group.email, // Using email field as the group name
    students: [group.keepRecord, ...group.duplicateRecords] as any[]
  }))

  return (
    <Suspense fallback={<Loading />}>
      <DuplicatesManager duplicates={duplicates} />
    </Suspense>
  )
}