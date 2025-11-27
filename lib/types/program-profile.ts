import type {
  Program,
  Gender,
  GradeLevel,
  EnrollmentStatus,
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
} from '@prisma/client'

/**
 * ProgramProfile - One per person per program/initiative
 */
export interface ProgramProfile {
  id: string
  personId: string
  program: Program
  status: EnrollmentStatus // Normalized to use EnrollmentStatus enum

  // Program-specific typed fields
  gender: Gender | null
  gradeLevel: GradeLevel | null
  schoolName: string | null

  // Mahad-specific billing fields
  graduationStatus: GraduationStatus | null
  paymentFrequency: PaymentFrequency | null
  billingType: StudentBillingType | null
  paymentNotes: string | null

  // Dugsi-specific fields
  healthInfo: string | null
  familyReferenceId: string | null

  // Metadata for initiative-specific fields (JSONB)
  metadata: Record<string, unknown> | null

  createdAt: Date
  updatedAt: Date
}

/**
 * ProgramProfile with related data
 */
export interface ProgramProfileWithRelations extends ProgramProfile {
  person: {
    id: string
    name: string
    dateOfBirth: Date | null
  }
  enrollments: Array<{
    id: string
    status: EnrollmentStatus
    startDate: Date
    endDate: Date | null
    batchId: string | null
  }>
  assignments?: Array<{
    id: string
    subscriptionId: string
    amount: number
    isActive: boolean
  }>
}

/**
 * Program-specific metadata schemas
 * These define what fields are allowed in the metadata JSONB column
 *
 * The metadata field (ProgramProfile.metadata) is a flexible JSONB column that allows
 * program-specific fields without requiring schema migrations. Each program can define
 * its own metadata structure.
 */
export interface ProgramMetadataConfig {
  program: Program
  fields: Array<{
    key: string
    label: string
    type: 'string' | 'number' | 'boolean' | 'date' | 'select'
    required?: boolean
    options?: Array<{ value: string; label: string }>
    validation?: (value: unknown) => boolean
  }>
}

/**
 * Type-safe metadata structures per program
 * These types define the expected structure of metadata for each program
 */
export interface MahadMetadata {
  // Mahad-specific metadata fields can be added here
  // Example: scholarshipInfo, housingStatus, etc.
  [key: string]: unknown
}

export interface DugsiMetadata {
  // Dugsi-specific metadata fields can be added here
  // Example: transportationMethod, specialNeeds, etc.
  [key: string]: unknown
}

export interface YouthEventsMetadata {
  // Youth Events-specific metadata fields
  [key: string]: unknown
}

export interface GeneralDonationMetadata {
  // General Donation-specific metadata fields
  [key: string]: unknown
}

/**
 * Union type for all program metadata
 */
export type ProgramMetadata =
  | MahadMetadata
  | DugsiMetadata
  | YouthEventsMetadata
  | GeneralDonationMetadata

/**
 * Type guard to check metadata structure based on program
 */
export function getMetadataForProgram(
  program: Program,
  metadata: Record<string, unknown> | null
): ProgramMetadata | null {
  if (!metadata) return null

  switch (program) {
    case 'MAHAD_PROGRAM':
      return metadata as MahadMetadata
    case 'DUGSI_PROGRAM':
      return metadata as DugsiMetadata
    case 'YOUTH_EVENTS':
      return metadata as YouthEventsMetadata
    case 'GENERAL_DONATION':
      return metadata as GeneralDonationMetadata
    default:
      return metadata as ProgramMetadata
  }
}

/**
 * Helper to check if a profile is for Mahad program
 */
export function isMahadProfile(profile: ProgramProfile): boolean {
  return profile.program === 'MAHAD_PROGRAM'
}

/**
 * Helper to check if a profile is for Dugsi program
 */
export function isDugsiProfile(profile: ProgramProfile): boolean {
  return profile.program === 'DUGSI_PROGRAM'
}

/**
 * Helper to get active enrollment for a profile
 */
export function getActiveEnrollment(
  profile: ProgramProfileWithRelations
): ProgramProfileWithRelations['enrollments'][0] | null {
  return (
    profile.enrollments.find((e) => e.status === 'ENROLLED' && !e.endDate) ||
    null
  )
}
