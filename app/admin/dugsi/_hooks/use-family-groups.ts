/**
 * Custom hooks for family grouping and stats
 * Memoized computations for better performance
 */

'use client'

import { useMemo } from 'react'

import { DugsiRegistration, Family } from '../_types'
import { hasBillingMismatch } from '../_utils/billing'
import {
  getActiveMemberCount,
  groupRegistrationsByFamily,
} from '../_utils/family'

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
      active: families.filter((f) => f.hasSubscription).length,
      churned: families.filter((f) => f.hasChurned && !f.hasSubscription)
        .length,
      paused: families.filter((f) =>
        f.members.some((m) => m.subscriptionStatus === 'paused')
      ).length,
      inactive: families.filter((f) => getActiveMemberCount(f) === 0).length,
      needsAttention: families.filter((f) => !f.hasPayment && !f.hasChurned)
        .length,
      billingMismatch: families.filter(
        (f) => f.hasSubscription && f.members.some((m) => hasBillingMismatch(m))
      ).length,
    }),
    [families]
  )
}
