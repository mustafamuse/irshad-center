import type {
  ContactType,
  ContactVerificationStatus,
  GuardianRole,
} from '@prisma/client'

/**
 * Person - Canonical identity record for students, guardians, donors, youth participants
 */
export interface Person {
  id: string
  name: string
  dateOfBirth: Date | null
  createdAt: Date
  updatedAt: Date
}

/**
 * ContactPoint - Email, phone, or other contact methods for a person
 */
export interface ContactPoint {
  id: string
  personId: string
  type: ContactType
  value: string // Email address or phone number
  isPrimary: boolean
  verificationStatus: ContactVerificationStatus
  verifiedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/**
 * GuardianRelationship - Links guardians/donors to dependents
 */
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

/**
 * Person with related data
 */
export interface PersonWithRelations extends Person {
  contactPoints: ContactPoint[]
  guardianRelationships: GuardianRelationship[]
  dependentRelationships: GuardianRelationship[]
}

/**
 * Helper to get primary email from contact points
 */
export function getPrimaryEmail(contactPoints: ContactPoint[]): string | null {
  const email = contactPoints.find(
    (cp) =>
      cp.type === 'EMAIL' && cp.isPrimary && cp.verificationStatus !== 'INVALID'
  )
  return email?.value || null
}

/**
 * Helper to get primary phone from contact points
 */
export function getPrimaryPhone(contactPoints: ContactPoint[]): string | null {
  const phone = contactPoints.find(
    (cp) =>
      (cp.type === 'PHONE' || cp.type === 'WHATSAPP') &&
      cp.isPrimary &&
      cp.verificationStatus !== 'INVALID'
  )
  return phone?.value || null
}

/**
 * Helper to normalize phone number for matching
 *
 * Validates phone number length (10-15 digits for E.164 compatibility)
 * Returns null for invalid phone numbers
 *
 * @param phone - Raw phone number string
 * @returns Normalized digits-only string, or null if invalid
 */
export function normalizePhone(
  phone: string | null | undefined
): string | null {
  if (!phone) return null
  const normalized = phone.replace(/\D/g, '')

  // Validate length: E.164 format allows 10-15 digits
  // 10 digits = US/Canada without country code
  // 11 digits = US/Canada with country code (1)
  // 15 digits = max E.164 length
  if (normalized.length < 10 || normalized.length > 15) {
    return null
  }

  return normalized
}
