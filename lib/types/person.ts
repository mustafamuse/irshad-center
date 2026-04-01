import type { GuardianRole } from '@prisma/client'

export interface Person {
  id: string
  name: string
  email: string | null
  phone: string | null
  dateOfBirth: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface GuardianRelationship {
  id: string
  guardianId: string
  dependentId: string
  role: GuardianRole
  startDate: Date
  endDate: Date | null
  isActive: boolean
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export interface PersonWithRelations extends Person {
  guardianRelationships: GuardianRelationship[]
  dependentRelationships: GuardianRelationship[]
}

/**
 * Normalize phone to digits-only. Strips NANP country code (1) from 11-digit numbers.
 * Returns null for invalid numbers (only 10-digit US numbers or 11-digit with leading '1' accepted).
 */
export function normalizePhone(
  phone: string | null | undefined
): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits.length === 10 ? digits : null
}
