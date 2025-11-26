'use server'

/**
 * Mahad Registration Server Actions
 *
 * Handles student registration, email validation, search, and sibling management.
 * Uses existing services - this is thin wiring, not new business logic.
 */

import { z } from 'zod'

import { MAHAD_PROGRAM } from '@/lib/constants/mahad'
import { prisma } from '@/lib/db'
import { getProgramProfileById } from '@/lib/db/queries/program-profile'
import {
  createSiblingRelationship,
  removeSiblingRelationship,
  getPersonSiblings,
} from '@/lib/db/queries/siblings'
import { mahadRegistrationSchema } from '@/lib/registration/schemas/registration'
import { createMahadStudent } from '@/lib/services/mahad/student-service'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Keep custom ActionResult for field-level validation errors
// (The generic ActionResult doesn't support field-specific errors)
type MahadActionResult<T = void> = T extends void
  ? {
      success: boolean
      data?: never
      error?: string
      field?: 'email' | 'phone' | 'firstName' | 'lastName' | 'dateOfBirth'
    }
  :
      | {
          success: true
          data: T
        }
      | {
          success: false
          error: string
          field?: 'email' | 'phone' | 'firstName' | 'lastName' | 'dateOfBirth'
        }

type StudentSearchResult = { id: string; name: string; lastName: string }

// ============================================================================
// REGISTRATION ACTIONS
// ============================================================================

/**
 * Register a new Mahad student with optional siblings
 *
 * Uses createMahadStudent() service which handles:
 * - Person + ContactPoints creation
 * - ProgramProfile creation for MAHAD_PROGRAM
 * - Optional enrollment in batch
 *
 * Note: There's a potential race condition between checkEmailExists() and
 * createMahadStudent(). The underlying service handles P2002 (unique constraint)
 * errors gracefully - if another request creates the same email, this may
 * result in a new ProgramProfile for an existing Person rather than a failure.
 */
export async function registerStudent(input: {
  studentData: z.infer<typeof mahadRegistrationSchema>
  siblingIds: string[] | null
}): Promise<MahadActionResult<{ id: string; name: string }>> {
  try {
    const { studentData, siblingIds } = input

    // Validate input
    const validationResult = mahadRegistrationSchema.safeParse(studentData)
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0]
      return {
        success: false,
        error: firstError.message,
        field: firstError.path[0] as
          | 'email'
          | 'phone'
          | 'firstName'
          | 'lastName'
          | 'dateOfBirth',
      }
    }

    const data = validationResult.data
    const fullName = `${data.firstName} ${data.lastName}`.trim()

    // Check if email already exists
    const emailExists = await checkEmailExists(data.email)
    if (emailExists) {
      return {
        success: false,
        error: 'A student with this email already exists',
        field: 'email',
      }
    }

    // Create student using existing service
    const profile = await createMahadStudent({
      name: fullName,
      email: data.email,
      phone: data.phone,
      dateOfBirth: data.dateOfBirth,
      educationLevel: data.educationLevel,
      gradeLevel: data.gradeLevel,
      schoolName: data.schoolName,
    })

    // Create sibling relationships if provided
    if (siblingIds && siblingIds.length > 0) {
      // Get the person ID for the newly created profile
      const newProfile = await getProgramProfileById(profile.id)
      if (newProfile) {
        for (const siblingId of siblingIds) {
          // Get sibling's person ID
          const siblingProfile = await getProgramProfileById(siblingId)
          if (siblingProfile) {
            await createSiblingRelationship(
              newProfile.personId,
              siblingProfile.personId,
              'manual',
              null
            )
          }
        }
      }
    }

    return {
      success: true,
      data: {
        id: profile.id,
        name: fullName,
      },
    }
  } catch (error) {
    console.error('Registration error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Registration failed. Please try again.',
    }
  }
}

// ============================================================================
// UTILITY ACTIONS
// ============================================================================

/**
 * Check if email already exists in the system
 *
 * Queries ContactPoint table for EMAIL type with case-insensitive match.
 */
export async function checkEmailExists(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim()

  const existingContact = await prisma.contactPoint.findFirst({
    where: {
      type: 'EMAIL',
      value: normalizedEmail,
    },
  })

  return existingContact !== null
}

/**
 * Search students by first and last name for sibling matching
 *
 * Returns Mahad program profiles matching the name criteria.
 *
 * Search behavior:
 * - Performs case-insensitive partial matching
 * - Uses OR logic for DB query (contains firstName OR lastName)
 * - Then filters results to require both parts match (AND logic)
 * - First name must be contained in the first word of the stored name
 * - Last name must be contained in the remaining words of the stored name
 *
 * @param firstName - First name to search for (partial match)
 * @param lastName - Last name to search for (partial match)
 * @returns Array of matching students with id, name, and lastName
 */
export async function searchStudents(
  firstName: string,
  lastName: string
): Promise<StudentSearchResult[]> {
  const normalizedFirstName = firstName.trim().toLowerCase()
  const normalizedLastName = lastName.trim().toLowerCase()

  if (!normalizedFirstName && !normalizedLastName) {
    return []
  }

  // Build search query for Person by name
  const profiles = await prisma.programProfile.findMany({
    where: {
      program: MAHAD_PROGRAM,
      status: { not: 'WITHDRAWN' },
      person: {
        name: {
          contains: normalizedFirstName || normalizedLastName,
          mode: 'insensitive',
        },
      },
    },
    include: {
      person: {
        select: {
          name: true,
        },
      },
    },
    take: 20, // Limit results
  })

  // Filter and map results
  return profiles
    .filter((profile) => {
      const nameParts = profile.person.name.toLowerCase().split(' ')
      const personFirstName = nameParts[0] || ''
      const personLastName = nameParts.slice(1).join(' ') || ''

      // Match if either name part matches
      const firstNameMatch =
        !normalizedFirstName || personFirstName.includes(normalizedFirstName)
      const lastNameMatch =
        !normalizedLastName || personLastName.includes(normalizedLastName)

      return firstNameMatch && lastNameMatch
    })
    .map((profile) => {
      const nameParts = profile.person.name.split(' ')
      return {
        id: profile.id,
        name: nameParts[0] || profile.person.name,
        lastName: nameParts.slice(1).join(' ') || '',
      }
    })
}

/**
 * Add sibling relationship between two students
 *
 * Creates a SiblingRelationship record linking the two Person records.
 *
 * @param studentId - ProgramProfile ID of the student
 * @param siblingId - ProgramProfile ID of the sibling to add
 */
export async function addSibling(
  studentId: string,
  siblingId: string
): Promise<MahadActionResult> {
  try {
    // Input validation
    if (!studentId || !siblingId) {
      return { success: false, error: 'Student ID and sibling ID are required' }
    }

    // Get both profiles to access person IDs
    const [studentProfile, siblingProfile] = await Promise.all([
      getProgramProfileById(studentId),
      getProgramProfileById(siblingId),
    ])

    if (!studentProfile) {
      console.error(`addSibling: Student profile not found: ${studentId}`)
      return { success: false, error: 'Student not found' }
    }
    if (!siblingProfile) {
      console.error(`addSibling: Sibling profile not found: ${siblingId}`)
      return { success: false, error: 'Sibling not found' }
    }

    // Prevent self-linking
    if (studentProfile.personId === siblingProfile.personId) {
      return { success: false, error: 'Cannot add self as sibling' }
    }

    // Create relationship using existing query helper
    await createSiblingRelationship(
      studentProfile.personId,
      siblingProfile.personId,
      'manual',
      null
    )

    return { success: true }
  } catch (error) {
    console.error('Add sibling error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add sibling',
    }
  }
}

/**
 * Remove sibling relationship between two students
 *
 * Soft-deletes the SiblingRelationship by marking it inactive.
 *
 * @param studentId - ProgramProfile ID of the student
 * @param siblingId - ProgramProfile ID of the sibling to remove
 */
export async function removeSibling(
  studentId: string,
  siblingId: string
): Promise<MahadActionResult> {
  try {
    // Input validation
    if (!studentId || !siblingId) {
      return { success: false, error: 'Student ID and sibling ID are required' }
    }

    // Get both profiles to access person IDs
    const [studentProfile, siblingProfile] = await Promise.all([
      getProgramProfileById(studentId),
      getProgramProfileById(siblingId),
    ])

    if (!studentProfile) {
      console.error(`removeSibling: Student profile not found: ${studentId}`)
      return { success: false, error: 'Student not found' }
    }
    if (!siblingProfile) {
      console.error(`removeSibling: Sibling profile not found: ${siblingId}`)
      return { success: false, error: 'Sibling not found' }
    }

    // Find the sibling relationship
    const siblings = await getPersonSiblings(studentProfile.personId)
    const relationship = siblings.find(
      (s) => s.person.id === siblingProfile.personId
    )

    if (!relationship) {
      return { success: false, error: 'Sibling relationship not found' }
    }

    // Remove relationship using existing query helper
    await removeSiblingRelationship(relationship.relationshipId)

    return { success: true }
  } catch (error) {
    console.error('Remove sibling error:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to remove sibling',
    }
  }
}

// Export the type for consumers that need field-level errors
export type { MahadActionResult }
