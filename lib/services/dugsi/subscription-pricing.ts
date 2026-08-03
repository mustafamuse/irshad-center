import type Stripe from 'stripe'

import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { getDugsiKeys } from '@/lib/keys/stripe'
import {
  formatRateDisplay,
  getRateTierDescription,
  getStripeInterval,
} from '@/lib/utils/dugsi-tuition'

export interface RosterChild {
  id: string
  name: string
}

export async function updateDugsiSubscriptionPricing(
  stripe: Stripe,
  stripeSubscriptionId: string,
  newRate: number,
  roster: RosterChild[],
  options?: { clearCancelAtPeriodEnd?: boolean }
): Promise<void> {
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
  const subscriptionItemId = subscription.items.data[0]?.id
  if (!subscriptionItemId) {
    throw new ActionError(
      'Subscription has no line items to update',
      ERROR_CODES.STRIPE_ERROR
    )
  }

  const { productId } = getDugsiKeys()
  if (!productId) {
    throw new ActionError(
      'Stripe product not configured for Dugsi',
      ERROR_CODES.STRIPE_ERROR
    )
  }

  const params: Stripe.SubscriptionUpdateParams = {
    items: [
      {
        id: subscriptionItemId,
        price_data: {
          product: productId,
          unit_amount: newRate,
          currency: 'usd',
          recurring: getStripeInterval(),
        },
      },
    ],
    proration_behavior: 'none',
    metadata: {
      Children: roster.map((c) => c.name).join(', '),
      Rate: formatRateDisplay(newRate),
      Tier: getRateTierDescription(roster.length),
      childCount: String(roster.length),
      calculatedRate: String(newRate),
      profileIds: roster.map((c) => c.id).join(','),
    },
  }

  if (options?.clearCancelAtPeriodEnd && subscription.cancel_at_period_end) {
    params.cancel_at_period_end = false
  }

  await stripe.subscriptions.update(stripeSubscriptionId, params)
}
