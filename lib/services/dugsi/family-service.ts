import { GradeLevel, Shift } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import {
  getProgramProfileById,
  findPersonByActiveContact,
  updateFamilyShift as updateFamilyShiftQuery,
} from '@/lib/db/queries/program-profile'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import {
  normalizeEmail,
  normalizePhone,
} from '@/lib/utils/contact-normalization'

export interface ParentUpdateInput {
  /** ID of any student in the family (used to look up family) */
  studentId: string
  /** Which parent to update: 1 = primary, 2 = secondary */
  parentNumber: 1 | 2
  /** Parent's first name (2-50 chars, letters/spaces/hyphens) */
  firstName: string
  /** Parent's last name (2-50 chars, letters/spaces/hyphens) */
  lastName: string
  /** Phone number (any format with 10-15 digits, normalized to digits-only before storage) */
  phone: string
}

export interface SecondParentInput {
  /** ID of any student in the family */
  studentId: string
  /** Second parent's first name */
  firstName: string
  /** Second parent's last name */
  lastName: string
  /** Second parent's email (will be lowercase normalized) */
  email: string
  /** Phone number (any format with 10-15 digits, normalized to digits-only before storage) */
  phone: string
}

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
  gradeLevel?: GradeLevel
  /** Name of school child attends */
  schoolName?: string
  /** Health information, allergies, special needs */
  healthInfo?: string | null
}

/**
 * Parent emails are immutable for Dugsi families (authentication integrity).
 * Only name and phone can be updated here. See parent-service.ts for cross-program updates.
 * @security Authorization must be enforced at the action layer. This service does not verify caller permissions.
 */
export async function updateParentInfo(
  input: ParentUpdateInput
): Promise<{ updated: number }> {
  const normalizedPhone = normalizePhone(input.phone)
  if (!normalizedPhone) {
    throw new ActionError(
      'Invalid phone number. Expected 10-15 digits (e.g. 612-555-1234)',
      ERROR_CODES.VALIDATION_ERROR,
      'phone',
      400
    )
  }

  const profile = await getProgramProfileById(input.studentId)
  if (!profile || profile.program !== DUGSI_PROGRAM) {
    throw new ActionError(
      'Student not found',
      ERROR_CODES.STUDENT_NOT_FOUND,
      undefined,
      404
    )
  }

  const guardians = (profile.person.dependentRelationships || [])
    .map((rel) => rel.guardian)
    .filter(Boolean)

  const guardian = guardians[input.parentNumber - 1]

  if (!guardian) {
    throw new ActionError(
      `Parent ${input.parentNumber} not found`,
      ERROR_CODES.PARENT_NOT_FOUND,
      undefined,
      404
    )
  }

  const fullName = `${input.firstName} ${input.lastName}`.trim()
  await Sentry.startSpan(
    { name: 'family.updateParentInfo', op: 'db' },
    async () => {
      await prisma.person.update({
        where: { id: guardian.id },
        data: { name: fullName, phone: normalizedPhone },
      })
    }
  )

  return { updated: 1 }
}

/**
 * @security Authorization must be enforced at the action layer. This service does not verify caller permissions.
 */
export async function addSecondParent(
  input: SecondParentInput
): Promise<{ updated: number }> {
  const normalizedPhone = normalizePhone(input.phone)
  if (!normalizedPhone) {
    throw new ActionError(
      'Invalid phone number. Expected 10-15 digits (e.g. 612-555-1234)',
      ERROR_CODES.VALIDATION_ERROR,
      'phone',
      400
    )
  }

  const profile = await getProgramProfileById(input.studentId)
  if (!profile || profile.program !== DUGSI_PROGRAM) {
    throw new ActionError(
      'Student not found',
      ERROR_CODES.STUDENT_NOT_FOUND,
      undefined,
      404
    )
  }

  const guardians = (profile.person.dependentRelationships || [])
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

  await Sentry.startSpan(
    { name: 'family.addSecondParent', op: 'db.transaction' },
    async () => {
      await prisma.$transaction(async (tx) => {
        let parentPersonId: string
        const normalizedEmail = normalizeEmail(input.email)

        const existingPerson = await findPersonByActiveContact(
          input.email,
          null,
          tx
        )

        if (existingPerson) {
          parentPersonId = existingPerson.id
          await tx.person.update({
            where: { id: existingPerson.id },
            data: { phone: normalizedPhone },
          })
        } else {
          const fullName = `${input.firstName} ${input.lastName}`.trim()
          const newPerson = await tx.person.create({
            data: {
              name: fullName,
              email: normalizedEmail,
              phone: normalizedPhone,
            },
          })
          parentPersonId = newPerson.id
        }

        const existingRelationship = await tx.guardianRelationship.findFirst({
          where: {
            guardianId: parentPersonId,
            dependentId: profile.person.id,
          },
        })
        if (existingRelationship) {
          if (!existingRelationship.isActive) {
            await tx.guardianRelationship.update({
              where: { id: existingRelationship.id },
              data: { isActive: true, endDate: null },
            })
          }
        } else {
          await tx.guardianRelationship.create({
            data: {
              guardianId: parentPersonId,
              dependentId: profile.person.id,
              isActive: true,
            },
          })
        }
      })
    }
  )

  return { updated: 1 }
}

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

  await Sentry.startSpan(
    { name: 'family.updateChildInfo', op: 'db.transaction' },
    async () => {
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

      if (Object.keys(personUpdateData).length > 0) {
        await prisma.person.update({
          where: { id: profile.personId },
          data: personUpdateData,
        })
      }

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
  )
}

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

  const guardians = (existingProfile.person.dependentRelationships || [])
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

  const fullName = `${input.firstName} ${input.lastName}`.trim()

  const newProfile = await Sentry.startSpan(
    { name: 'family.addChildToFamily', op: 'db.transaction' },
    async () => {
      return prisma.$transaction(async (tx) => {
        const newPerson = await tx.person.create({
          data: {
            name: fullName,
            dateOfBirth: input.dateOfBirth || null,
          },
        })

        await tx.guardianRelationship.createMany({
          data: guardians.map((guardian) => ({
            guardianId: guardian.id,
            dependentId: newPerson.id,
            isActive: true,
          })),
        })

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
            shift: existingProfile.shift,
          },
        })

        await tx.enrollment.create({
          data: {
            programProfileId: profile.id,
            status: 'REGISTERED',
            startDate: new Date(),
          },
        })

        return profile
      })
    }
  )

  return { childId: newProfile.id }
}

export interface SetPrimaryPayerInput {
  /** ID of any student in the family */
  studentId: string
  /** Which parent to set as primary payer: 1 or 2 */
  parentNumber: 1 | 2
}

export async function setPrimaryPayer(
  input: SetPrimaryPayerInput
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

  const familyId = profile.familyReferenceId
  if (!familyId) {
    throw new ActionError(
      'Family reference ID not found',
      ERROR_CODES.FAMILY_NOT_FOUND,
      undefined,
      404
    )
  }

  const guardians = (profile.person.dependentRelationships || []).map(
    (rel) => rel.guardian
  )

  const selectedGuardian = guardians[input.parentNumber - 1]

  if (!selectedGuardian) {
    throw new ActionError(
      `Parent ${input.parentNumber} not found`,
      ERROR_CODES.PARENT_NOT_FOUND,
      undefined,
      404
    )
  }

  const familyProfiles = await prisma.programProfile.findMany({
    where: {
      familyReferenceId: familyId,
      program: DUGSI_PROGRAM,
    },
    select: { personId: true },
  })

  const childPersonIds = familyProfiles.map((p) => p.personId)

  const result = await Sentry.startSpan(
    { name: 'family.setPrimaryPayer', op: 'db.transaction' },
    async () => {
      return prisma.$transaction(async (tx) => {
        await tx.guardianRelationship.updateMany({
          where: {
            dependentId: { in: childPersonIds },
            isActive: true,
          },
          data: { isPrimaryPayer: false },
        })

        const updated = await tx.guardianRelationship.updateMany({
          where: {
            guardianId: selectedGuardian.id,
            dependentId: { in: childPersonIds },
            isActive: true,
          },
          data: { isPrimaryPayer: true },
        })

        return updated.count
      })
    }
  )

  return { updated: result }
}

export interface UpdateShiftInput {
  familyReferenceId: string
  shift: Shift
}

export async function updateFamilyShift(
  input: UpdateShiftInput
): Promise<{ updated: number }> {
  const result = await updateFamilyShiftQuery(
    input.familyReferenceId,
    input.shift,
    DUGSI_PROGRAM
  )

  if (result.count === 0) {
    throw new ActionError(
      'No family members found to update',
      ERROR_CODES.FAMILY_NOT_FOUND,
      undefined,
      404
    )
  }

  return { updated: result.count }
}
