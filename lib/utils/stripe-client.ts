import { StripeAccountType } from '@prisma/client'
import Stripe from 'stripe'

import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import { getMahadStripeClient } from '@/lib/stripe-mahad'

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
