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

import { GradeLevel, Prisma } from '@prisma/client'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import {
  getProgramProfileById,
  findPersonByContact,
} from '@/lib/db/queries/program-profile'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger } from '@/lib/logger'

const _logger = createServiceLogger('dugsi-family')

/** Phone format: XXX-XXX-XXXX */
const PHONE_REGEX = /^\d{3}-\d{3}-\d{4}$/

/**
 * Validates phone number format.
 * Service-layer validation ensures data integrity even when called directly.
 */
function validatePhoneFormat(phone: string): void {
  if (!phone || !PHONE_REGEX.test(phone)) {
    throw new ActionError(
      'Invalid phone format. Expected XXX-XXX-XXXX',
      ERROR_CODES.VALIDATION_ERROR,
      'phone',
      400
    )
  }
}

/**
 * Parent update input
 */
export interface ParentUpdateInput {
  /** ID of any student in the family (used to look up family) */
  studentId: string
  /** Which parent to update: 1 = primary, 2 = secondary */
  parentNumber: 1 | 2
  /** Parent's first name (2-50 chars, letters/spaces/hyphens) */
  firstName: string
  /** Parent's last name (2-50 chars, letters/spaces/hyphens) */
  lastName: string
  /** Phone in XXX-XXX-XXXX format */
  phone: string
}

/**
 * Second parent input
 */
export interface SecondParentInput {
  /** ID of any student in the family */
  studentId: string
  /** Second parent's first name */
  firstName: string
  /** Second parent's last name */
  lastName: string
  /** Second parent's email (will be lowercase normalized) */
  email: string
  /** Second parent's phone in XXX-XXX-XXXX format */
  phone: string
}

/**
 * Child update input - at least one optional field must be provided
 */
export interface ChildUpdateInput {
  /** ProgramProfile ID of the student to update */
  studentId: string
  /** Child's first name */
  firstName?: string
  /** Child's last name */
  lastName?: string
  /** Child's date of birth */
  dateOfBirth?: Date
  /** Child's gender */
  gender?: 'MALE' | 'FEMALE'
  /** Current grade level (e.g., GRADE_1, GRADE_2) - K-12 for Dugsi */
  gradeLevel?: GradeLevel
  /** Name of school child attends */
  schoolName?: string
  /** Health information, allergies, special needs (null to clear) */
  healthInfo?: string | null
}

/**
 * New child input - used to add a sibling to an existing family
 */
export interface NewChildInput {
  /** ProgramProfile ID of an existing sibling (to copy family/guardian relationships) */
  existingStudentId: string
  /** New child's first name */
  firstName: string
  /** New child's last name */
  lastName: string
  /** New child's gender */
  gender: 'MALE' | 'FEMALE'
  /** New child's date of birth */
  dateOfBirth?: Date
  /** Current grade level - K-12 for Dugsi */
  gradeLevel: GradeLevel
  /** Name of school child attends */
  schoolName?: string
  /** Health information, allergies, special needs */
  healthInfo?: string | null
}

/**
 * Update parent information for entire family (Dugsi program).
 *
 * DESIGN NOTE: Parent emails are immutable for Dugsi families to maintain
 * authentication integrity. Only name and phone can be updated.
 * See parent-service.ts for cross-program guardian updates.
 *
 * @security Authorization must be enforced at the API route/action layer.
 *           This service does not verify the caller has permission to modify.
 *
 * @param input - Parent update data
 * @returns Number of updated records
 * @throws Error if student or parent not found
 */
export async function updateParentInfo(
  input: ParentUpdateInput
): Promise<{ updated: number }> {
  // Validate phone format before proceeding
  validatePhoneFormat(input.phone)

  const profile = await getProgramProfileById(input.studentId)
  if (!profile || profile.program !== DUGSI_PROGRAM) {
    throw new ActionError(
      'Student not found',
      ERROR_CODES.STUDENT_NOT_FOUND,
      undefined,
      404
    )
  }

  // Get guardian relationships for the profile (child is dependent, parents are guardians)
  const person = profile.person
  const dependentRelationships = person.dependentRelationships || []
  const guardians = dependentRelationships
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
 * @security Authorization must be enforced at the API route/action layer.
 *           This service does not verify the caller has permission to modify.
 *
 * @param input - Second parent data
 * @returns Number of updated records
 * @throws Error if student not found or second parent already exists
 */
export async function addSecondParent(
  input: SecondParentInput
): Promise<{ updated: number }> {
  // Validate phone format before proceeding
  validatePhoneFormat(input.phone)

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
  const dependentRelationships = person.dependentRelationships || []
  const guardians = dependentRelationships
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

    // Check if person with this email already exists (using tx for true TOCTOU safety)
    const existingPerson = await findPersonByContact(input.email, null, tx)

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
          // Another transaction created this person - look them up (using tx)
          const racedPerson = await findPersonByContact(input.email, null, tx)
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
 * @security Authorization must be enforced at the API route/action layer.
 *           This service does not verify the caller has permission to modify.
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
    gradeLevel: GradeLevel
    schoolName: string | null
    healthInfo: string | null
  }> = {}

  if (input.gender !== undefined) profileUpdates.gender = input.gender
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
 * @security Authorization must be enforced at the API route/action layer.
 *           This service does not verify the caller has permission to modify.
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

  // Get guardian relationships from existing profile (child is dependent, parents are guardians)
  const person = existingProfile.person
  const dependentRelationships = person.dependentRelationships || []
  const guardians = dependentRelationships
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
