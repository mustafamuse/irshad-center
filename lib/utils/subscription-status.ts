import { SubscriptionStatus } from '@prisma/client'

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
 * Resolve paidUntil for a subscription row being CREATED.
 *
 * paidUntil means "paid through", so it may only be set once the first period
 * is genuinely settled. Stripe reports 'active' only after the first invoice
 * is paid; 'incomplete', 'past_due' and 'unpaid' all mean money is owed, and
 * 'trialing' means access without payment. Copying the period end regardless —
 * as every creation path used to — marked families covered for a period nobody
 * had paid for.
 *
 * For an EXISTING row, do not call this: omit paidUntil from the update and
 * leave the stored value alone. Advancing it is the invoice webhook's job, and
 * writing null here would erase a legitimately paid period.
 */
export function resolveInitialPaidUntil(
  status: SubscriptionStatus,
  periodEnd: Date | null
): Date | null {
  return status === 'active' ? periodEnd : null
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
