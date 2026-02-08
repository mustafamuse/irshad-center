/**
 * Formatting utilities for Dugsi registrations
 * Centralized formatting logic for consistent display
 */

import { format } from 'date-fns'

import { DATE_FORMAT } from '@/lib/constants/dugsi'
import { formatFullName } from '@/lib/utils/formatters'

import { DugsiRegistration } from '../_types'

/**
 * Format parent name from first and last name
 */
export function formatParentName(
  firstName: string | null,
  lastName: string | null
): string {
  return formatFullName(firstName, lastName, 'Not provided')
}

/**
 * Check if registration has second parent
 */
export function hasSecondParent(registration: DugsiRegistration): boolean {
  return !!(registration.parent2FirstName || registration.parent2LastName)
}

/**
 * Format date consistently
 */
export function formatRegistrationDate(date: Date | string | null): string {
  if (!date) return '—'
  const dateObj = date instanceof Date ? date : new Date(date)
  return format(dateObj, DATE_FORMAT)
}

const wholeUsdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function formatCentsWhole(cents: number): string {
  return wholeUsdFormatter.format(cents / 100)
}

export { formatCentsWhole }

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: Date | string | null): string {
  if (!dateOfBirth) return 'N/A'
  const birthDate =
    dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth)
  const today = new Date()

  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--
  }

  return `${age} years old`
}
