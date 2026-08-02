'use client'

import {
  DuplicateGroup,
  MahadBatch,
  MahadStudent,
  TabValue,
} from '../../_types'
import { BatchGrid } from '../batches/batch-grid'
import { DuplicatesView } from '../duplicates/duplicates-view'
import { StudentsTable } from '../students/students-table'

interface TabContentProps {
  tab: TabValue
  students: MahadStudent[]
  batches: MahadBatch[]
  duplicates: DuplicateGroup[]
  initialStudentId?: string
}

export function TabContent({
  tab,
  students,
  batches,
  duplicates,
  initialStudentId,
}: TabContentProps) {
  switch (tab) {
    case 'students':
      return (
        <StudentsTable
          students={students}
          batches={batches}
          initialStudentId={initialStudentId}
        />
      )
    case 'batches':
      return <BatchGrid batches={batches} students={students} />
    case 'duplicates':
      return <DuplicatesView duplicates={duplicates} />
    default:
      return null
  }
}
