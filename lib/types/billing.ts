import type {
  StripeAccountType,
  SubscriptionStatus,
  Program,
} from '@prisma/client'

/**
 * BillingAccount - Represents a payer entity
 */
export interface BillingAccount {
  id: string
  personId: string | null
  accountType: StripeAccountType

  // Stripe customer IDs per account type
  stripeCustomerIdMahad: string | null
  stripeCustomerIdDugsi: string | null
  stripeCustomerIdYouth: string | null
  stripeCustomerIdDonation: string | null

  // ACH/Bank account info (for Dugsi)
  paymentIntentIdDugsi: string | null
  paymentMethodCaptured: boolean
  paymentMethodCapturedAt: Date | null

  // Primary contact preference
  primaryContactPointId: string | null

  notes: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Subscription - Stripe subscription record
 */
export interface Subscription {
  id: string
  billingAccountId: string
  stripeAccountType: StripeAccountType
  stripeSubscriptionId: string
  stripeCustomerId: string
  status: SubscriptionStatus
  amount: number // Amount in cents
  currency: string
  interval: string

  // Period tracking
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  paidUntil: Date | null
  lastPaymentDate: Date | null

  // History tracking
  previousSubscriptionIds: string[]

  createdAt: Date
  updatedAt: Date
}

/**
 * BillingAssignment - Links subscriptions to program profiles
 */
export interface BillingAssignment {
  id: string
  subscriptionId: string
  programProfileId: string
  amount: number // Amount allocated to this profile (in cents)
  percentage: number | null // Percentage of subscription allocated
  isActive: boolean
  startDate: Date
  endDate: Date | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * SubscriptionHistory - Audit log of Stripe events
 */
export interface SubscriptionHistory {
  id: string
  subscriptionId: string
  eventType: string
  eventId: string
  status: SubscriptionStatus
  amount: number | null
  metadata: Record<string, unknown> | null
  processedAt: Date
}

/**
 * BillingAccount with related data
 */
export interface BillingAccountWithRelations extends BillingAccount {
  person: {
    id: string
    name: string
  } | null
  subscriptions: Subscription[]
  assignments: Array<
    BillingAssignment & {
      programProfile: {
        id: string
        program: Program
        personId: string
      }
    }
  >
}

/**
 * Subscription with related data
 */
export interface SubscriptionWithRelations extends Subscription {
  billingAccount: BillingAccount
  assignments: Array<
    BillingAssignment & {
      programProfile: {
        id: string
        program: Program
        personId: string
      }
    }
  >
}

/**
 * Helper to get Stripe customer ID for a specific account type
 */
export function getStripeCustomerId(
  account: BillingAccount,
  accountType: StripeAccountType
): string | null {
  switch (accountType) {
    case 'MAHAD':
      return account.stripeCustomerIdMahad
    case 'DUGSI':
      return account.stripeCustomerIdDugsi
    case 'YOUTH_EVENTS':
      return account.stripeCustomerIdYouth
    case 'GENERAL_DONATION':
      return account.stripeCustomerIdDonation
    default:
      return null
  }
}

/**
 * Helper to check if subscription is active
 */
export function isActiveSubscription(subscription: Subscription): boolean {
  return subscription.status === 'active' || subscription.status === 'trialing'
}

/**
 * Helper to get total amount allocated across assignments
 */
export function getTotalAllocatedAmount(
  assignments: BillingAssignment[]
): number {
  return assignments
    .filter((a) => a.isActive)
    .reduce((sum, a) => sum + a.amount, 0)
}
