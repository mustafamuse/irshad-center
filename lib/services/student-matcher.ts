/**
 * Student Matcher (Legacy Re-export)
 *
 * @deprecated This module is deprecated. Use UnifiedMatcher instead:
 * import { unifiedMatcher } from '@/lib/services/shared/unified-matcher'
 *
 * This file exists for backward compatibility and will be removed in a future release.
 */

import type { Stripe } from 'stripe'

import { unifiedMatcher } from '@/lib/services/shared/unified-matcher'

/**
 * @deprecated Use UnifiedMatchResult from '@/lib/services/shared/unified-matcher' instead
 */
export interface StudentMatchResult {
  student: {
    id: string
    email?: string | null
    phone?: string | null
    stripeSubscriptionId?: string | null
  } | null
  matchMethod: 'phone' | 'email' | null
  validatedEmail: string | null
}

/**
 * @deprecated Use UnifiedMatcher from '@/lib/services/shared/unified-matcher' instead
 */
export class StudentMatcher {
  /**
   * @deprecated Use unifiedMatcher.findByCheckoutSession() instead
   */
  async findByCheckoutSession(
    session: Stripe.Checkout.Session
  ): Promise<StudentMatchResult> {
    // Use the unified matcher with MAHAD account type
    const result = await unifiedMatcher.findByCheckoutSession(session, 'MAHAD')

    // Convert to legacy format
    if (result.programProfile) {
      return {
        student: {
          id: result.programProfile.id,
          email: result.validatedEmail,
          phone: null,
          stripeSubscriptionId: null,
        },
        matchMethod:
          result.matchMethod === 'guardian' ? null : result.matchMethod,
        validatedEmail: result.validatedEmail,
      }
    }

    return {
      student: null,
      matchMethod: null,
      validatedEmail: result.validatedEmail,
    }
  }

  /**
   * @deprecated Use unifiedMatcher.logNoMatchFound() instead
   */
  logNoMatchFound(
    session: Stripe.Checkout.Session,
    subscriptionId: string
  ): void {
    unifiedMatcher.logNoMatchFound(session, subscriptionId, 'MAHAD')
  }
}

/**
 * @deprecated Use unifiedMatcher from '@/lib/services/shared/unified-matcher' instead
 */
export const studentMatcher = new StudentMatcher()
