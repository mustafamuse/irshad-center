'use server'

/**
 * Dugsi Registration Server Actions
 *
 * Handles family registration for the Dugsi program.
 * Creates Person records for parents and children, links them via GuardianRelationship,
 * creates ProgramProfiles with DUGSI_PROGRAM, and sets up billing accounts.
 */

import { revalidatePath } from 'next/cache'

import { z } from 'zod'

import { dugsiRegistrationSchema } from '@/lib/registration/schemas/registration'
import { createFamilyRegistration } from '@/lib/services/registration-service'
import { findGuardianByEmail } from '@/lib/services/shared/parent-service'

export type RegistrationResult = {
  success: boolean
  error?: string
  errors?: Record<string, string[]>
  redirectUrl?: string
  data?: {
    paymentUrl?: string
    familyId?: string
    children: { id: string; name: string }[]
    count: number
  }
}

/**
 * Register children for the Dugsi program.
 *
 * Creates:
 * - Parent Person records with ContactPoints (email, phone)
 * - Child Person records
 * - ProgramProfiles for each child (program = DUGSI_PROGRAM)
 * - Enrollments (status = REGISTERED)
 * - GuardianRelationships linking parents to children
 * - BillingAccount for the primary parent
 * - SiblingRelationships between children
 *
 * @param input - Validated form data from dugsiRegistrationSchema
 * @returns RegistrationResult with success status and created data
 */
export async function registerDugsiChildren(
  input: z.infer<typeof dugsiRegistrationSchema>
): Promise<RegistrationResult> {
  try {
    // Validate input at server boundary
    const validated = dugsiRegistrationSchema.parse(input)

    // Generate a unique family reference ID to group siblings
    const familyReferenceId = crypto.randomUUID()

    // Transform form data to match createFamilyRegistration service expectations
    const result = await createFamilyRegistration({
      children: validated.children.map((child) => ({
        firstName: child.firstName,
        lastName: child.lastName,
        dateOfBirth: child.dateOfBirth,
        gender: child.gender,
        gradeLevel: child.gradeLevel,
        schoolName: child.schoolName || null,
        healthInfo: child.healthInfo || null,
      })),
      parent1Email: validated.parent1Email,
      parent1Phone: validated.parent1Phone,
      parent1FirstName: validated.parent1FirstName,
      parent1LastName: validated.parent1LastName,
      // Only include parent 2 if not single parent
      parent2Email: validated.isSingleParent ? null : validated.parent2Email,
      parent2Phone: validated.isSingleParent ? null : validated.parent2Phone,
      parent2FirstName: validated.isSingleParent
        ? null
        : validated.parent2FirstName,
      parent2LastName: validated.isSingleParent
        ? null
        : validated.parent2LastName,
      familyReferenceId,
    })

    // Revalidate admin page to show new registrations
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: {
        familyId: familyReferenceId,
        children: result.profiles.map((p) => ({ id: p.id, name: p.name })),
        count: result.profiles.length,
      },
    }
  } catch (error) {
    // Handle Zod validation errors with field-level detail
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.flatten().fieldErrors as Record<string, string[]>,
      }
    }

    // Handle other errors with generic message
    console.error('Dugsi registration error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed',
    }
  }
}

/**
 * Check if a parent email already exists in the system.
 *
 * Used for duplicate detection and family matching during registration.
 *
 * @param email - Email address to check
 * @returns true if email exists, false otherwise
 */
export async function checkParentEmailExists(email: string): Promise<boolean> {
  try {
    const existing = await findGuardianByEmail(email)
    return existing !== null
  } catch {
    // If check fails, allow registration to continue
    return false
  }
}
