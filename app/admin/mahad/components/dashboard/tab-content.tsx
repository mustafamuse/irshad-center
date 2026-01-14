'use client'

import {
  DuplicateGroup,
  MahadBatch,
  MahadStudent,
  TabValue,
} from '../../_types'
import { BatchGrid } from '../batches/batch-grid'
import { DuplicatesView } from '../duplicates/duplicates-view'
import { StudentsMobileCards } from '../students/students-mobile-cards'
import { StudentsTable } from '../students/students-table'

interface TabContentProps {
  tab: TabValue
  students: MahadStudent[]
  batches: MahadBatch[]
  duplicates: DuplicateGroup[]
}

export function TabContent({
  tab,
  students,
  batches,
  duplicates,
}: TabContentProps) {
  switch (tab) {
    case 'students':
      return (
        <>
          <div className="hidden md:block">
            <StudentsTable students={students} batches={batches} />
          </div>
          <div className="block md:hidden">
            <StudentsMobileCards students={students} batches={batches} />
          </div>
        </>
      )
    case 'batches':
      return <BatchGrid batches={batches} students={students} />
    case 'duplicates':
      return <DuplicatesView duplicates={duplicates} />
    default:
      return null
  }
}
