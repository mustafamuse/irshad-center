import type { ContactType, ContactVerificationStatus, GuardianRole, Program } from '@prisma/client'

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
    (cp) => cp.type === 'EMAIL' && cp.isPrimary && cp.verificationStatus !== 'INVALID'
  )
  return email?.value || null
}

/**
 * Helper to get primary phone from contact points
 */
export function getPrimaryPhone(contactPoints: ContactPoint[]): string | null {
  const phone = contactPoints.find(
    (cp) => (cp.type === 'PHONE' || cp.type === 'WHATSAPP') && cp.isPrimary && cp.verificationStatus !== 'INVALID'
  )
  return phone?.value || null
}

/**
 * Helper to normalize phone number for matching
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  return phone.replace(/\D/g, '')
}



