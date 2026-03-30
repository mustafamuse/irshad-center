import type {
  ContactType,
  ContactVerificationStatus,
  GuardianRole,
} from '@prisma/client'

export interface Person {
  id: string
  name: string
  dateOfBirth: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface ContactPoint {
  id: string
  personId: string
  type: ContactType
  value: string // Email address or phone number
  isPrimary: boolean
  verificationStatus: ContactVerificationStatus
  verifiedAt: Date | null
  isActive: boolean // Soft-delete: allows email/phone reuse after deactivation
  deactivatedAt: Date | null // When contact was deactivated (null if active)
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
  contactPoints: ContactPoint[]
  guardianRelationships: GuardianRelationship[]
  dependentRelationships: GuardianRelationship[]
}

/**
 * Normalize phone to digits-only. Strips NANP country code (1) from 11-digit numbers.
 * Returns null for invalid numbers (<10 or >15 digits, or 11-digit non-NANP).
 */
export function normalizePhone(
  phone: string | null | undefined
): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits.length === 10 ? digits : null
}
