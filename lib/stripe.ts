/**
 * Stripe Client (Legacy Re-export)
 *
 * @deprecated This module is deprecated. Use the following instead:
 * - For Mahad: import { getMahadStripeClient } from '@/lib/stripe-mahad'
 * - For Dugsi: import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
 * - For any account type: import { getStripeClient } from '@/lib/utils/stripe-client'
 *
 * This file exists for backward compatibility and will be removed in a future release.
 */

import { getMahadStripeClient, stripeServerClient } from '@/lib/stripe-mahad'

/**
 * @deprecated Use getMahadStripeClient() from '@/lib/stripe-mahad' instead
 */
export function getStripeClient() {
  return getMahadStripeClient()
}

/**
 * @deprecated Use getMahadStripeClient() from '@/lib/stripe-mahad' instead
 */
export { stripeServerClient }
