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
  isActive: boolean // Soft-delete: allows email/phone reuse after deactivation
  deactivatedAt: Date | null // When contact was deactivated (null if active)
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
 * Validates phone number length and format (E.164 compatibility)
 * Returns null for invalid phone numbers
 *
 * Validation rules:
 * - 10 digits: US/Canada without country code (valid)
 * - 11 digits starting with 1: US/Canada with country code (valid)
 * - 11 digits not starting with 1: Invalid (country code mismatch)
 * - 12-15 digits: International numbers (valid)
 * - <10 or >15 digits: Invalid
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
  if (normalized.length < 10 || normalized.length > 15) {
    return null
  }

  // Validate US/Canada country code
  // 11-digit numbers must start with 1 (NANP country code)
  if (normalized.length === 11 && !normalized.startsWith('1')) {
    return null
  }

  return normalized
}
