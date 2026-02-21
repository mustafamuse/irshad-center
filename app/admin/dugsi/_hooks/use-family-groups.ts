'use client'

import { useMemo } from 'react'

import { DugsiRegistration, Family } from '../_types'
import { groupRegistrationsByFamily } from '../_utils/family'
import { filterFamiliesByTab } from '../_utils/filters'

export function useFamilyGroups(registrations: DugsiRegistration[]): Family[] {
  return useMemo(
    () => groupRegistrationsByFamily(registrations),
    [registrations]
  )
}

export function useFamilyStats(families: Family[]) {
  return useMemo(
    () => ({
      all: families.length,
      active: filterFamiliesByTab(families, 'active').length,
      churned: filterFamiliesByTab(families, 'churned').length,
      paused: filterFamiliesByTab(families, 'paused').length,
      inactive: filterFamiliesByTab(families, 'inactive').length,
      needsAttention: filterFamiliesByTab(families, 'needs-attention').length,
      billingMismatch: filterFamiliesByTab(families, 'billing-mismatch').length,
    }),
    [families]
  )
}
