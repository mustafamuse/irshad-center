/**
 * Billing Utilities
 *
 * Functions for comparing actual subscription amounts to expected amounts
 * based on family child count and tiered pricing.
 */

import { calculateDugsiRate } from '@/lib/utils/dugsi-tuition'

import { DugsiRegistration } from '../_types'

export type BillingStatusType =
  | 'match'
  | 'underpaying'
  | 'overpaying'
  | 'no-subscription'

export interface BillingStatus {
  status: BillingStatusType
  actual: number | null
  expected: number
  difference: number | null
}

export function hasBillingMismatch(registration: DugsiRegistration): boolean {
  if (!registration.subscriptionAmount) {
    return false
  }

  const childCount = registration.familyChildCount || 1
  const expected = calculateDugsiRate(childCount)

  return registration.subscriptionAmount !== expected
}

export function getBillingStatus(
  registration: DugsiRegistration
): BillingStatus {
  const childCount = registration.familyChildCount || 1
  const expected = calculateDugsiRate(childCount)

  if (!registration.subscriptionAmount) {
    return {
      status: 'no-subscription',
      actual: null,
      expected,
      difference: null,
    }
  }

  const actual = registration.subscriptionAmount
  const difference = actual - expected

  if (difference === 0) {
    return {
      status: 'match',
      actual,
      expected,
      difference: 0,
    }
  }

  return {
    status: difference > 0 ? 'overpaying' : 'underpaying',
    actual,
    expected,
    difference,
  }
}
