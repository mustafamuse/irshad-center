/**
 * Shared Subscription Service
 *
 * Cross-program Stripe subscription operations.
 * Works with subscriptions for any program (Mahad, Dugsi, etc.).
 *
 * Responsibilities:
 * - Validate Stripe subscriptions
 * - Sync subscription data from Stripe
 * - Update subscription status
 * - Handle subscription lifecycle
 */

import { StripeAccountType, SubscriptionStatus } from '@prisma/client'
import Stripe from 'stripe'

import {
  getSubscriptionByStripeId,
  createSubscription,
  updateSubscriptionStatus as updateSubscriptionStatusQuery,
} from '@/lib/db/queries/billing'
import { getStripeClient } from '@/lib/utils/stripe-client'
import { extractPeriodDates } from '@/lib/utils/type-guards'

/**
 * Subscription validation result
 */
export interface SubscriptionValidationResult {
  subscriptionId: string
  customerId: string
  status: string
  amount: number
  currency: string
  interval: string
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
}

/**
 * Subscription sync result
 */
export interface SubscriptionSyncResult {
  subscriptionId: string
  status: SubscriptionStatus
  updated: boolean
}

/**
 * Validate a Stripe subscription.
 *
 * Checks that:
 * 1. Subscription ID format is valid
 * 2. Subscription exists in Stripe
 * 3. Customer ID is present
 *
 * @param subscriptionId - Stripe subscription ID
 * @param accountType - Stripe account type
 * @returns Subscription validation data
 * @throws Error if subscription is invalid
 */
export async function validateStripeSubscription(
  subscriptionId: string,
  accountType: StripeAccountType
): Promise<SubscriptionValidationResult> {
  // Validate subscription ID format
  if (!subscriptionId.startsWith('sub_')) {
    throw new Error('Invalid subscription ID format. Must start with "sub_"')
  }

  // Get appropriate Stripe client
  const stripe = getStripeClient(accountType)

  // Retrieve subscription from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  if (!subscription) {
    throw new Error('Subscription not found in Stripe')
  }

  // Extract customer ID
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id

  if (!customerId) {
    throw new Error('Invalid customer ID in subscription')
  }

  // Extract amount and interval
  const priceData = subscription.items.data[0]?.price
  const amount = priceData?.unit_amount || 0
  const currency = subscription.currency || 'usd'
  const interval = priceData?.recurring?.interval || 'month'

  // Extract period dates
  const periodDates = extractPeriodDates(subscription)

  return {
    subscriptionId: subscription.id,
    customerId,
    status: subscription.status,
    amount,
    currency,
    interval,
    currentPeriodStart: periodDates.periodStart,
    currentPeriodEnd: periodDates.periodEnd,
  }
}

/**
 * Get subscription details from database.
 *
 * @param subscriptionId - Stripe subscription ID
 * @returns Subscription record or null
 */
export async function getSubscriptionDetails(subscriptionId: string) {
  return await getSubscriptionByStripeId(subscriptionId)
}

/**
 * Sync subscription status from Stripe.
 *
 * Fetches current status from Stripe and updates database.
 *
 * @param subscriptionId - Stripe subscription ID
 * @param accountType - Stripe account type
 * @returns Sync result
 */
export async function syncSubscriptionFromStripe(
  subscriptionId: string,
  accountType: StripeAccountType
): Promise<SubscriptionSyncResult> {
  // Get subscription from Stripe
  const stripeData = await validateStripeSubscription(
    subscriptionId,
    accountType
  )

  // Get subscription from database
  const dbSubscription = await getSubscriptionByStripeId(subscriptionId)

  if (!dbSubscription) {
    throw new Error(
      'Subscription not found in database. Create it first before syncing.'
    )
  }

  // Check if status changed
  const currentStatus = dbSubscription.status
  const newStatus = stripeData.status as SubscriptionStatus

  if (currentStatus !== newStatus) {
    // Update status
    await updateSubscriptionStatusQuery(dbSubscription.id, newStatus, {
      currentPeriodStart: stripeData.currentPeriodStart,
      currentPeriodEnd: stripeData.currentPeriodEnd,
      paidUntil: stripeData.currentPeriodEnd,
    })

    return {
      subscriptionId,
      status: newStatus,
      updated: true,
    }
  }

  return {
    subscriptionId,
    status: newStatus,
    updated: false,
  }
}

/**
 * Create subscription record in database from Stripe data.
 *
 * Use this when a subscription is created in Stripe (via webhook or admin)
 * and needs to be recorded in the database.
 *
 * @param stripeSubscription - Stripe subscription object
 * @param billingAccountId - Billing account ID
 * @param accountType - Stripe account type
 * @returns Created subscription record
 */
export async function createSubscriptionFromStripe(
  stripeSubscription: Stripe.Subscription,
  billingAccountId: string,
  accountType: StripeAccountType
) {
  // Extract customer ID
  const customerId =
    typeof stripeSubscription.customer === 'string'
      ? stripeSubscription.customer
      : stripeSubscription.customer?.id

  if (!customerId) {
    throw new Error('Invalid customer ID in subscription')
  }

  // Extract price data
  const priceData = stripeSubscription.items.data[0]?.price
  const amount = priceData?.unit_amount || 0
  const currency = stripeSubscription.currency || 'usd'
  const interval = priceData?.recurring?.interval || 'month'

  // Extract period dates
  const periodDates = extractPeriodDates(stripeSubscription)

  // Create subscription
  return await createSubscription({
    billingAccountId,
    stripeAccountType: accountType,
    stripeSubscriptionId: stripeSubscription.id,
    stripeCustomerId: customerId,
    status: stripeSubscription.status as SubscriptionStatus,
    amount,
    currency,
    interval,
    currentPeriodStart: periodDates.periodStart,
    currentPeriodEnd: periodDates.periodEnd,
    paidUntil: periodDates.periodEnd,
  })
}

/**
 * Update subscription status.
 *
 * Use this for manual status updates (e.g., admin actions, webhooks).
 *
 * @param subscriptionId - Stripe subscription ID
 * @param status - New subscription status
 * @param periodData - Optional period data to update
 * @returns Updated subscription
 */
export async function updateSubscriptionStatus(
  subscriptionId: string,
  status: SubscriptionStatus,
  periodData?: {
    currentPeriodStart?: Date | null
    currentPeriodEnd?: Date | null
    paidUntil?: Date | null
  }
) {
  const subscription = await getSubscriptionByStripeId(subscriptionId)

  if (!subscription) {
    throw new Error('Subscription not found in database')
  }

  return await updateSubscriptionStatusQuery(
    subscription.id,
    status,
    periodData
  )
}

/**
 * Cancel a subscription.
 *
 * Updates status to 'canceled' and deactivates all billing assignments.
 *
 * @param subscriptionId - Stripe subscription ID
 * @param cancelInStripe - Whether to also cancel in Stripe
 * @param accountType - Stripe account type (required if cancelInStripe is true)
 * @returns Cancellation result
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelInStripe: boolean = false,
  accountType?: StripeAccountType
): Promise<{ canceled: boolean; canceledInStripe: boolean }> {
  // Update database status
  await updateSubscriptionStatus(subscriptionId, 'canceled')

  let canceledInStripe = false

  // Optionally cancel in Stripe
  if (cancelInStripe) {
    if (!accountType) {
      throw new Error('Account type required when canceling in Stripe')
    }

    const stripe = getStripeClient(accountType)
    await stripe.subscriptions.cancel(subscriptionId)
    canceledInStripe = true
  }

  return {
    canceled: true,
    canceledInStripe,
  }
}

/**
 * Check if subscription is active.
 *
 * @param subscriptionId - Stripe subscription ID
 * @returns True if subscription is active or trialing
 */
export async function isSubscriptionActive(
  subscriptionId: string
): Promise<boolean> {
  const subscription = await getSubscriptionByStripeId(subscriptionId)

  if (!subscription) {
    return false
  }

  return subscription.status === 'active' || subscription.status === 'trialing'
}
