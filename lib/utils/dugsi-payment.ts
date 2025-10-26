/**
 * Dugsi Payment Utilities
 *
 * Helper functions for Dugsi payment processing and family management.
 */

/**
 * Generate a unique family reference ID.
 * Format: {timestamp}_{randomComponent}_{cleanedLastName}
 *
 * The random component helps prevent collisions when multiple families
 * register in the same millisecond.
 *
 * @param lastName - The family's last name
 * @returns A unique family reference ID
 */
export function generateFamilyId(lastName: string): string {
  // Input validation
  if (!lastName || typeof lastName !== 'string') {
    lastName = 'family'
  }

  // Generate a timestamp in base36 for uniqueness
  const timestamp = Date.now().toString(36)

  // Add random component to prevent same-millisecond collisions
  const randomComponent = Math.random().toString(36).substring(2, 6)

  // Clean the last name: lowercase, remove non-alphanumeric, limit length
  const cleanLastName = lastName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()
    .substring(0, 20) // Limit to 20 chars to keep ID reasonable length

  const familyName = cleanLastName || 'family'

  return `${timestamp}_${randomComponent}_${familyName}`
}

/**
 * Parse a family reference ID to extract components.
 *
 * @param referenceId - The client_reference_id from Stripe
 * @returns Parsed components or null if invalid format
 */
export function parseDugsiReferenceId(referenceId: string): {
  familyId: string
  childCount: number
} | null {
  // Expected format: dugsi_{timestamp}_{random}_{lastName}_{n}kid(s)
  // We need to capture the full family ID (timestamp_random_lastName)
  const match = referenceId.match(/^dugsi_([^_]+_[^_]+_[^_]+)_(\d+)kids?$/)

  if (!match) {
    return null
  }

  return {
    familyId: match[1],
    childCount: parseInt(match[2], 10),
  }
}

/**
 * Export the constructDugsiPaymentUrl from stripe-dugsi for convenience
 */
export { constructDugsiPaymentUrl } from '@/lib/stripe-dugsi'
