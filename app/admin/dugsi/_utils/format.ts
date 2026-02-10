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

export interface OrderedParent {
  parentNumber: 1 | 2
  name: string
  email: string | null
  phone: string | null
}

export function getOrderedParentData(
  member: DugsiRegistration
): OrderedParent[] {
  const parents: OrderedParent[] = [
    {
      parentNumber: 1,
      name: formatParentName(member.parentFirstName, member.parentLastName),
      email: member.parentEmail,
      phone: member.parentPhone,
    },
  ]

  if (hasSecondParent(member)) {
    parents.push({
      parentNumber: 2,
      name: formatParentName(member.parent2FirstName, member.parent2LastName),
      email: member.parent2Email,
      phone: member.parent2Phone,
    })

    if (member.primaryPayerParentNumber === 2) {
      parents.reverse()
    }
  }

  return parents
}

export function getOrderedParentNames(member: DugsiRegistration | undefined): {
  payer: string
  other: string
} {
  if (!member) return { payer: '', other: '' }
  const parent1 = formatParentName(
    member.parentFirstName,
    member.parentLastName
  )
  const parent2 = formatParentName(
    member.parent2FirstName,
    member.parent2LastName
  )
  if (member.primaryPayerParentNumber === 2 && parent2) {
    return { payer: parent2, other: parent1 }
  }
  return { payer: parent1, other: parent2 }
}

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
