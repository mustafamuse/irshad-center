'use client'

import { FamilyStatusFilter } from '@/lib/hooks/use-admin-tabs'

import { useFamilyFilters } from '../../_hooks/use-family-filters'
import { useFamilyGroups } from '../../_hooks/use-family-groups'
import { DugsiRegistration, TabValue } from '../../_types'
import { useDugsiFilters } from '../../store'
import { FamilyDataTable } from '../family-table'

const STATUS_TAB_MAP: Record<FamilyStatusFilter, TabValue> = {
  all: 'all',
  active: 'active',
  churned: 'churned',
  'needs-attention': 'needs-attention',
  'billing-mismatch': 'billing-mismatch',
}

interface FamiliesTabContentProps {
  registrations: DugsiRegistration[]
  statusFilter: FamilyStatusFilter
}

export function FamiliesTabContent({
  registrations,
  statusFilter,
}: FamiliesTabContentProps) {
  const filters = useDugsiFilters()

  const familyGroups = useFamilyGroups(registrations)

  const filteredFamilies = useFamilyFilters(familyGroups, {
    tab: STATUS_TAB_MAP[statusFilter],
    searchQuery: filters.search?.query || '',
    searchField: filters.search?.field || 'all',
    advancedFilters: filters.advanced || {
      dateFilter: 'all',
      hasHealthInfo: false,
    },
    quickShift: filters.quickShift,
  })

  return <FamilyDataTable families={filteredFamilies} />
}
