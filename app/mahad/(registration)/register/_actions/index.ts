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

import { EducationLevel, GradeLevel, Program } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'

const logger = createActionLogger('mahad-register-actions')

import { prisma } from '@/lib/db'
import { findPersonByContact } from '@/lib/db/queries/program-profile'
import { searchProgramProfilesByNameOrContact } from '@/lib/db/queries/program-profile'
import { createSiblingRelationship } from '@/lib/db/queries/siblings'
import { createActionLogger } from '@/lib/logger'
import { mahadRegistrationSchema } from '@/lib/registration/schemas/registration'
import { formatFullName } from '@/lib/registration/utils/name-formatting'
import { handlePrismaUniqueError } from '@/lib/registration/utils/prisma-error-handler'
import {
  createPersonWithContact,
  createProgramProfileWithEnrollment,
} from '@/lib/services/registration-service'
import { ValidationError } from '@/lib/services/validation-service'

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

    // Validate program enum value
    const program: Program = 'MAHAD_PROGRAM'
    if (!Object.values(Program).includes(program)) {
      logger.error(
        { program, validPrograms: Object.values(Program) },
        'Invalid program value provided'
      )
      return {
        success: false,
        error: 'Invalid program configuration. Please contact support.',
      }
    }

    // 1. Format and capitalize names
    const fullName = formatFullName(validated.firstName, validated.lastName)

    // 2. Check for existing Person with same contact information (idempotency)
    const existingPerson = await findPersonByContact(
      validated.email,
      validated.phone
    )

    if (existingPerson) {
      // Check if they already have a Mahad profile
      const mahadProfile = existingPerson.programProfiles.find(
        (p) => p.program === 'MAHAD_PROGRAM'
      )

      if (mahadProfile) {
        // Already fully registered in Mahad program
        logger.info(
          {
            personId: existingPerson.id,
            profileId: mahadProfile.id,
            email: validated.email,
          },
          'Attempted to register person who is already registered for Mahad program'
        )
        return {
          success: false,
          error:
            'You are already registered for the Mahad program. Please contact us if you need to update your information.',
          field: 'email',
        }
      } else {
        // Person exists but no Mahad profile - resume registration
        logger.info(
          {
            personId: existingPerson.id,
            email: validated.email,
          },
          'Resuming incomplete Mahad registration for existing person'
        )

        // Create only the ProgramProfile + Enrollment
        const { profile } = await createProgramProfileWithEnrollment({
          personId: existingPerson.id,
          program,
          status: 'REGISTERED',
          batchId: null,
          monthlyRate: 150,
          educationLevel: validated.educationLevel as EducationLevel,
          gradeLevel: validated.gradeLevel as GradeLevel,
          schoolName: validated.schoolName,
        })

        // Handle sibling relationships if provided
        if (input.siblingIds && input.siblingIds.length > 0) {
          const siblingProfiles = await prisma.programProfile.findMany({
            where: {
              id: { in: input.siblingIds },
              program: 'MAHAD_PROGRAM',
            },
            select: { personId: true },
          })

          for (const siblingProfile of siblingProfiles) {
            try {
              await createSiblingRelationship(
                existingPerson.id,
                siblingProfile.personId,
                'manual',
                null
              )
            } catch (error) {
              logger.warn(
                {
                  err:
                    error instanceof Error ? error : new Error(String(error)),
                },
                'Failed to create sibling relationship during resumed registration'
              )
            }
          }
        }

        return {
          success: true,
          data: {
            id: profile.id,
            name: existingPerson.name,
          },
        }
      }
    }

    // 3. No existing person - proceed with full registration in transaction
    // Wrap entire registration in a transaction to ensure atomicity
    // If any step fails, everything will be rolled back
    const result = await prisma.$transaction(async (tx) => {
      // 2a. Create Person with contact points
      const person = await Sentry.startSpan(
        {
          name: 'mahad.create_person_with_contact',
          op: 'db.transaction',
          attributes: {
            email: validated.email,
          },
        },
        async () =>
          await createPersonWithContact(
            {
              name: fullName,
              dateOfBirth: validated.dateOfBirth,
              email: validated.email,
              phone: validated.phone,
              isPrimaryEmail: true,
              isPrimaryPhone: true,
            },
            tx // Pass transaction client
          )
      )

      // 2b. Create ProgramProfile with Enrollment
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
          await createProgramProfileWithEnrollment(
            {
              personId: person.id,
              program, // Use validated program enum value
              status: 'REGISTERED',
              batchId: null, // Will be assigned later by admin
              monthlyRate: 150, // Default rate
              educationLevel: validated.educationLevel as EducationLevel,
              gradeLevel: validated.gradeLevel as GradeLevel,
              schoolName: validated.schoolName,
            },
            tx // Pass transaction client
          )
      )

      // 2c. Handle sibling relationships if provided
      // Create SiblingRelationship records for each selected sibling
      if (input.siblingIds && input.siblingIds.length > 0) {
        // Get Person IDs for all sibling ProgramProfiles
        const siblingProfiles = await tx.programProfile.findMany({
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
                  null,
                  tx // Pass transaction client
                )
              } catch (error) {
                // Log but don't fail registration if sibling relationship creation fails
                // (e.g., relationship already exists)
                logger.warn(
                  {
                    err:
                      error instanceof Error ? error : new Error(String(error)),
                  },
                  'Failed to create sibling relationship during registration'
                )
              }
            }
          }
        )
      }

      return { person, profile }
    })

    return {
      success: true,
      data: {
        id: result.profile.id,
        name: fullName,
      },
    }
  } catch (error) {
    // Log error with full context for debugging
    logger.error(
      {
        err: error instanceof Error ? error : new Error(String(error)),
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorCode: error instanceof ValidationError ? error.code : undefined,
        errorDetails:
          error instanceof ValidationError ? error.details : undefined,
      },
      'Error registering student'
    )

    // Handle ValidationError specifically
    if (error instanceof ValidationError) {
      // Map ValidationError codes to user-friendly messages
      const errorMessages: Record<string, string> = {
        PROFILE_NOT_FOUND: 'Student profile not found. Please try again.',
        MISSING_PROGRAM_INFO:
          'Registration information is incomplete. Please try again.',
        BATCH_NOT_FOUND:
          'The selected program batch is not available. Please contact support.',
        DUGSI_NO_BATCH:
          'Invalid program configuration. Please contact support.',
        PERSON_NOT_FOUND: 'Student information not found. Please try again.',
        GUARDIAN_NOT_FOUND: 'Guardian information not found. Please try again.',
        DEPENDENT_NOT_FOUND: 'Student information not found. Please try again.',
        DUPLICATE_GUARDIAN_RELATIONSHIP:
          'This relationship already exists. Please contact support.',
        DUPLICATE_SIBLING_RELATIONSHIP: 'Sibling relationship already exists.',
        SELF_GUARDIAN:
          'Invalid relationship configuration. Please contact support.',
        SELF_SIBLING: 'Invalid sibling relationship. Please contact support.',
        SUBSCRIPTION_NOT_FOUND:
          'Payment information not found. Please contact support.',
        TEACHER_NOT_FOUND:
          'Teacher information not found. Please contact support.',
        TEACHER_ASSIGNMENT_DUGSI_ONLY:
          'Invalid program assignment. Please contact support.',
        DUPLICATE_SHIFT_ASSIGNMENT:
          'Student already has an assignment for this shift.',
        TEACHER_ALREADY_EXISTS:
          'This person is already registered as a teacher.',
      }

      const userMessage =
        errorMessages[error.code] ||
        error.message ||
        'Registration validation failed. Please check your information and try again.'

      return {
        success: false,
        error: userMessage,
      }
    }

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Please check all fields and try again.',
        errors: error.flatten().fieldErrors,
      }
    }

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
      error:
        error instanceof Error
          ? error.message
          : 'Registration failed. Please try again or contact support if the problem persists.',
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
