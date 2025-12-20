/**
 * Shared Formatting Utilities
 *
 * Common formatting functions used across the application
 */

import { format } from 'date-fns'

/**
 * Format a date value to a consistent display format
 * @param value - Date, string, or null
 * @returns Formatted date string or em dash if null/invalid
 */
export function formatDate(value: Date | string | null): string {
  if (!value) return '—'

  try {
    const date = value instanceof Date ? value : new Date(value)
    if (isNaN(date.getTime())) return '—'
    return format(date, 'MMM d, yyyy')
  } catch {
    return '—'
  }
}

/**
 * Format a datetime value to a consistent display format
 * @param value - Date, string, or null
 * @returns Formatted datetime string or em dash if null/invalid
 */
export function formatDateTime(value: Date | string | null): string {
  if (!value) return '—'

  try {
    const date = value instanceof Date ? value : new Date(value)
    if (isNaN(date.getTime())) return '—'
    return format(date, 'MMM d, yyyy h:mm a')
  } catch {
    return '—'
  }
}

/**
 * Calculate age from date of birth
 * @param dateOfBirth - Date, string, or null
 * @returns Age string or 'N/A' if invalid
 */
export function calculateAge(dateOfBirth: Date | string | null): string {
  if (!dateOfBirth) return 'N/A'

  try {
    const birthDate =
      dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth)

    if (isNaN(birthDate.getTime())) return 'N/A'

    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    // Adjust age if birthday hasn't occurred this year yet
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--
    }

    return `${age} years old`
  } catch {
    return 'N/A'
  }
}

/**
 * Format currency amount
 * @param amount - Amount in cents
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount / 100)
}

/**
 * Format phone number for display
 * @param phone - Phone number string
 * @returns Formatted phone number or original if invalid
 */
export function formatPhoneNumber(phone: string | null): string {
  if (!phone) return '—'

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '')

  // Format as (XXX) XXX-XXXX if US number
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  // Return original if not standard US format
  return phone
}

/**
 * Get last 4 digits of phone number for comparison
 * @param phone - Phone number string
 * @returns Last 4 digits or empty string
 */
export function getPhoneLast4(phone: string | null): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  return digits.slice(-4)
}

/**
 * Truncate string with ellipsis
 * @param str - String to truncate
 * @param length - Maximum length
 * @returns Truncated string with ellipsis if needed
 */
export function truncateString(str: string, length: number): string {
  if (str.length <= length) return str
  return `${str.slice(0, length)}...`
}

/**
 * Format full name from first and last name
 * @param firstName - First name or null
 * @param lastName - Last name or null
 * @param fallback - Value to return if both names are missing (default: '')
 * @returns Formatted full name or fallback
 * @example
 * formatFullName(null, null, 'Parent') // 'Parent'
 */
export function formatFullName(
  firstName: string | null,
  lastName: string | null,
  fallback: string = ''
): string {
  return [firstName, lastName].filter(Boolean).join(' ') || fallback
}

/**
 * Get initials from name
 * @param name - Full name
 * @returns Initials (up to 2 characters)
 */
export function getInitials(name: string): string {
  if (!name) return ''

  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return ''

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase()
  }

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/**
 * Format enum value to human-readable string
 * Converts UPPER_SNAKE_CASE to Title Case
 * @param value - Enum value or null
 * @param notSpecifiedText - Text to display when value is null/empty
 * @returns Formatted string
 * @example
 * formatEnumValue(null) // 'Not specified'
 */
export function formatEnumValue(
  value: string | null,
  notSpecifiedText = 'Not specified'
): string {
  if (!value) return notSpecifiedText

  return value
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}
