// Browser-safe enum definition (Prisma Client cannot be used in browser)
// This matches the SubscriptionStatus enum from Prisma schema
const SubscriptionStatus = {
  incomplete: 'incomplete',
  incomplete_expired: 'incomplete_expired',
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  canceled: 'canceled',
  unpaid: 'unpaid',
  paused: 'paused',
} as const

type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus]

import { formatDate } from './formatters'

/**
 * Get the display label for a subscription status
 */
export function getSubscriptionStatusDisplay(
  status: SubscriptionStatus
): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'past_due':
      return 'Past Due'
    case 'canceled':
      return 'Canceled'
    case 'unpaid':
      return 'Unpaid'
    case 'trialing':
      return 'Trialing'
    case 'incomplete':
      return 'Incomplete'
    case 'incomplete_expired':
      return 'Incomplete Expired'
    case 'paused':
      return 'Paused'
    default:
      return status
  }
}

/**
 * Format period range as "Jan 1 - Jan 31"
 */
export function formatPeriodRange(
  periodStart: Date | string | null | undefined,
  periodEnd: Date | string | null | undefined
): string {
  if (!periodStart || !periodEnd) {
    return '—'
  }

  const start =
    typeof periodStart === 'string' ? new Date(periodStart) : periodStart
  const end = typeof periodEnd === 'string' ? new Date(periodEnd) : periodEnd

  return `${formatDate(start)} - ${formatDate(end)}`
}
