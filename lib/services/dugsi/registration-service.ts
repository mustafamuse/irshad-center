/**
 * Dugsi Registration Service
 *
 * Business logic for managing Dugsi program registrations.
 * This service handles fetching, creating, and updating Dugsi registrations.
 *
 * Responsibilities:
 * - Fetch registrations with proper data loading
 * - Handle family-based registration queries
 * - Provide delete previews
 * - Manage registration status updates
 */

import { DugsiRegistration } from '@/app/admin/dugsi/_types'
import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import { programProfileFullInclude } from '@/lib/db/prisma-helpers'
import {
  getProgramProfileById,
  getProgramProfilesByFamilyId,
} from '@/lib/db/queries/program-profile'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { mapProfileToDugsiRegistration } from '@/lib/mappers/dugsi-mapper'

/**
 * Fetch all Dugsi registrations with full relations.
 *
 * Returns all program profiles with:
 * - Person and contact points
 * - Guardian relationships
 * - Enrollment data
 * - Billing assignments and subscriptions
 *
 * Uses a single optimized query to avoid N+1 problems.
 *
 * @security Authorization must be enforced at the API route/action layer.
 *
 * @returns Array of DugsiRegistration DTOs
 */
export async function getAllDugsiRegistrations(): Promise<DugsiRegistration[]> {
  const profiles = await prisma.programProfile.findMany({
    where: {
      program: DUGSI_PROGRAM,
    },
    include: programProfileFullInclude,
    orderBy: {
      createdAt: 'desc',
    },
  })

  // Map to DTOs
  const registrations: DugsiRegistration[] = []
  for (const profile of profiles) {
    const registration = mapProfileToDugsiRegistration(profile)
    if (registration) {
      registrations.push(registration)
    }
  }

  return registrations
}

/**
 * Get all family members for a given student.
 *
 * If student has a familyReferenceId, returns all students in that family.
 * Otherwise, returns just the single student.
 *
 * @security Authorization must be enforced at the API route/action layer.
 *
 * @param studentId - ProgramProfile ID
 * @returns Array of family member registrations
 */
export async function getFamilyMembers(
  studentId: string
): Promise<DugsiRegistration[]> {
  const profile = await getProgramProfileById(studentId)

  if (!profile || profile.program !== DUGSI_PROGRAM) {
    return []
  }

  const familyId = profile.familyReferenceId

  // No family reference - return just this student
  if (!familyId) {
    const registration = mapProfileToDugsiRegistration(profile)
    return registration ? [registration] : []
  }

  // Fetch all family profiles with full relations
  const familyProfiles = await prisma.programProfile.findMany({
    where: {
      familyReferenceId: familyId,
      program: DUGSI_PROGRAM,
    },
    include: programProfileFullInclude,
    orderBy: {
      createdAt: 'asc',
    },
  })

  // Map to DTOs
  const registrations: DugsiRegistration[] = []
  for (const familyProfile of familyProfiles) {
    const registration = mapProfileToDugsiRegistration(familyProfile)
    if (registration) {
      registrations.push(registration)
    }
  }

  return registrations
}

/**
 * Preview which students will be deleted when deleting a family.
 *
 * Used by delete confirmation dialogs to show the impact of deletion.
 *
 * @security Authorization must be enforced at the API route/action layer.
 *
 * @param studentId - ID of any student in the family
 * @returns Object with count and student details
 */
export async function getDeleteFamilyPreview(studentId: string): Promise<{
  count: number
  students: Array<{ id: string; name: string; parentEmail: string | null }>
}> {
  const profile = await getProgramProfileById(studentId)

  if (!profile || profile.program !== DUGSI_PROGRAM) {
    throw new ActionError(
      'Student not found or not in Dugsi program',
      ERROR_CODES.STUDENT_NOT_FOUND,
      undefined,
      404
    )
  }

  const familyId = profile.familyReferenceId
  let profilesToDelete = [profile]

  // If familyReferenceId exists, get all family members
  if (familyId) {
    const familyProfiles = await getProgramProfilesByFamilyId(familyId)
    profilesToDelete = familyProfiles
  }

  // Extract parent email from guardian relationships
  const parentEmail =
    profile.person.guardianRelationships?.[0]?.guardian?.contactPoints?.find(
      (cp) => cp.type === 'EMAIL'
    )?.value ?? null

  const students = profilesToDelete.map((p) => ({
    id: p.id,
    name: p.person.name,
    parentEmail,
  }))

  return {
    count: students.length,
    students,
  }
}

/**
 * Delete a Dugsi family and all associated students.
 *
 * HARD DELETE: Dugsi family data is permanently removed.
 *
 * Design Decision: Dugsi uses hard delete because:
 * - Parent explicitly requested data removal
 * - No billing history to preserve (subscription handled separately)
 * - Supports GDPR right-to-be-forgotten compliance
 *
 * Contrast with Mahad which uses soft delete (WITHDRAWN status) to:
 * - Preserve historical enrollment records
 * - Support re-enrollment without data re-entry
 * - Maintain audit trail for billing disputes
 *
 * If the student has a familyReferenceId, deletes all students in that family.
 * Otherwise, deletes just the single student.
 *
 * Cascade deletes will handle:
 * - ProgramProfile
 * - Enrollments
 * - BillingAssignments
 * - Person record (if no other program profiles exist)
 *
 * @security Authorization must be enforced at the API route/action layer.
 *           This is a destructive operation - verify user intent before calling.
 *
 * @param studentId - ID of any student in the family
 * @returns Number of students deleted
 */
export async function deleteDugsiFamily(studentId: string): Promise<number> {
  const profile = await getProgramProfileById(studentId)

  if (!profile || profile.program !== DUGSI_PROGRAM) {
    throw new ActionError(
      'Student not found or not in Dugsi program',
      ERROR_CODES.STUDENT_NOT_FOUND,
      undefined,
      404
    )
  }

  const familyId = profile.familyReferenceId

  // No family ID - delete just this profile
  if (!familyId) {
    await prisma.programProfile.delete({
      where: { id: studentId },
    })
    return 1
  }

  // Get all family members
  const familyProfiles = await getProgramProfilesByFamilyId(familyId)
  const profileIds = familyProfiles.map((p) => p.id)

  // Delete all program profiles in the family
  // Cascade deletes will handle related records
  await prisma.programProfile.deleteMany({
    where: {
      id: { in: profileIds },
    },
  })

  return profileIds.length
}

/**
 * Search for a Dugsi registration by contact (email or phone).
 *
 * Searches both student and parent contact points.
 *
 * @security Authorization must be enforced at the API route/action layer.
 *
 * @param contact - Email or phone number
 * @param contactType - Type of contact ('EMAIL' or 'PHONE')
 * @returns Array of matching registrations
 */
export async function searchDugsiRegistrationsByContact(
  contact: string,
  contactType: 'EMAIL' | 'PHONE'
): Promise<DugsiRegistration[]> {
  const normalizedContact = contact.toLowerCase().trim()

  // Search for profiles where either:
  // 1. The student has this contact
  // 2. The parent (guardian) has this contact
  const profiles = await prisma.programProfile.findMany({
    where: {
      program: DUGSI_PROGRAM,
      OR: [
        {
          // Student's own contact
          person: {
            contactPoints: {
              some: {
                type: contactType,
                value: normalizedContact,
              },
            },
          },
        },
        {
          // Parent's contact (via guardian relationship)
          person: {
            guardianRelationships: {
              some: {
                isActive: true,
                guardian: {
                  contactPoints: {
                    some: {
                      type: contactType,
                      value: normalizedContact,
                    },
                  },
                },
              },
            },
          },
        },
      ],
    },
    include: programProfileFullInclude,
  })

  // Map to DTOs
  const registrations: DugsiRegistration[] = []
  for (const profile of profiles) {
    const registration = mapProfileToDugsiRegistration(profile)
    if (registration) {
      registrations.push(registration)
    }
  }

  return registrations
}
