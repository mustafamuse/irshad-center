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
 * Normalize phone to E.164 format (+XXXXXXXXXXX).
 * - 10 digits → assumed US → +1XXXXXXXXXX
 * - 11 digits starting with 1 (NANP) → +1XXXXXXXXXX
 * - Already E.164 (+X...) → validate digit count (7-15), return normalized
 * - 11-15 digits without + → international with country code already embedded
 * Returns null for invalid or empty input.
 */
export function normalizePhone(
  phone: string | null | undefined
): string | null {
  if (!phone) return null
  const cleaned = phone.trim()

  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1).replace(/\D/g, '')
    if (digits.length >= 7 && digits.length <= 15) return `+${digits}`
    return null
  }

  const digits = cleaned.replace(/\D/g, '')

  if (digits.length === 10) return `+1${digits}`
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`
  return null
}
