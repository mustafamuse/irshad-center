'use client'

import { Family } from '../../_types'
import { FamilyDataTable } from '../family-table'

interface TabContentProps {
  families: Family[]
}

export function TabContent({ families }: TabContentProps) {
  return <FamilyDataTable families={families} />
}
