/**
 * Contact Normalization Utilities
 *
 * Centralized contact data normalization to ensure consistency
 * across the application. Prevents duplication of normalization logic.
 */

import { ContactType } from '@prisma/client'

import { normalizePhone as normalizePhoneNumber } from '@/lib/types/person'

/**
 * Normalize an email address.
 *
 * Converts to lowercase and trims whitespace for consistent storage
 * and comparison. Email addresses are case-insensitive per RFC 5321.
 *
 * @param email - Email address to normalize
 * @returns Normalized email address (lowercase, trimmed)
 */
export function normalizeEmail(
  email: string | null | undefined
): string | null {
  if (!email) return null
  return email.toLowerCase().trim()
}

/**
 * Normalize a phone number.
 *
 * Removes all non-digit characters for consistent storage and comparison.
 * Re-exports from lib/types/person for convenience.
 *
 * Examples:
 * - "(555) 123-4567" → "5551234567"
 * - "+1 555 123 4567" → "15551234567"
 * - "555.123.4567" → "5551234567"
 *
 * @param phone - Phone number to normalize
 * @returns Normalized phone number (digits only)
 */
export function normalizePhone(
  phone: string | null | undefined
): string | null {
  return normalizePhoneNumber(phone)
}

/**
 * Normalize a contact value based on its type.
 *
 * Dispatches to the appropriate normalization function based on contact type.
 * Useful for generic contact processing where type is known at runtime.
 *
 * @param value - Contact value to normalize
 * @param type - Contact type (EMAIL, PHONE, etc.)
 * @returns Normalized contact value
 */
export function normalizeContact(
  value: string | null | undefined,
  type: ContactType
): string | null {
  if (!value) return null

  switch (type) {
    case 'EMAIL':
      return normalizeEmail(value)
    case 'PHONE':
    case 'WHATSAPP':
      return normalizePhone(value)
    case 'OTHER':
      // For other types, just trim whitespace
      return value.trim() || null
    default:
      return value.trim() || null
  }
}

/**
 * Validate and normalize an email address.
 *
 * Checks basic email format before normalization.
 *
 * @param email - Email address to validate and normalize
 * @returns Normalized email or null if invalid
 */
export function validateAndNormalizeEmail(
  email: string | null | undefined
): string | null {
  if (!email) return null

  const normalized = normalizeEmail(email)
  if (!normalized) return null

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(normalized) ? normalized : null
}

/**
 * Validate and normalize a phone number.
 *
 * Checks that phone has enough digits after normalization.
 *
 * @param phone - Phone number to validate and normalize
 * @param minDigits - Minimum number of digits required (default: 10)
 * @returns Normalized phone or null if invalid
 */
export function validateAndNormalizePhone(
  phone: string | null | undefined,
  minDigits: number = 10
): string | null {
  if (!phone) return null

  const normalized = normalizePhone(phone)
  if (!normalized) return null

  // Check minimum digits
  return normalized.length >= minDigits ? normalized : null
}
