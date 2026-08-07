/**
 * Custom hooks for family grouping and stats
 * Memoized computations for better performance
 */

'use client'

import { useMemo } from 'react'

import { DugsiRegistration, Family } from '../_types'
import { hasBillingMismatch } from '../_utils/billing'
import { groupRegistrationsByFamily } from '../_utils/family'

export function useFamilyGroups(registrations: DugsiRegistration[]): Family[] {
  return useMemo(
    () => groupRegistrationsByFamily(registrations),
    [registrations]
  )
}

export function useFamilyStats(families: Family[]) {
  return useMemo(() => {
    // Same fully-withdrawn exclusion as DugsiStats and filterFamiliesByTab
    // — tab badges must agree with both the stat cards and the tab lists.
    const current = families.filter((f) => f.hasActiveChildren)
    return {
      all: current.length,
      active: current.filter((f) => f.hasSubscription).length,
      churned: current.filter((f) => f.hasChurned && !f.hasSubscription).length,
      needsAttention: current.filter((f) => !f.hasPayment && !f.hasChurned)
        .length,
      billingMismatch: current.filter(
        (f) => f.hasSubscription && f.members.some((m) => hasBillingMismatch(m))
      ).length,
    }
  }, [families])
}
