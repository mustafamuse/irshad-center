import { SubscriptionStatus, StripeAccountType } from '@prisma/client'

import { formatDate } from './formatters'

/**
 * Map a Stripe subscription status onto the status we persist.
 *
 * Stripe keeps status 'active' while pause_collection is set, so the raw status
 * cannot distinguish a paying family from one whose invoices are being voided
 * or marked uncollectible. The admin pause writes 'paused' to the DB, and
 * without this mapping the webhook fired by that same Stripe update reverts it
 * to 'active' — hiding the Resume button and stranding the family paused in
 * Stripe.
 *
 * Dugsi-only: Mahad has no pause UI, and its consumers would render a persisted
 * 'paused' as a payment problem.
 *
 * This is the single definition of that rule. The subscription webhook and the
 * status reconciler both call it, so a reconcile run can never disagree with
 * what the next webhook would write — which is what turns a fixed row back into
 * a divergent one.
 */
export function deriveSubscriptionStatus(
  rawStatus: SubscriptionStatus,
  accountType: StripeAccountType,
  pauseCollection: unknown
): SubscriptionStatus {
  return accountType === 'DUGSI' && pauseCollection && rawStatus === 'active'
    ? 'paused'
    : rawStatus
}

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
