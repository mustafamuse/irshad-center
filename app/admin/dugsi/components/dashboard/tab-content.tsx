/**
 * Tab Content Component
 * Reusable component for rendering tab content based on view mode
 */

'use client'

import { Family } from '../../_types'
import { useViewMode } from '../../store'
import { FamilyTableView } from '../family-management/family-table-view'
import { DugsiRegistrationsTable } from '../registrations/registrations-table'

interface TabContentProps {
  families: Family[]
}

export function TabContent({ families }: TabContentProps) {
  const viewMode = useViewMode()

  return viewMode === 'grid' ? (
    <FamilyTableView families={families} />
  ) : (
    <DugsiRegistrationsTable
      registrations={families.flatMap((f) => f.members)}
    />
  )
}
