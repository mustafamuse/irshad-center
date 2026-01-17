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

import { StripeAccountType } from '@prisma/client'

import { DugsiRegistration } from '@/app/admin/dugsi/_types'
import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import {
  programProfileFullInclude,
  programProfileListInclude,
} from '@/lib/db/prisma-helpers'
import {
  getProgramProfileById,
  getProgramProfilesByFamilyId,
} from '@/lib/db/queries/program-profile'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger, logWarning } from '@/lib/logger'
import {
  mapProfileToDugsiRegistration,
  mapProfileListToDugsiRegistration,
} from '@/lib/mappers/dugsi-mapper'
import { cancelSubscription } from '@/lib/services/shared/subscription-service'
import { DugsiRegistrationFiltersSchema } from '@/lib/validations/dugsi'

const logger = createServiceLogger('dugsi-registration')

/**
 * Get family child counts for ALL Dugsi families (ignores shift filters).
 * Used for billing calculations which must reflect total enrolled children.
 *
 * IMPORTANT: Only counts REGISTERED/ENROLLED children, not WITHDRAWN.
 *
 * @returns Map of familyReferenceId -> child count
 */
async function getFamilyChildCounts(): Promise<Map<string, number>> {
  const counts = await prisma.programProfile.groupBy({
    by: ['familyReferenceId'],
    where: {
      program: DUGSI_PROGRAM,
      status: { in: ['REGISTERED', 'ENROLLED'] },
    },
    _count: { id: true },
  })

  const map = new Map<string, number>()
  for (const row of counts) {
    if (row.familyReferenceId) {
      map.set(row.familyReferenceId, row._count.id)
    }
  }
  return map
}

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
 * @param limit - Optional limit on number of registrations to return (for performance)
 * @param filters - Optional filters to apply (shift)
 * @returns Array of DugsiRegistration DTOs
 */
export async function getAllDugsiRegistrations(
  limit?: number,
  filters?: { shift?: 'MORNING' | 'AFTERNOON' }
): Promise<DugsiRegistration[]> {
  const validatedFilters = filters
    ? DugsiRegistrationFiltersSchema.parse(filters)
    : undefined

  // Get family counts FIRST (unfiltered - for billing accuracy)
  const familyCounts = await getFamilyChildCounts()

  const profiles = await prisma.programProfile.findMany({
    where: {
      program: DUGSI_PROGRAM,
      ...(validatedFilters?.shift && { shift: validatedFilters.shift }),
    },
    include: programProfileFullInclude,
    orderBy: {
      createdAt: 'desc',
    },
    ...(limit && { take: limit }),
  })

  return profiles
    .map((profile) => {
      const count = profile.familyReferenceId
        ? familyCounts.get(profile.familyReferenceId) || 1
        : 1
      return mapProfileToDugsiRegistration(profile, count)
    })
    .filter(Boolean) as DugsiRegistration[]
}

/**
 * Fetch Dugsi registrations with lightweight relations (optimized for list views).
 *
 * Excludes heavy teacher relations that cause N+1 queries.
 * Use getAllDugsiRegistrations() when full teacher data is needed.
 *
 * @security Authorization must be enforced at the API route/action layer.
 */
export async function getDugsiRegistrationsLite(
  limit?: number,
  filters?: { shift?: 'MORNING' | 'AFTERNOON' }
): Promise<DugsiRegistration[]> {
  const validatedFilters = filters
    ? DugsiRegistrationFiltersSchema.parse(filters)
    : undefined

  const familyCounts = await getFamilyChildCounts()

  const profiles = await prisma.programProfile.findMany({
    where: {
      program: DUGSI_PROGRAM,
      ...(validatedFilters?.shift && { shift: validatedFilters.shift }),
    },
    include: programProfileListInclude,
    orderBy: {
      createdAt: 'desc',
    },
    ...(limit && { take: limit }),
  })

  return profiles
    .map((profile) => {
      const count = profile.familyReferenceId
        ? familyCounts.get(profile.familyReferenceId) || 1
        : 1
      return mapProfileListToDugsiRegistration(profile, count)
    })
    .filter(Boolean) as DugsiRegistration[]
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
    const registration = mapProfileToDugsiRegistration(profile, 1)
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

  // Count is derived from the family profiles we just fetched
  const familyCount = familyProfiles.length

  // Map to DTOs
  const registrations: DugsiRegistration[] = []
  for (const familyProfile of familyProfiles) {
    const registration = mapProfileToDugsiRegistration(
      familyProfile,
      familyCount
    )
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

  // Extract parent email from guardian relationships (child is dependent, parents are guardians)
  const parentEmail =
    profile.person.dependentRelationships?.[0]?.guardian?.contactPoints?.find(
      (cp: { type: string }) => cp.type === 'EMAIL'
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
 * Delete family result type
 */
export interface DeleteFamilyResult {
  studentsDeleted: number
  subscriptionsCanceled: number
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
 * Order of operations:
 * 1. Cancel active Stripe subscriptions
 * 2. Delete ProgramProfile records (cascade handles the rest)
 *
 * Cascade deletes will handle:
 * - Enrollments
 * - BillingAssignments
 * - StudentPayments
 *
 * @security Authorization must be enforced at the API route/action layer.
 *           This is a destructive operation - verify user intent before calling.
 *
 * @param studentId - ID of any student in the family
 * @returns Object with studentsDeleted and subscriptionsCanceled counts
 */
export async function deleteDugsiFamily(
  studentId: string
): Promise<DeleteFamilyResult> {
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
    // Cancel any subscriptions for this single profile
    const subscriptionsCanceled = await cancelFamilySubscriptions([profile])

    await prisma.programProfile.delete({
      where: { id: studentId },
    })
    return { studentsDeleted: 1, subscriptionsCanceled }
  }

  // Get all family members with their billing assignments
  const familyProfiles = await getProgramProfilesByFamilyId(familyId)
  const profileIds = familyProfiles.map((p) => p.id)

  // Cancel all active subscriptions for this family
  const subscriptionsCanceled = await cancelFamilySubscriptions(familyProfiles)

  // Delete all program profiles in the family
  // Cascade deletes will handle related records
  await prisma.programProfile.deleteMany({
    where: {
      id: { in: profileIds },
    },
  })

  return { studentsDeleted: profileIds.length, subscriptionsCanceled }
}

/**
 * Cancel all active subscriptions for family profiles.
 *
 * Collects unique subscription IDs from billing assignments and cancels them
 * in both the database and Stripe.
 *
 * @param profiles - Array of family profiles with assignments
 * @returns Number of subscriptions canceled
 */
async function cancelFamilySubscriptions(
  profiles: Awaited<ReturnType<typeof getProgramProfilesByFamilyId>>
): Promise<number> {
  // Collect unique active subscription IDs
  const subscriptionIds = new Set<string>()

  for (const profile of profiles) {
    for (const assignment of profile.assignments) {
      if (
        assignment.subscription &&
        assignment.subscription.status === 'active'
      ) {
        subscriptionIds.add(assignment.subscription.stripeSubscriptionId)
      }
    }
  }

  // Cancel each subscription in both DB and Stripe
  let canceled = 0
  for (const stripeSubscriptionId of Array.from(subscriptionIds)) {
    try {
      await cancelSubscription(
        stripeSubscriptionId,
        true,
        StripeAccountType.DUGSI
      )
      canceled++
    } catch (error) {
      await logWarning(
        logger,
        'Subscription cancellation failed during family deletion',
        {
          stripeSubscriptionId,
          familyId: profiles[0]?.familyReferenceId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      )
    }
  }

  return canceled
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

  // Get family counts for billing accuracy
  const familyCounts = await getFamilyChildCounts()

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
    const count = profile.familyReferenceId
      ? familyCounts.get(profile.familyReferenceId) || 1
      : 1
    const registration = mapProfileToDugsiRegistration(profile, count)
    if (registration) {
      registrations.push(registration)
    }
  }

  return registrations
}
