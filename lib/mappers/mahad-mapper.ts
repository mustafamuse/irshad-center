/**
 * Mahad Mappers
 *
 * Pure data transformation functions for Mahad program.
 * These functions transform database entities to DTOs (Data Transfer Objects).
 *
 * Rules:
 * - No database calls
 * - No business logic
 * - Pure functions only
 * - Type-safe inputs (no `any`)
 */

import { Prisma } from '@prisma/client'

/**
 * Prisma include for Mahad enrollment with full relations
 */
export const mahadEnrollmentInclude =
  Prisma.validator<Prisma.EnrollmentInclude>()({
    programProfile: {
      include: {
        person: {
          include: {
            contactPoints: true,
          },
        },
        assignments: {
          where: { isActive: true },
          include: {
            subscription: true,
          },
          take: 1,
        },
      },
    },
    batch: true,
  })

/**
 * Type for Mahad enrollment with full relations
 */
export type MahadEnrollmentFull = Prisma.EnrollmentGetPayload<{
  include: typeof mahadEnrollmentInclude
}>

/**
 * Mahad student DTO
 * Flattened structure for UI display
 */
export interface MahadStudent {
  id: string
  name: string
  email: string | null
  phone: string | null
  dateOfBirth: Date | null
  gradeLevel: string | null
  schoolName: string | null
  // Billing fields
  graduationStatus: string | null
  paymentFrequency: string | null
  billingType: string | null
  paymentNotes: string | null
  enrollmentId: string
  enrollmentStatus: string
  enrollmentStartDate: Date
  batch: {
    id: string
    name: string
    startDate: Date | null
    endDate: Date | null
  } | null
  subscription: {
    id: string
    status: string
    amount: number
    paidUntil: Date | null
  } | null
}

/**
 * Maps an Enrollment (with programProfile and batch) to a MahadStudent DTO.
 *
 * This is a pure data transformation - no database calls, no business logic.
 * Used to transform query results into UI-friendly format.
 *
 * @param enrollment - Enrollment with programProfile, person, batch, and assignments
 * @returns MahadStudent DTO for UI display
 */
export function mapEnrollmentToMahadStudent(
  enrollment: MahadEnrollmentFull
): MahadStudent {
  const profile = enrollment.programProfile
  const person = profile.person

  // Extract contact information
  const emailContact = person.contactPoints?.find((cp) => cp.type === 'EMAIL')
  const phoneContact = person.contactPoints?.find(
    (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
  )

  // Extract active subscription
  const activeAssignment = profile.assignments[0]
  const subscription = activeAssignment?.subscription

  return {
    id: profile.id,
    name: person.name,
    email: emailContact?.value ?? null,
    phone: phoneContact?.value ?? null,
    dateOfBirth: person.dateOfBirth,
    gradeLevel: profile.gradeLevel,
    schoolName: profile.schoolName,
    // Billing fields
    graduationStatus: profile.graduationStatus,
    paymentFrequency: profile.paymentFrequency,
    billingType: profile.billingType,
    paymentNotes: profile.paymentNotes,
    enrollmentId: enrollment.id,
    enrollmentStatus: enrollment.status,
    enrollmentStartDate: enrollment.startDate,
    batch: enrollment.batch
      ? {
          id: enrollment.batch.id,
          name: enrollment.batch.name,
          startDate: enrollment.batch.startDate,
          endDate: enrollment.batch.endDate,
        }
      : null,
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          amount: subscription.amount,
          paidUntil: subscription.paidUntil,
        }
      : null,
  }
}

/**
 * Maps an array of enrollments to MahadStudent DTOs.
 *
 * @param enrollments - Array of enrollments
 * @returns Array of MahadStudent DTOs
 */
export function mapEnrollmentsToMahadStudents(
  enrollments: MahadEnrollmentFull[]
): MahadStudent[] {
  return enrollments.map(mapEnrollmentToMahadStudent)
}

/**
 * Helper to extract primary contact email from program profile.
 *
 * @param profile - ProgramProfile with person and contactPoints
 * @returns Email address or null
 */
export function extractStudentEmail(
  profile: Pick<MahadEnrollmentFull['programProfile'], 'person'>
): string | null {
  const emailContact = profile.person.contactPoints?.find(
    (cp) => cp.type === 'EMAIL'
  )
  return emailContact?.value ?? null
}

/**
 * Helper to extract primary phone from program profile.
 *
 * @param profile - ProgramProfile with person and contactPoints
 * @returns Phone number or null
 */
export function extractStudentPhone(
  profile: Pick<MahadEnrollmentFull['programProfile'], 'person'>
): string | null {
  const phoneContact = profile.person.contactPoints?.find(
    (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
  )
  return phoneContact?.value ?? null
}
