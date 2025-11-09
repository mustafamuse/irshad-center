import { formatPhoneNumber } from '@/lib/registration/utils/form-utils'

/**
 * Format phone number for display in forms.
 * Handles null/undefined values and already formatted numbers.
 *
 * @param phone - Phone number string, null, or undefined
 * @returns Formatted phone number string (XXX-XXX-XXXX) or empty string
 */
export function formatPhoneForDisplay(
  phone: string | null | undefined
): string {
  if (!phone) return ''
  // If already formatted, return as is
  if (/^\d{3}-\d{3}-\d{4}$/.test(phone)) return phone
  // Otherwise format it
  return formatPhoneNumber(phone)
}
