/**
 * Dugsi Validation Utilities
 *
 * Centralized validation logic for Dugsi server actions.
 * Reduces duplication and standardizes error messages.
 */

import { isValidEmail } from '@/lib/utils/type-guards'

/**
 * Validate email format for Dugsi operations.
 *
 * @param email - Email address to validate
 * @returns Error message if invalid, null if valid
 *
 * @example
 * ```typescript
 * const error = validateDugsiEmail(params.parentEmail)
 * if (error) {
 *   return { success: false, error }
 * }
 * ```
 */
export function validateDugsiEmail(
  email: string | null | undefined
): string | null {
  if (!email) {
    return 'Email address is required'
  }

  if (!isValidEmail(email)) {
    return 'Valid email address is required'
  }

  return null
}

/**
 * Validate that a program profile exists and is a Dugsi profile.
 *
 * @param profile - ProgramProfile record from database
 * @returns Error message if invalid, null if valid
 *
 * @example
 * ```typescript
 * const profile = await getProgramProfileById(studentId)
 * const error = validateDugsiProfile(profile)
 * if (error) {
 *   return { success: false, error }
 * }
 * ```
 */
export function validateDugsiProfile(
  profile: { program: string } | null | undefined
): string | null {
  if (!profile) {
    return 'Student not found'
  }

  if (profile.program !== 'DUGSI_PROGRAM') {
    return 'Student not found'
  }

  return null
}

/**
 * Validate Stripe payment intent ID format.
 *
 * @param paymentIntentId - Stripe payment intent ID
 * @returns Error message if invalid, null if valid
 *
 * @example
 * ```typescript
 * const error = validatePaymentIntentId(paymentIntentId)
 * if (error) {
 *   return { success: false, error }
 * }
 * ```
 */
export function validatePaymentIntentId(
  paymentIntentId: string | null | undefined
): string | null {
  if (!paymentIntentId) {
    return 'Payment intent ID is required'
  }

  if (!paymentIntentId.startsWith('pi_')) {
    return 'Invalid payment intent ID format. Must start with "pi_"'
  }

  return null
}

/**
 * Validate bank descriptor code format (6 characters, starts with SM).
 *
 * @param descriptorCode - Bank descriptor code from statement
 * @returns Object with error and cleaned code
 *
 * @example
 * ```typescript
 * const { error, cleanCode } = validateDescriptorCode(code)
 * if (error) {
 *   return { success: false, error }
 * }
 * // Use cleanCode for API call
 * ```
 */
export function validateDescriptorCode(
  descriptorCode: string | null | undefined
): { error: string | null; cleanCode: string } {
  if (!descriptorCode) {
    return {
      error: 'Descriptor code is required',
      cleanCode: '',
    }
  }

  const cleanCode = descriptorCode.trim().toUpperCase()

  if (!/^SM[A-Z0-9]{4}$/.test(cleanCode)) {
    return {
      error:
        'Invalid descriptor code format. Must be 6 characters starting with SM (e.g., SMT86W)',
      cleanCode,
    }
  }

  return { error: null, cleanCode }
}

/**
 * Validate that a family reference ID exists.
 *
 * @param familyReferenceId - Family reference ID from profile
 * @returns Error message if invalid, null if valid
 *
 * @example
 * ```typescript
 * const error = validateFamilyReferenceId(profile.familyReferenceId)
 * if (error) {
 *   return { success: false, error }
 * }
 * ```
 */
export function validateFamilyReferenceId(
  familyReferenceId: string | null | undefined
): string | null {
  if (!familyReferenceId) {
    return 'Family reference ID not found'
  }

  return null
}

/**
 * Validate that parent email exists (not null/undefined).
 *
 * @param parentEmail - Parent email from profile
 * @returns Error message if invalid, null if valid
 *
 * @example
 * ```typescript
 * const error = validateParentEmailExists(firstMember.parentEmail)
 * if (error) {
 *   return { success: false, error }
 * }
 * ```
 */
export function validateParentEmailExists(
  parentEmail: string | null | undefined
): string | null {
  if (!parentEmail) {
    return 'Parent email is required to generate payment link'
  }

  return null
}

/**
 * Validate Stripe subscription ID format.
 *
 * @param subscriptionId - Stripe subscription ID
 * @returns Error message if invalid, null if valid
 *
 * @example
 * ```typescript
 * const error = validateSubscriptionId(params.subscriptionId)
 * if (error) {
 *   return { success: false, error }
 * }
 * ```
 */
export function validateSubscriptionId(
  subscriptionId: string | null | undefined
): string | null {
  if (!subscriptionId) {
    return 'Subscription ID is required'
  }

  if (!subscriptionId.startsWith('sub_')) {
    return 'Invalid subscription ID format. Must start with "sub_"'
  }

  return null
}

/**
 * Validate environment variable exists.
 *
 * @param varName - Environment variable name
 * @param value - Environment variable value
 * @param errorMessage - Custom error message
 * @returns Error message if invalid, null if valid
 *
 * @example
 * ```typescript
 * const error = validateEnvVar(
 *   'NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI',
 *   process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI,
 *   'Payment link not configured'
 * )
 * if (error) {
 *   return { success: false, error }
 * }
 * ```
 */
export function validateEnvVar(
  varName: string,
  value: string | undefined,
  errorMessage: string
): string | null {
  if (!value) {
    return `${errorMessage}. Please set ${varName} in environment variables.`
  }

  return null
}
