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

interface ContactPointLike {
  type: string
  value: string
  isPrimary?: boolean
}

export function getPrimaryEmail(
  contactPoints: ContactPointLike[] | null | undefined
): string | null {
  if (!contactPoints) return null
  const primary = contactPoints.find(
    (cp) => cp.type === 'EMAIL' && cp.isPrimary
  )
  return (
    primary?.value ||
    contactPoints.find((cp) => cp.type === 'EMAIL')?.value ||
    null
  )
}

export function getPrimaryPhone(
  contactPoints: ContactPointLike[] | null | undefined
): string | null {
  if (!contactPoints) return null
  const isPhone = (cp: ContactPointLike) =>
    cp.type === 'PHONE' || cp.type === 'WHATSAPP'
  const primary = contactPoints.find((cp) => isPhone(cp) && cp.isPrimary)
  return primary?.value || contactPoints.find(isPhone)?.value || null
}

export function getContactInfo(
  contactPoints: ContactPointLike[] | null | undefined
): { email: string | null; phone: string | null } {
  return {
    email: getPrimaryEmail(contactPoints),
    phone: getPrimaryPhone(contactPoints),
  }
}

/**
 * Normalize phone to digits-only. Strips NANP country code (1) from 11-digit numbers.
 * Returns null for invalid numbers (<10 or >15 digits, or 11-digit non-NANP).
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

  // 11-digit numbers: strip NANP country code 1, reject all others
  // Changed from storing '1XXXXXXXXXX' to '10-digit'. Run scripts/migrate-phone-numbers.ts post-deploy.
  if (normalized.length === 11) {
    return normalized.startsWith('1') ? normalized.slice(1) : null
  }

  return normalized
}
