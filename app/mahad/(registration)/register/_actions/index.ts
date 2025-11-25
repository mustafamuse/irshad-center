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
import { searchProgramProfilesByNameOrContact } from '@/lib/db/queries/program-profile'
import { createActionLogger } from '@/lib/logger'
import { mahadRegistrationSchema } from '@/lib/registration/schemas/registration'
import { formatFullName } from '@/lib/registration/utils/name-formatting'
import { handlePrismaUniqueError } from '@/lib/registration/utils/prisma-error-handler'
import { DuplicateDetectionService } from '@/lib/services/duplicate-detection-service'
import {
  createPersonWithContact,
  createProgramProfileWithEnrollment,
} from '@/lib/services/registration-service'
import { SiblingRelationshipService } from '@/lib/services/sibling-relationship-service'
import { ValidationError } from '@/lib/services/validation-service'
import {
  createDuplicateError,
  ExistingPersonData,
} from '@/lib/types/registration-errors'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type ActionResult<T = void> = T extends void
  ? {
      success: boolean
      data?: never
      error?: string
      field?: 'email' | 'phone' | 'firstName' | 'lastName' | 'dateOfBirth'
      fields?: Array<
        'email' | 'phone' | 'firstName' | 'lastName' | 'dateOfBirth'
      >
      existingPerson?: ExistingPersonData
      siblingsAdded?: number
      siblingsFailed?: number
    }
  : {
      success: boolean
      data?: T
      error?: string
      field?: 'email' | 'phone' | 'firstName' | 'lastName' | 'dateOfBirth'
      fields?: Array<
        'email' | 'phone' | 'firstName' | 'lastName' | 'dateOfBirth'
      >
      existingPerson?: ExistingPersonData
      siblingsAdded?: number
      siblingsFailed?: number
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
    logger.info(
      {
        hasSiblingIds: !!input.siblingIds,
        siblingCount: input.siblingIds?.length || 0,
      },
      'Starting Mahad student registration'
    )

    const validated = mahadRegistrationSchema.parse(input.studentData)

    logger.info(
      {
        email: validated.email,
        phone: validated.phone,
        educationLevel: validated.educationLevel,
        gradeLevel: validated.gradeLevel,
      },
      'Registration data validated successfully'
    )

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

    logger.info(
      { fullName, email: validated.email, phone: validated.phone },
      'Formatted name, checking for existing person'
    )

    // 2. Check for duplicate registration using DuplicateDetectionService
    const duplicateCheck = await DuplicateDetectionService.checkDuplicate({
      email: validated.email,
      phone: validated.phone,
      program: 'MAHAD_PROGRAM',
    })

    logger.info(
      {
        isDuplicate: duplicateCheck.isDuplicate,
        hasActiveProfile: duplicateCheck.hasActiveProfile,
        duplicateField: duplicateCheck.duplicateField,
      },
      'Completed duplicate check'
    )

    // If duplicate with active profile, return error with CORRECT field mapping
    if (duplicateCheck.isDuplicate && duplicateCheck.hasActiveProfile) {
      const person = duplicateCheck.existingPerson!
      const activeProfile = duplicateCheck.activeProfile

      // Format person data for dialog display
      const primaryEmail =
        person.contactPoints.find((cp) => cp.type === 'EMAIL' && cp.isPrimary)
          ?.value ||
        person.contactPoints.find((cp) => cp.type === 'EMAIL')?.value ||
        ''

      const primaryPhone =
        person.contactPoints.find((cp) => cp.type === 'PHONE' && cp.isPrimary)
          ?.value ||
        person.contactPoints.find((cp) => cp.type === 'PHONE')?.value

      const registeredDate = activeProfile?.createdAt
        ? new Date(activeProfile.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : new Date(person.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })

      const enrollmentStatus =
        activeProfile?.enrollmentCount && activeProfile.enrollmentCount > 0
          ? 'Active'
          : 'Registered'

      const error = createDuplicateError({
        field: duplicateCheck.duplicateField!,
        existingPersonId: person.id,
        program: 'MAHAD_PROGRAM',
        existingPerson: {
          name: person.name,
          email: primaryEmail,
          phone: primaryPhone,
          registeredDate,
          enrollmentStatus,
          program: 'Mahad',
        },
      })

      logger.info(
        {
          personId: person.id,
          duplicateField: duplicateCheck.duplicateField,
          personName: person.name,
        },
        'Duplicate registration detected with person data'
      )

      // When both email and phone are duplicates, show errors on both fields
      if (duplicateCheck.duplicateField === 'both') {
        return {
          success: false,
          error: error.message,
          fields: ['email', 'phone'],
          existingPerson: error.existingPerson,
        }
      }

      return {
        success: false,
        error: error.message,
        field: duplicateCheck.duplicateField ?? undefined,
        existingPerson: error.existingPerson,
      }
    }

    // Extract existing person if found (without active Mahad profile)
    const existingPerson = duplicateCheck.existingPerson

    if (existingPerson) {
      // Person exists but no Mahad profile - resume registration with transaction
      logger.info(
        {
          personId: existingPerson.id,
          email: validated.email,
        },
        'Resuming incomplete Mahad registration for existing person (with transaction)'
      )

      // Wrap in transaction to ensure atomicity of ProgramProfile + Enrollment + Siblings
      const result = await prisma.$transaction(async (tx) => {
        logger.info(
          { personId: existingPerson.id, program: 'MAHAD_PROGRAM' },
          'Creating ProgramProfile for existing person inside transaction'
        )

        const { profile, enrollment } =
          await createProgramProfileWithEnrollment(
            {
              personId: existingPerson.id,
              program,
              status: 'REGISTERED',
              batchId: null,
              monthlyRate: 150,
              educationLevel: validated.educationLevel as EducationLevel,
              gradeLevel: validated.gradeLevel as GradeLevel,
              schoolName: validated.schoolName,
            },
            tx
          )

        logger.info(
          {
            profileId: profile.id,
            personId: existingPerson.id,
            enrollmentId: enrollment.id,
          },
          'ProgramProfile created successfully for existing person'
        )

        // Handle sibling relationships using SiblingRelationshipService
        // Convert ProgramProfile IDs to Person IDs
        let siblingPersonIds: string[] | null = null
        if (input.siblingIds && input.siblingIds.length > 0) {
          const siblingProfiles = await tx.programProfile.findMany({
            where: {
              id: { in: input.siblingIds },
              program: 'MAHAD_PROGRAM',
            },
            select: { personId: true },
          })
          siblingPersonIds = siblingProfiles.map((p) => p.personId)
        }

        // Link siblings using centralized service
        const siblingResult = await SiblingRelationshipService.linkSiblings(
          existingPerson.id,
          siblingPersonIds,
          tx
        )

        return {
          profile,
          enrollment,
          siblingsAdded: siblingResult.added,
          siblingsFailed: siblingResult.failed,
        }
      })

      logger.info(
        {
          profileId: result.profile.id,
          personId: existingPerson.id,
          enrollmentId: result.enrollment.id,
          siblingsAdded: result.siblingsAdded,
          siblingsFailed: result.siblingsFailed,
        },
        'Resumed registration completed successfully - transaction committed'
      )

      return {
        success: true,
        data: {
          id: result.profile.id,
          name: existingPerson.name,
        },
        siblingsAdded: result.siblingsAdded,
        siblingsFailed: result.siblingsFailed,
      }
    }

    // 3. No existing person - proceed with full registration in transaction
    // Wrap entire registration in a transaction to ensure atomicity
    // If any step fails, everything will be rolled back
    logger.info(
      {
        fullName,
        email: validated.email,
        phone: validated.phone,
        hasSiblingIds: !!input.siblingIds,
      },
      'Starting transaction for new person registration'
    )

    const result = await prisma.$transaction(async (tx) => {
      logger.info(
        { email: validated.email },
        'Inside transaction - creating person with contact points'
      )

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

      logger.info(
        { personId: person.id, personName: person.name },
        'Person created successfully inside transaction'
      )

      // 2b. Create ProgramProfile with Enrollment
      // Note: batchId is not provided during registration, will be assigned later
      logger.info(
        { personId: person.id, program: 'MAHAD_PROGRAM' },
        'Creating ProgramProfile with Enrollment inside transaction'
      )

      const { profile, enrollment } = await Sentry.startSpan(
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

      logger.info(
        {
          profileId: profile.id,
          personId: person.id,
          program: 'MAHAD_PROGRAM',
          enrollmentId: enrollment.id,
        },
        'ProgramProfile and Enrollment created successfully inside transaction'
      )

      // 2c. Handle sibling relationships using SiblingRelationshipService
      // Convert ProgramProfile IDs to Person IDs
      let siblingPersonIds: string[] | null = null
      if (input.siblingIds && input.siblingIds.length > 0) {
        const siblingProfiles = await tx.programProfile.findMany({
          where: {
            id: { in: input.siblingIds },
            program: 'MAHAD_PROGRAM',
          },
          select: { personId: true },
        })
        siblingPersonIds = siblingProfiles.map((p) => p.personId)
      }

      // Link siblings using centralized service
      const siblingResult = await Sentry.startSpan(
        {
          name: 'mahad.create_sibling_relationships',
          op: 'db.transaction',
          attributes: {
            person_id: person.id,
            num_siblings: siblingPersonIds?.length ?? 0,
          },
        },
        async () =>
          await SiblingRelationshipService.linkSiblings(
            person.id,
            siblingPersonIds,
            tx
          )
      )

      logger.info(
        {
          personId: person.id,
          profileId: profile.id,
          enrollmentId: enrollment.id,
          siblingsAdded: siblingResult.added,
          siblingsFailed: siblingResult.failed,
        },
        'Transaction completed successfully - returning results'
      )

      return {
        person,
        profile,
        enrollment,
        siblingsAdded: siblingResult.added,
        siblingsFailed: siblingResult.failed,
      }
    })

    logger.info(
      {
        personId: result.person.id,
        profileId: result.profile.id,
        enrollmentId: result.enrollment.id,
        siblingsAdded: result.siblingsAdded,
        siblingsFailed: result.siblingsFailed,
      },
      'Registration completed successfully - transaction committed'
    )

    return {
      success: true,
      data: {
        id: result.profile.id,
        name: fullName,
      },
      siblingsAdded: result.siblingsAdded,
      siblingsFailed: result.siblingsFailed,
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
 * Check for duplicate registration and return person data for display
 *
 * This is a server action wrapper for DuplicateDetectionService.checkDuplicate()
 * that can be safely called from client-side validation hooks.
 *
 * @returns Object with validation result and person data if duplicate found
 */
export async function checkDuplicateWithPersonData(params: {
  email?: string | null
  phone?: string | null
  program: Program
}): Promise<{
  isDuplicate: boolean
  personData?: ExistingPersonData
}> {
  try {
    const duplicateCheck =
      await DuplicateDetectionService.checkDuplicate(params)

    if (!duplicateCheck.isDuplicate || !duplicateCheck.hasActiveProfile) {
      return { isDuplicate: false }
    }

    // Extract and format person data
    const person = duplicateCheck.existingPerson
    const activeProfile = duplicateCheck.activeProfile

    if (!person || !activeProfile) {
      return { isDuplicate: false }
    }

    const primaryEmail =
      person.contactPoints.find((cp) => cp.type === 'EMAIL' && cp.isPrimary)
        ?.value ||
      person.contactPoints.find((cp) => cp.type === 'EMAIL')?.value ||
      ''

    const primaryPhone =
      person.contactPoints.find((cp) => cp.type === 'PHONE' && cp.isPrimary)
        ?.value || person.contactPoints.find((cp) => cp.type === 'PHONE')?.value

    const registeredDate = new Date(activeProfile.createdAt).toLocaleDateString(
      'en-US',
      {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }
    )

    const enrollmentStatus =
      activeProfile.enrollmentCount > 0 ? 'Active' : 'Registered'

    const personData: ExistingPersonData = {
      name: person.name,
      email: primaryEmail,
      phone: primaryPhone,
      registeredDate,
      enrollmentStatus,
      program: params.program === 'MAHAD_PROGRAM' ? 'Mahad' : 'Dugsi',
    }

    return {
      isDuplicate: true,
      personData,
    }
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error checking duplicate with person data'
    )
    // On error, return false to allow form submission (server-side will catch it)
    return { isDuplicate: false }
  }
}

/**
 * @deprecated NO LONGER USED - Migrated to DuplicateDetectionService.checkDuplicate()
 *
 * Use DuplicateDetectionService.checkDuplicate() instead, which returns both
 * validation result AND person data for personalized duplicate dialogs.
 *
 * This function only returns a boolean and doesn't provide person data needed
 * for showing user information in duplicate registration dialogs.
 *
 * Migration complete: All Mahad registration validation now uses DuplicateDetectionService.
 * This function is only kept for Dugsi parent email validation compatibility.
 *
 * @see DuplicateDetectionService.checkDuplicate() for the new approach
 * @see lib/registration/hooks/use-email-validation.ts for migration example
 */
export async function checkEmailExists(email: string): Promise<boolean> {
  return await DuplicateDetectionService.isEmailRegistered(
    email,
    'MAHAD_PROGRAM'
  )
}

/**
 * @deprecated NO LONGER USED - Migrated to DuplicateDetectionService.checkDuplicate()
 *
 * Use DuplicateDetectionService.checkDuplicate() instead, which returns both
 * validation result AND person data for personalized duplicate dialogs.
 *
 * This function only returns a boolean and doesn't provide person data needed
 * for showing user information in duplicate registration dialogs.
 *
 * Migration complete: All Mahad registration validation now uses DuplicateDetectionService.
 * Can be safely removed after verifying no other code paths use it.
 *
 * @see DuplicateDetectionService.checkDuplicate() for the new approach
 * @see lib/registration/hooks/use-email-validation.ts for migration example
 */
export async function checkPhoneExists(phone: string): Promise<boolean> {
  return await DuplicateDetectionService.isPhoneRegistered(
    phone,
    'MAHAD_PROGRAM'
  )
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
    await prisma.$transaction(async (tx) => {
      await SiblingRelationshipService.linkSiblings(
        studentProfile.personId,
        [siblingProfile.personId],
        tx
      )
    })

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

    // Check if sibling relationship exists
    const areSiblings = await SiblingRelationshipService.areSiblings(
      studentProfile.personId,
      siblingProfile.personId,
      prisma
    )

    if (!areSiblings) {
      return {
        success: false,
        error: 'Sibling relationship not found',
      }
    }

    // Remove sibling relationship using service
    await prisma.$transaction(async (tx) => {
      await SiblingRelationshipService.unlinkSiblings(
        studentProfile.personId,
        siblingProfile.personId,
        tx
      )
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
