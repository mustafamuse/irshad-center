'use server'

/**
 * Dugsi Registration Server Actions
 *
 * Direct Server Actions for parent-led registration (K-12 children).
 * Includes payment link generation for capturing payment methods.
 *
 * Follows the same error handling pattern as app/admin/mahad/cohorts/actions.ts
 *
 * ✅ MIGRATION COMPLETE:
 * This file has been migrated to use the new unified identity model:
 * - Person model for identity
 * - ProgramProfile model for program enrollment
 * - Enrollment model for enrollment details
 * - SiblingRelationship model for sibling tracking
 * - GuardianRelationship model for parent-child relationships
 */

import { revalidatePath } from 'next/cache'

import { Prisma, $Enums } from '@prisma/client'

// Extract enum types for convenience
type Gender = $Enums.Gender
type EducationLevel = $Enums.EducationLevel
type GradeLevel = $Enums.GradeLevel
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { findPersonByContact } from '@/lib/db/queries/program-profile'
import { dugsiRegistrationSchema } from '@/lib/registration/schemas/registration'
import { capitalizeNames } from '@/lib/registration/utils/name-formatting'
import { handlePrismaUniqueError } from '@/lib/registration/utils/prisma-error-handler'
import { createFamilyRegistration } from '@/lib/services/registration-service'
import { normalizePhone } from '@/lib/types/person'
import {
  constructDugsiPaymentUrl,
  generateFamilyId,
} from '@/lib/utils/dugsi-payment'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Action result type for consistent response structure
 */
type ActionResult<T = void> = {
  success: boolean
  data?: T
  error?: string
  errors?: Partial<Record<string, string[]>>
}

// ============================================================================
// PRISMA ERROR HANDLING
// ============================================================================

/**
 * Prisma error code constants
 */
const PRISMA_ERRORS = {
  UNIQUE_CONSTRAINT: 'P2002',
  RECORD_NOT_FOUND: 'P2025',
  FOREIGN_KEY_CONSTRAINT: 'P2003',
} as const

/**
 * Check if error is a Prisma error
 */
function isPrismaError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  )
}

/**
 * Centralized error handler for all actions
 */
function handleActionError<T = void>(
  error: unknown,
  action: string,
  context?: { name?: string; handlers?: Record<string, string> }
): ActionResult<T> {
  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    return {
      success: false,
      errors: error.flatten().fieldErrors,
    }
  }

  // Log error with context for debugging
  console.error(`[${action}] Error:`, error)

  // Handle Prisma-specific errors with custom messages
  if (isPrismaError(error) && context?.handlers?.[error.code]) {
    return {
      success: false,
      error: context.handlers[error.code],
    }
  }

  // Default generic error message
  return {
    success: false,
    error: error instanceof Error ? error.message : `Failed to ${action}`,
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
// Note: Duplicate checking is now handled by database constraints
// See: prisma/migrations/20251011141141_add_unique_constraints_duplicates

// ============================================================================
// REGISTRATION ACTIONS
// ============================================================================

/**
 * Register multiple children for Dugsi (parent-led enrollment)
 * Now includes payment link generation for capturing payment methods.
 */
export async function registerDugsiChildren(
  input: z.infer<typeof dugsiRegistrationSchema>
): Promise<
  ActionResult<{
    children: Array<{ id: string; name: string }>
    count: number
    paymentUrl?: string
    familyId?: string
    billingAccountId?: string
    primaryContactPointId?: string | null
  }>
> {
  let validated: z.infer<typeof dugsiRegistrationSchema> | null = null

  try {
    validated = dugsiRegistrationSchema.parse(input)

    // 1. Generate family ID for tracking
    const familyId = generateFamilyId(validated.parent1LastName)

    // 2. Capitalize parent names
    const { firstName: parent1FirstName, lastName: parent1LastName } =
      capitalizeNames(validated.parent1FirstName, validated.parent1LastName)

    let parent2FirstName: string | null = null
    let parent2LastName: string | null = null
    let parent2Email: string | null = null
    let parent2Phone: string | null = null

    if (
      !validated.isSingleParent &&
      validated.parent2FirstName &&
      validated.parent2LastName &&
      validated.parent2Email &&
      validated.parent2Phone
    ) {
      const parent2Names = capitalizeNames(
        validated.parent2FirstName,
        validated.parent2LastName
      )
      parent2FirstName = parent2Names.firstName
      parent2LastName = parent2Names.lastName
      parent2Email = validated.parent2Email
      parent2Phone = validated.parent2Phone
    }

    // 3. Prepare children data with proper enum type casts
    const childrenData = validated.children.map((child) => {
      const { firstName, lastName } = capitalizeNames(
        child.firstName,
        child.lastName
      )
      return {
        firstName,
        lastName,
        dateOfBirth: child.dateOfBirth,
        gender: child.gender as Gender,
        educationLevel: child.educationLevel as EducationLevel,
        gradeLevel: child.gradeLevel as GradeLevel,
        schoolName: child.schoolName,
        healthInfo: child.healthInfo,
      }
    })

    // 4. Create family registration using the service
    const registrationResult = await createFamilyRegistration({
      children: childrenData,
      parent1Email: validated.parent1Email,
      parent1Phone: validated.parent1Phone,
      parent1FirstName,
      parent1LastName,
      parent2Email,
      parent2Phone,
      parent2FirstName,
      parent2LastName,
      familyReferenceId: familyId,
      monthlyRate: 150, // Default rate
    })

    // 5. Generate payment URL
    const paymentUrl = constructDugsiPaymentUrl({
      parentEmail: validated.parent1Email,
      familyId,
      childCount: registrationResult.profiles.length,
    })

    // 6. Return response in expected format
    return {
      success: true,
      data: {
        children: registrationResult.profiles.map((p) => ({
          id: p.id,
          name: p.name,
        })),
        count: registrationResult.profiles.length,
        paymentUrl,
        familyId,
        billingAccountId: registrationResult.billingAccount.id,
        primaryContactPointId:
          registrationResult.billingAccount.primaryContactPointId,
      },
    }
  } catch (error) {
    // Handle validation errors (Zod parse failures)
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Invalid registration data',
        errors: error.flatten().fieldErrors,
      }
    }

    // Handle duplicate errors using handlePrismaUniqueError (only if validated exists)
    if (validated) {
      const duplicateError = handlePrismaUniqueError(error, {
        name: validated.children
          .map((c) => `${c.firstName} ${c.lastName}`)
          .join(', '),
        email: validated.parent1Email,
        phone: validated.parent1Phone,
      })

      if (duplicateError) {
        return {
          success: false,
          error: duplicateError.message,
          errors: duplicateError.field
            ? { [duplicateError.field]: [duplicateError.message] }
            : undefined,
        }
      }
    }

    // Handle other errors
    return handleActionError(error, 'registerDugsiChildren', {
      handlers: {
        [PRISMA_ERRORS.FOREIGN_KEY_CONSTRAINT]:
          'Invalid reference in registration data',
        [PRISMA_ERRORS.RECORD_NOT_FOUND]: 'Required record not found',
      },
    })
  } finally {
    revalidatePath('/dugsi/register')
  }
}

// ============================================================================
// UTILITY ACTIONS
// ============================================================================

/**
 * Check if parent email or phone already exists in Dugsi program
 * Checks both email and phone to catch duplicates via either contact method
 */
export async function checkParentEmailExists(
  email: string,
  phone?: string | null
): Promise<boolean> {
  try {
    if (!email || typeof email !== 'string') {
      return false
    }

    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim()

    // Normalize phone if provided
    const normalizedPhone = phone ? normalizePhone(phone) : null

    // Find person by email or phone using findPersonByContact
    const person = await findPersonByContact(normalizedEmail, normalizedPhone)

    if (!person) {
      return false
    }

    // Check if person has a ProgramProfile with DUGSI_PROGRAM
    // OR if person is a guardian of children with DUGSI_PROGRAM profiles
    const hasDugsiProfile = person.programProfiles?.some(
      (profile) => profile.program === 'DUGSI_PROGRAM'
    )

    if (hasDugsiProfile) {
      return true
    }

    // Check if person is a guardian of Dugsi students
    const guardianRelationships = await prisma.guardianRelationship.findMany({
      where: {
        guardianId: person.id,
        isActive: true,
        role: 'PARENT',
      },
      include: {
        dependent: {
          include: {
            programProfiles: {
              where: {
                program: 'DUGSI_PROGRAM',
              },
            },
          },
        },
      },
    })

    const hasDugsiDependents = guardianRelationships.some(
      (rel) => rel.dependent.programProfiles.length > 0
    )

    return hasDugsiDependents
  } catch (error) {
    console.error('[checkParentEmailExists] Error:', error)
    // Return false on error to allow registration to proceed
    // The database constraint will catch duplicates anyway
    return false
  }
}
