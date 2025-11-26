/**
 * Dugsi Family Service
 *
 * Business logic for Dugsi family management operations.
 * Handles parent/guardian updates and child management.
 *
 * Responsibilities:
 * - Update parent information
 * - Add second parent
 * - Update child information
 * - Add child to family
 */

import { EducationLevel, GradeLevel, Prisma } from '@prisma/client'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import {
  getProgramProfileById,
  findPersonByContact,
} from '@/lib/db/queries/program-profile'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'

/**
 * Parent update input
 */
export interface ParentUpdateInput {
  studentId: string
  parentNumber: 1 | 2
  firstName: string
  lastName: string
  phone: string
}

/**
 * Second parent input
 */
export interface SecondParentInput {
  studentId: string
  firstName: string
  lastName: string
  email: string
  phone: string
}

/**
 * Child update input
 */
export interface ChildUpdateInput {
  studentId: string
  firstName?: string
  lastName?: string
  dateOfBirth?: Date
  gender?: 'MALE' | 'FEMALE'
  educationLevel?: EducationLevel
  gradeLevel?: GradeLevel
  schoolName?: string
  healthInfo?: string | null
}

/**
 * New child input
 */
export interface NewChildInput {
  existingStudentId: string
  firstName: string
  lastName: string
  gender: 'MALE' | 'FEMALE'
  dateOfBirth?: Date
  educationLevel: EducationLevel
  gradeLevel: GradeLevel
  schoolName?: string
  healthInfo?: string | null
}

/**
 * Update parent information for entire family (Dugsi program).
 *
 * DESIGN NOTE: Parent emails are immutable for Dugsi families to maintain
 * authentication integrity. Only name and phone can be updated.
 * See parent-service.ts for cross-program guardian updates.
 *
 * @param input - Parent update data
 * @returns Number of updated records
 * @throws Error if student or parent not found
 */
export async function updateParentInfo(
  input: ParentUpdateInput
): Promise<{ updated: number }> {
  const profile = await getProgramProfileById(input.studentId)
  if (!profile || profile.program !== DUGSI_PROGRAM) {
    throw new ActionError(
      'Student not found',
      ERROR_CODES.STUDENT_NOT_FOUND,
      undefined,
      404
    )
  }

  // Get guardian relationships for the profile
  const person = profile.person
  const guardianRelationships = person.guardianRelationships || []
  const guardians = guardianRelationships
    .map((rel) => rel.guardian)
    .filter(Boolean)

  // Get the guardian to update (parent1 or parent2)
  const guardianIndex = input.parentNumber - 1
  const guardian = guardians[guardianIndex]

  if (!guardian) {
    throw new ActionError(
      `Parent ${input.parentNumber} not found`,
      ERROR_CODES.PARENT_NOT_FOUND,
      undefined,
      404
    )
  }

  // Update guardian name and phone in a transaction
  const fullName = `${input.firstName} ${input.lastName}`.trim()
  const existingPhone = guardian.contactPoints?.find(
    (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
  )

  await prisma.$transaction(async (tx) => {
    // Update guardian name
    await tx.person.update({
      where: { id: guardian.id },
      data: { name: fullName },
    })

    // Update or create phone contact point with P2002 race condition handling
    if (existingPhone) {
      await tx.contactPoint.update({
        where: { id: existingPhone.id },
        data: { value: input.phone },
      })
    } else {
      try {
        await tx.contactPoint.create({
          data: {
            personId: guardian.id,
            type: 'PHONE',
            value: input.phone,
          },
        })
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          // Race condition - contact point was created by another transaction
          const existing = await tx.contactPoint.findFirst({
            where: { personId: guardian.id, type: 'PHONE' },
          })
          if (existing) {
            await tx.contactPoint.update({
              where: { id: existing.id },
              data: { value: input.phone },
            })
          }
        } else {
          throw error
        }
      }
    }
  })

  return { updated: 1 }
}

/**
 * Add a second parent to a family.
 *
 * Creates a new Person record and guardian relationship.
 * Only adds if second parent doesn't already exist.
 *
 * @param input - Second parent data
 * @returns Number of updated records
 * @throws Error if student not found or second parent already exists
 */
export async function addSecondParent(
  input: SecondParentInput
): Promise<{ updated: number }> {
  const profile = await getProgramProfileById(input.studentId)
  if (!profile || profile.program !== DUGSI_PROGRAM) {
    throw new ActionError(
      'Student not found',
      ERROR_CODES.STUDENT_NOT_FOUND,
      undefined,
      404
    )
  }

  // Check if second parent already exists
  const person = profile.person
  const guardianRelationships = person.guardianRelationships || []
  const guardians = guardianRelationships
    .map((rel) => rel.guardian)
    .filter(Boolean)

  if (guardians.length >= 2) {
    throw new ActionError(
      'Second parent already exists',
      ERROR_CODES.DUPLICATE_PARENT,
      undefined,
      400
    )
  }

  // Create person and guardian relationship in a transaction with race condition handling
  await prisma.$transaction(async (tx) => {
    let parentPersonId: string
    const normalizedEmail = input.email.toLowerCase().trim()

    // Check if person with this email already exists (inside transaction for consistency)
    const existingPerson = await findPersonByContact(input.email, null)

    if (existingPerson) {
      parentPersonId = existingPerson.id
    } else {
      // Create new person for second parent with race condition handling
      const fullName = `${input.firstName} ${input.lastName}`.trim()
      try {
        const newPerson = await tx.person.create({
          data: {
            name: fullName,
            contactPoints: {
              create: [
                { type: 'EMAIL', value: normalizedEmail },
                { type: 'PHONE', value: input.phone },
              ],
            },
          },
        })
        parentPersonId = newPerson.id
      } catch (error) {
        // Handle P2002 unique constraint violation (race condition)
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          // Another transaction created this person - look them up
          const racedPerson = await findPersonByContact(input.email, null)
          if (!racedPerson) {
            throw new ActionError(
              'Failed to create or find person',
              ERROR_CODES.SERVER_ERROR,
              undefined,
              500
            )
          }
          parentPersonId = racedPerson.id
        } else {
          throw error
        }
      }
    }

    // Create guardian relationship with race condition handling
    try {
      await tx.guardianRelationship.create({
        data: {
          guardianId: parentPersonId,
          dependentId: person.id,
          isActive: true,
        },
      })
    } catch (error) {
      // Handle P2002 if relationship already exists (race condition)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Relationship already exists - this is fine, operation is idempotent
        return
      }
      throw error
    }
  })

  return { updated: 1 }
}

/**
 * Update child information for a specific student.
 *
 * Updates both Person record (name, DOB) and ProgramProfile (education details).
 *
 * @param input - Child update data
 * @throws Error if student not found
 */
export async function updateChildInfo(input: ChildUpdateInput): Promise<void> {
  const profile = await getProgramProfileById(input.studentId)
  if (!profile || profile.program !== DUGSI_PROGRAM) {
    throw new ActionError(
      'Student not found',
      ERROR_CODES.STUDENT_NOT_FOUND,
      undefined,
      404
    )
  }

  // Build Person update data (consolidated into single query)
  const personUpdateData: { name?: string; dateOfBirth?: Date } = {}

  if (input.firstName || input.lastName) {
    const currentName = profile.person.name.split(' ')
    const firstName = input.firstName || currentName[0] || ''
    const lastName = input.lastName || currentName.slice(1).join(' ') || ''
    personUpdateData.name = `${firstName} ${lastName}`.trim()
  }

  if (input.dateOfBirth !== undefined) {
    personUpdateData.dateOfBirth = input.dateOfBirth
  }

  // Update person record (single query for name and DOB)
  if (Object.keys(personUpdateData).length > 0) {
    await prisma.person.update({
      where: { id: profile.personId },
      data: personUpdateData,
    })
  }

  // Update program profile fields
  const profileUpdates: Partial<{
    gender: 'MALE' | 'FEMALE'
    educationLevel: EducationLevel
    gradeLevel: GradeLevel
    schoolName: string | null
    healthInfo: string | null
  }> = {}

  if (input.gender !== undefined) profileUpdates.gender = input.gender
  if (input.educationLevel !== undefined)
    profileUpdates.educationLevel = input.educationLevel
  if (input.gradeLevel !== undefined)
    profileUpdates.gradeLevel = input.gradeLevel
  if (input.schoolName !== undefined)
    profileUpdates.schoolName = input.schoolName || null
  if (input.healthInfo !== undefined)
    profileUpdates.healthInfo = input.healthInfo

  if (Object.keys(profileUpdates).length > 0) {
    await prisma.programProfile.update({
      where: { id: input.studentId },
      data: profileUpdates,
    })
  }
}

/**
 * Add a new child to an existing family.
 *
 * Copies guardian relationships from an existing sibling.
 * Creates Person, ProgramProfile, and Enrollment records.
 *
 * @param input - New child data
 * @returns Created child's ProgramProfile ID
 * @throws Error if existing student or family not found
 */
export async function addChildToFamily(
  input: NewChildInput
): Promise<{ childId: string }> {
  const existingProfile = await getProgramProfileById(input.existingStudentId)
  if (!existingProfile || existingProfile.program !== DUGSI_PROGRAM) {
    throw new ActionError(
      'Existing student not found',
      ERROR_CODES.STUDENT_NOT_FOUND,
      undefined,
      404
    )
  }

  const familyId = existingProfile.familyReferenceId
  if (!familyId) {
    throw new ActionError(
      'Family reference ID not found',
      ERROR_CODES.FAMILY_NOT_FOUND,
      undefined,
      404
    )
  }

  // Get guardian relationships from existing profile
  const person = existingProfile.person
  const guardianRelationships = person.guardianRelationships || []
  const guardians = guardianRelationships
    .map((rel) => rel.guardian)
    .filter(Boolean)

  if (guardians.length === 0) {
    throw new ActionError(
      'No guardians found for existing student',
      ERROR_CODES.FAMILY_NOT_FOUND,
      undefined,
      404
    )
  }

  // Create new child with all related records in a transaction
  const fullName = `${input.firstName} ${input.lastName}`.trim()

  const newProfile = await prisma.$transaction(async (tx) => {
    // Create new person for child
    const newPerson = await tx.person.create({
      data: {
        name: fullName,
        dateOfBirth: input.dateOfBirth || null,
      },
    })

    // Create guardian relationships for all guardians (batch insert)
    await tx.guardianRelationship.createMany({
      data: guardians.map((guardian) => ({
        guardianId: guardian.id,
        dependentId: newPerson.id,
        isActive: true,
      })),
    })

    // Create program profile
    const profile = await tx.programProfile.create({
      data: {
        personId: newPerson.id,
        program: DUGSI_PROGRAM,
        familyReferenceId: familyId,
        gender: input.gender,
        educationLevel: input.educationLevel,
        gradeLevel: input.gradeLevel,
        schoolName: input.schoolName || null,
        healthInfo: input.healthInfo || null,
        status: 'REGISTERED',
      },
    })

    // Create enrollment
    await tx.enrollment.create({
      data: {
        programProfileId: profile.id,
        status: 'REGISTERED',
        startDate: new Date(),
      },
    })

    return profile
  })

  return { childId: newProfile.id }
}
