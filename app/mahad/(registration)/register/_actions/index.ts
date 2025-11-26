'use server'

/**
 * Mahad Registration Server Actions
 *
 * Handles student registration, email validation, search, and sibling management.
 * Uses existing services - this is thin wiring, not new business logic.
 */

import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { MAHAD_PROGRAM } from '@/lib/constants/mahad'
import { prisma } from '@/lib/db'
import { getProgramProfileById } from '@/lib/db/queries/program-profile'
import {
  createSiblingRelationship,
  removeSiblingRelationship,
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

    // Create sibling relationships if provided (batch fetch to avoid N+1)
    if (siblingIds && siblingIds.length > 0) {
      const newProfile = await getProgramProfileById(profile.id)
      if (newProfile) {
        const siblingProfiles = await prisma.programProfile.findMany({
          where: { id: { in: siblingIds } },
          select: { id: true, personId: true },
        })

        try {
          await Promise.all(
            siblingProfiles.map((sp) =>
              createSiblingRelationship(
                newProfile.personId,
                sp.personId,
                'manual',
                null
              )
            )
          )
        } catch (error) {
          // Log but don't fail registration - sibling linking is secondary
          console.warn('Sibling linking partially failed:', error)
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
    // Handle race condition: another request created same email between check and create
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return {
        success: false,
        error: 'A student with this email already exists',
        field: 'email',
      }
    }
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

  // Build AND conditions for name search (more efficient than OR + JS filter)
  const nameConditions: Prisma.PersonWhereInput[] = []
  if (normalizedFirstName) {
    nameConditions.push({
      name: { contains: normalizedFirstName, mode: 'insensitive' },
    })
  }
  if (normalizedLastName) {
    nameConditions.push({
      name: { contains: normalizedLastName, mode: 'insensitive' },
    })
  }

  const profiles = await prisma.programProfile.findMany({
    where: {
      program: MAHAD_PROGRAM,
      status: { not: 'WITHDRAWN' },
      person:
        nameConditions.length > 1 ? { AND: nameConditions } : nameConditions[0],
    },
    include: {
      person: {
        select: {
          name: true,
        },
      },
    },
    take: 50, // Fetch more to account for post-filter reduction
  })

  // Still need JS filter for first/last name position since we store full name
  return profiles
    .filter((profile) => {
      const nameParts = profile.person.name.toLowerCase().split(' ')
      const personFirstName = nameParts[0] || ''
      const personLastName = nameParts.slice(1).join(' ') || ''

      const firstNameMatch =
        !normalizedFirstName || personFirstName.includes(normalizedFirstName)
      const lastNameMatch =
        !normalizedLastName || personLastName.includes(normalizedLastName)

      return firstNameMatch && lastNameMatch
    })
    .slice(0, 20) // Limit final results
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
 */
export async function addSibling(
  studentId: string,
  siblingId: string
): Promise<MahadActionResult> {
  try {
    const [studentProfile, siblingProfile] = await Promise.all([
      getProgramProfileById(studentId),
      getProgramProfileById(siblingId),
    ])

    if (!studentProfile) {
      return { success: false, error: 'Student not found' }
    }
    if (!siblingProfile) {
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
 */
export async function removeSibling(
  studentId: string,
  siblingId: string
): Promise<MahadActionResult> {
  try {
    const [studentProfile, siblingProfile] = await Promise.all([
      getProgramProfileById(studentId),
      getProgramProfileById(siblingId),
    ])

    if (!studentProfile) {
      return { success: false, error: 'Student not found' }
    }
    if (!siblingProfile) {
      return { success: false, error: 'Sibling not found' }
    }

    // Direct query for the specific relationship (sorted IDs for consistency)
    const [p1, p2] = [studentProfile.personId, siblingProfile.personId].sort()
    const relationship = await prisma.siblingRelationship.findFirst({
      where: {
        isActive: true,
        person1Id: p1,
        person2Id: p2,
      },
      select: { id: true },
    })

    if (!relationship) {
      return { success: false, error: 'Sibling relationship not found' }
    }

    await removeSiblingRelationship(relationship.id)

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
