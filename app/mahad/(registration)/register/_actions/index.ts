'use server'

/**
 * Mahad Registration Server Actions
 *
 * Direct Server Actions for student self-registration (college-age).
 * Follows the same pattern as app/admin/mahad/cohorts/actions.ts
 *
 * ✅ MIGRATION COMPLETE:
 * This file has been migrated to use the new unified identity model:
 * - Person model for identity
 * - ProgramProfile model for program enrollment
 * - Enrollment model for enrollment details
 */

import { revalidatePath } from 'next/cache'

import { EducationLevel, GradeLevel } from '@prisma/client'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'

import { createActionLogger } from '@/lib/logger'

const logger = createActionLogger('mahad-register-actions')

import { prisma } from '@/lib/db'
import { findPersonByContact } from '@/lib/db/queries/program-profile'
import { searchProgramProfilesByNameOrContact } from '@/lib/db/queries/program-profile'
import { createSiblingRelationship } from '@/lib/db/queries/siblings'
import { mahadRegistrationSchema } from '@/lib/registration/schemas/registration'
import { formatFullName } from '@/lib/registration/utils/name-formatting'
import { handlePrismaUniqueError } from '@/lib/registration/utils/prisma-error-handler'
import {
  createPersonWithContact,
  createProgramProfileWithEnrollment,
} from '@/lib/services/registration-service'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type ActionResult<T = void> = T extends void
  ? {
      success: boolean
      data?: never
      error?: string
      field?: 'email' | 'phone' | 'firstName' | 'lastName' | 'dateOfBirth'
    }
  : {
      success: boolean
      data?: T
      error?: string
      field?: 'email' | 'phone' | 'firstName' | 'lastName' | 'dateOfBirth'
    }

// ============================================================================
// REGISTRATION ACTIONS
// ============================================================================

/**
 * Register a new Mahad student with optional siblings
 */
export async function registerStudent(input: {
  studentData: z.infer<typeof mahadRegistrationSchema>
  siblingIds: string[] | null
}): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const validated = mahadRegistrationSchema.parse(input.studentData)

    // 1. Format and capitalize names
    const fullName = formatFullName(validated.firstName, validated.lastName)

    // 2. Create Person with contact points
    const person = await Sentry.startSpan(
      {
        name: 'mahad.create_person_with_contact',
        op: 'db.transaction',
        attributes: {
          email: validated.email,
        },
      },
      async () =>
        await createPersonWithContact({
          name: fullName,
          dateOfBirth: validated.dateOfBirth,
          email: validated.email,
          phone: validated.phone,
          isPrimaryEmail: true,
          isPrimaryPhone: true,
        })
    )

    // 3. Create ProgramProfile with Enrollment
    // Note: batchId is not provided during registration, will be assigned later
    const { profile } = await Sentry.startSpan(
      {
        name: 'mahad.create_profile_with_enrollment',
        op: 'db.transaction',
        attributes: {
          person_id: person.id,
          program: 'MAHAD_PROGRAM',
        },
      },
      async () =>
        await createProgramProfileWithEnrollment({
          personId: person.id,
          program: 'MAHAD_PROGRAM',
          status: 'REGISTERED',
          batchId: null, // Will be assigned later by admin
          monthlyRate: 150, // Default rate
          educationLevel: validated.educationLevel as EducationLevel,
          gradeLevel: validated.gradeLevel as GradeLevel,
          schoolName: validated.schoolName,
        })
    )

    // 4. Handle sibling relationships if provided
    // Create SiblingRelationship records for each selected sibling
    if (input.siblingIds && input.siblingIds.length > 0) {
      // Get Person IDs for all sibling ProgramProfiles
      const siblingProfiles = await prisma.programProfile.findMany({
        where: {
          id: { in: input.siblingIds },
          program: 'MAHAD_PROGRAM', // Ensure siblings are Mahad students
        },
        select: { personId: true },
      })

      // Create sibling relationships
      await Sentry.startSpan(
        {
          name: 'mahad.create_sibling_relationships',
          op: 'db.transaction',
          attributes: {
            person_id: person.id,
            num_siblings: siblingProfiles.length,
          },
        },
        async () => {
          for (const siblingProfile of siblingProfiles) {
            try {
              await createSiblingRelationship(
                person.id,
                siblingProfile.personId,
                'manual',
                null
              )
            } catch (error) {
              // Log but don't fail registration if sibling relationship creation fails
              // (e.g., relationship already exists)
              logger.warn(
                {
                  err: error instanceof Error ? error : new Error(String(error))
                },
                'Failed to create sibling relationship during registration'
              )
            }
          }
        }
      )
    }

    return {
      success: true,
      data: {
        id: profile.id,
        name: fullName,
      },
    }
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error registering student'
    )

    // Try to extract validated data for duplicate error handling
    let validated: z.infer<typeof mahadRegistrationSchema> | null = null
    try {
      validated = mahadRegistrationSchema.parse(input.studentData)
    } catch {
      // If validation fails, we'll handle it below
    }

    // Handle duplicate errors if we have validated data
    if (validated) {
      const duplicateError = handlePrismaUniqueError(error, {
        name: formatFullName(validated.firstName, validated.lastName),
        email: validated.email,
        phone: validated.phone,
      })

      if (duplicateError) {
        return {
          success: false,
          error: duplicateError.message,
          field: duplicateError.field,
        }
      }
    }

    // Handle other errors
    const isDuplicateError =
      error && typeof error === 'object' && 'field' in error
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed',
      field: isDuplicateError
        ? (
            error as {
              field?:
                | 'email'
                | 'phone'
                | 'firstName'
                | 'lastName'
                | 'dateOfBirth'
            }
          ).field
        : undefined,
    }
  } finally {
    revalidatePath('/mahad/register')
  }
}

// ============================================================================
// UTILITY ACTIONS
// ============================================================================

/**
 * Check if email already exists for Mahad program
 * Uses unified Person/ContactPoint model
 */
export async function checkEmailExists(email: string): Promise<boolean> {
  if (!email || !email.trim()) {
    return false
  }

  try {
    // Find person by email using unified model
    const person = await findPersonByContact(email.toLowerCase().trim(), null)

    if (!person) {
      return false
    }

    // Check if person has an active Mahad ProgramProfile
    const hasMahadProfile = person.programProfiles.some(
      (profile) =>
        profile.program === 'MAHAD_PROGRAM' &&
        profile.enrollments.some(
          (enrollment) =>
            enrollment.status !== 'WITHDRAWN' && enrollment.endDate === null
        )
    )

    return hasMahadProfile
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error checking if email exists'
    )
    return false
  }
}

/**
 * Search Mahad students by name for sibling matching
 * Uses unified Person/ProgramProfile model
 * Returns results matching the SearchResult interface expected by the UI
 */
export async function searchStudents(
  query: string,
  lastName: string
): Promise<Array<{ id: string; name: string; lastName: string }>> {
  if (!query || query.trim().length < 2) {
    return []
  }

  try {
    // Search for Mahad ProgramProfiles matching the query
    const profiles = await searchProgramProfilesByNameOrContact(
      query.trim(),
      'MAHAD_PROGRAM'
    )

    // Filter to only show students with matching lastName (for sibling matching)
    const filtered = profiles.filter((profile) => {
      const personLastName = profile.person.name.split(' ').pop() || ''
      return (
        personLastName.toLowerCase() === lastName.toLowerCase() &&
        // Only show students with active enrollments
        profile.enrollments.some(
          (enrollment) =>
            enrollment.status !== 'WITHDRAWN' && enrollment.endDate === null
        )
      )
    })

    // Map to expected format
    return filtered.map((profile) => ({
      id: profile.id,
      name: profile.person.name,
      lastName: profile.person.name.split(' ').pop() || '',
    }))
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error searching students'
    )
    return []
  }
}

/**
 * Add sibling relationship between two Mahad students
 * Uses unified Person/SiblingRelationship model
 */
export async function addSibling(
  studentId: string,
  siblingId: string
): Promise<ActionResult> {
  if (studentId === siblingId) {
    return { success: false, error: 'Cannot add student as their own sibling' }
  }

  try {
    // Get profiles sequentially to avoid SWC parser issues with Promise.all
    const studentProfile = await prisma.programProfile.findUnique({
      where: { id: studentId },
      select: { personId: true, program: true },
    })

    const siblingProfile = await prisma.programProfile.findUnique({
      where: { id: siblingId },
      select: { personId: true, program: true },
    })

    if (!studentProfile || !siblingProfile) {
      return { success: false, error: 'Student or sibling not found' }
    }

    // Verify both are Mahad profiles
    if (
      studentProfile.program !== 'MAHAD_PROGRAM' ||
      siblingProfile.program !== 'MAHAD_PROGRAM'
    ) {
      return {
        success: false,
        error: 'Both students must be enrolled in Mahad program',
      }
    }

    // Create sibling relationship using Person IDs
    await createSiblingRelationship(
      studentProfile.personId,
      siblingProfile.personId,
      'manual',
      null
    )

    revalidatePath('/mahad/register')
    return { success: true }
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error adding sibling'
    )
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add sibling',
    }
  }
}

/**
 * Remove sibling relationship between two Mahad students
 * Uses unified Person/SiblingRelationship model
 */
export async function removeSibling(
  studentProfileId: string,
  siblingProfileId: string
): Promise<ActionResult> {
  try {
    // Get profiles sequentially to avoid SWC parser issues with Promise.all
    const studentProfile = await prisma.programProfile.findUnique({
      where: { id: studentProfileId },
      select: { personId: true },
    })

    const siblingProfile = await prisma.programProfile.findUnique({
      where: { id: siblingProfileId },
      select: { personId: true },
    })

    if (!studentProfile || !siblingProfile) {
      return { success: false, error: 'Student or sibling not found' }
    }

    // Find the sibling relationship (ensure consistent ordering)
    const personIds = [studentProfile.personId, siblingProfile.personId].sort()

    const relationship = await prisma.siblingRelationship.findFirst({
      where: {
        person1Id: personIds[0],
        person2Id: personIds[1],
        isActive: true,
      },
    })

    if (!relationship) {
      return {
        success: false,
        error: 'Sibling relationship not found',
      }
    }

    // Deactivate the relationship (soft delete)
    await prisma.siblingRelationship.update({
      where: { id: relationship.id },
      data: { isActive: false },
    })

    revalidatePath('/mahad/register')
    return { success: true }
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error removing sibling'
    )
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to remove sibling',
    }
  }
}
