import { StripeAccountType } from '@prisma/client'
import Stripe from 'stripe'

import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import { getMahadStripeClient } from '@/lib/stripe-mahad'

/**
 * BillingAccount shape for customer ID extraction
 */
interface BillingAccountWithCustomerIds {
  stripeCustomerIdMahad?: string | null
  stripeCustomerIdDugsi?: string | null
  stripeCustomerIdYouth?: string | null
  stripeCustomerIdDonation?: string | null
}

/**
 * Get Stripe customer ID from a billing account for the specified account type.
 *
 * Extracts the appropriate customer ID field based on the account type.
 * This utility eliminates duplicated switch statements across the codebase.
 *
 * @param billingAccount - Billing account with customer ID fields
 * @param accountType - The Stripe account type
 * @returns Customer ID string or null if not set
 *
 * @example
 * // Get Mahad customer ID
 * const customerId = getStripeCustomerId(billingAccount, 'MAHAD')
 * // Returns: "cus_ABC123xyz" or null
 *
 * @example
 * // Safe with null billing account
 * const customerId = getStripeCustomerId(null, 'DUGSI')
 * // Returns: null
 */
export function getStripeCustomerId(
  billingAccount: BillingAccountWithCustomerIds | null | undefined,
  accountType: StripeAccountType
): string | null {
  if (!billingAccount) return null

  switch (accountType) {
    case 'MAHAD':
      return billingAccount.stripeCustomerIdMahad ?? null
    case 'DUGSI':
      return billingAccount.stripeCustomerIdDugsi ?? null
    case 'YOUTH_EVENTS':
      return billingAccount.stripeCustomerIdYouth ?? null
    case 'GENERAL_DONATION':
      return billingAccount.stripeCustomerIdDonation ?? null
    default: {
      // Exhaustive check
      const _exhaustiveCheck: never = accountType
      return null
    }
  }
}

/**
 * Get Stripe client for the specified account type.
 *
 * Maps account types to their corresponding Stripe clients:
 * - MAHAD → Main Stripe account
 * - DUGSI → Dugsi Stripe Connect account
 * - YOUTH_EVENTS → Main Stripe account (default)
 * - GENERAL_DONATION → Main Stripe account (default)
 *
 * @param accountType - The Stripe account type
 * @returns Stripe client instance for the account type
 * @throws Error if account type is unsupported
 */
export function getStripeClient(accountType: StripeAccountType): Stripe {
  switch (accountType) {
    case 'MAHAD':
      return getMahadStripeClient()
    case 'DUGSI':
      return getDugsiStripeClient()
    case 'YOUTH_EVENTS':
    case 'GENERAL_DONATION':
      // Default to Mahad Stripe for now
      // Can be extended when these programs get separate accounts
      return getMahadStripeClient()
    default: {
      // Exhaustive check - if new StripeAccountType is added, TypeScript will error here
      const _exhaustiveCheck: never = accountType
      throw new Error(`Unsupported account type: ${_exhaustiveCheck}`)
    }
  }
}
