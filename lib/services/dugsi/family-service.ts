import { GradeLevel, Prisma, Shift } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import { createRegisteredEnrollment } from '@/lib/db/queries/enrollment'
import { createPerson, updatePersonFields } from '@/lib/db/queries/person'
import {
  createProgramProfileRecord,
  findProgramProfilePersonIdsByFamily,
  getProgramProfileById,
  findPersonByActiveContact,
  updateFamilyShift as updateFamilyShiftQuery,
  updateProgramProfileFields,
  updateProgramProfileStatusMany,
} from '@/lib/db/queries/program-profile'
import {
  clearAllPrimaryPayers,
  createGuardianRelationshipMinimal,
  createGuardianRelationshipsMinimalBatch,
  findGuardianRelationship,
  reactivateGuardianRelationshipWithEndDate,
  setPrimaryPayerForGuardian,
} from '@/lib/db/queries/relationships'
import {
  ActionError,
  ERROR_CODES,
  throwIfP2002,
} from '@/lib/errors/action-error'
import { createServiceLogger, logError } from '@/lib/logger'
import {
  normalizeEmail,
  normalizePhone,
} from '@/lib/utils/contact-normalization'

import { syncFamilyBillingRate } from './billing-sync-service'

const logger = createServiceLogger('dugsi-family-service')

export interface ParentUpdateInput {
  /** ID of any student in the family (used to look up family) */
  studentId: string
  /** Which parent to update: 1 = primary, 2 = secondary */
  parentNumber: 1 | 2
  /** Parent's first name (2-50 chars, letters/spaces/hyphens) */
  firstName: string
  /** Parent's last name (2-50 chars, letters/spaces/hyphens) */
  lastName: string
  /** Phone number (10-digit US number, normalized before storage) */
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
  /** Phone number (10-digit US number, normalized before storage) */
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
      'Invalid phone number. Expected a 10-digit US number (e.g. 612-555-1234)',
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
      try {
        await updatePersonFields(guardian.id, {
          name: fullName,
          phone: normalizedPhone,
        })
      } catch (error) {
        throwIfP2002(error)
        await logError(logger, error, 'Unexpected DB error in family service', {
          guardianId: guardian.id,
        })
        throw error
      }
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
      'Invalid phone number. Expected a 10-digit US number (e.g. 612-555-1234)',
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

  const normalizedEmail = normalizeEmail(input.email)

  try {
    await Sentry.startSpan(
      { name: 'family.addSecondParent', op: 'db.transaction' },
      async () => {
        await prisma.$transaction(async (tx) => {
          let parentPersonId: string

          const existingPerson = await findPersonByActiveContact(
            normalizedEmail,
            normalizedPhone,
            tx
          )

          if (existingPerson) {
            parentPersonId = existingPerson.id
            const updates: Prisma.PersonUpdateInput = {}
            if (existingPerson.phone !== normalizedPhone)
              updates.phone = normalizedPhone
            if (!existingPerson.email && normalizedEmail)
              updates.email = normalizedEmail
            if (Object.keys(updates).length > 0) {
              await updatePersonFields(existingPerson.id, updates, tx)
            }
          } else {
            const fullName = `${input.firstName} ${input.lastName}`.trim()
            const newPerson = await createPerson(
              {
                name: fullName,
                email: normalizedEmail,
                phone: normalizedPhone,
              },
              tx
            )
            parentPersonId = newPerson.id
          }

          const existingRelationship = await findGuardianRelationship(
            parentPersonId,
            profile.person.id,
            tx
          )
          if (existingRelationship) {
            if (!existingRelationship.isActive) {
              await reactivateGuardianRelationshipWithEndDate(
                existingRelationship.id,
                tx
              )
            }
          } else {
            await createGuardianRelationshipMinimal(
              parentPersonId,
              profile.person.id,
              tx
            )
          }
        })
      }
    )
  } catch (error) {
    throwIfP2002(error)
    await logError(logger, error, 'Unexpected DB error in family service', {
      studentId: input.studentId,
      dependentId: profile?.person.id,
    })
    throw error
  }

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

  try {
    await Sentry.startSpan(
      { name: 'family.updateChildInfo', op: 'db.transaction' },
      async () => {
        const personUpdateData: Prisma.PersonUpdateInput = {}

        if (input.firstName || input.lastName) {
          const currentName = profile.person.name.split(' ')
          const firstName = input.firstName || currentName[0] || ''
          const lastName =
            input.lastName || currentName.slice(1).join(' ') || ''
          personUpdateData.name = `${firstName} ${lastName}`.trim()
        }

        if (input.dateOfBirth !== undefined) {
          personUpdateData.dateOfBirth = input.dateOfBirth
        }

        if (Object.keys(personUpdateData).length > 0) {
          await updatePersonFields(profile.personId, personUpdateData)
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
          await updateProgramProfileFields(input.studentId, profileUpdates)
        }
      }
    )
  } catch (error) {
    throwIfP2002(error)
    await logError(logger, error, 'Failed to update child info', {
      studentId: input.studentId,
    })
    throw error
  }
}

export async function addChildToFamily(
  input: NewChildInput
): Promise<{ childId: string; warning?: string }> {
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

  let newProfile: Awaited<ReturnType<typeof createProgramProfileRecord>>
  try {
    newProfile = await Sentry.startSpan(
      { name: 'family.addChildToFamily', op: 'db.transaction' },
      async () => {
        return prisma.$transaction(async (tx) => {
          const newPerson = await createPerson(
            {
              name: fullName,
              dateOfBirth: input.dateOfBirth || null,
            },
            tx
          )

          await createGuardianRelationshipsMinimalBatch(
            guardians.map((guardian) => ({
              guardianId: guardian.id,
              dependentId: newPerson.id,
            })),
            tx
          )

          const profile = await createProgramProfileRecord(
            {
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
            tx
          )

          await createRegisteredEnrollment(profile.id, new Date(), tx)

          return profile
        })
      }
    )
  } catch (error) {
    throwIfP2002(error)
    await logError(logger, error, 'Failed to add child to family', {
      existingStudentId: input.existingStudentId,
    })
    throw error
  }

  try {
    const sync = await syncFamilyBillingRate(familyId)
    return { childId: newProfile.id, warning: sync.warning }
  } catch (error) {
    await logError(logger, error, 'Billing sync failed after adding child', {
      childId: newProfile.id,
      familyReferenceId: familyId,
    })
    return {
      childId: newProfile.id,
      warning:
        'Child added, but the billing update failed. Use Recalculate rate to retry.',
    }
  }
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

  const familyProfiles = await findProgramProfilePersonIdsByFamily(
    familyId,
    DUGSI_PROGRAM
  )

  const childPersonIds = familyProfiles.map((p) => p.personId)

  let result: number
  try {
    result = await Sentry.startSpan(
      { name: 'family.setPrimaryPayer', op: 'db.transaction' },
      async () => {
        return prisma.$transaction(async (tx) => {
          await clearAllPrimaryPayers(childPersonIds, tx)

          const updated = await setPrimaryPayerForGuardian(
            selectedGuardian.id,
            childPersonIds,
            tx
          )

          return updated.count
        })
      }
    )
  } catch (error) {
    await logError(logger, error, 'Failed to set primary payer', {
      studentId: input.studentId,
    })
    throw error
  }

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

/**
 * @security Authorization must be enforced at the action layer. This service does not verify caller permissions.
 */
export async function reEnrollChild(
  profileId: string
): Promise<{ childId: string; warning?: string }> {
  const profile = await getProgramProfileById(profileId)
  if (!profile || profile.program !== DUGSI_PROGRAM) {
    throw new ActionError(
      'Student not found',
      ERROR_CODES.STUDENT_NOT_FOUND,
      undefined,
      404
    )
  }
  if (profile.status !== 'WITHDRAWN') {
    throw new ActionError(
      'Child is not withdrawn and cannot be re-enrolled',
      ERROR_CODES.INVALID_INPUT,
      undefined,
      409
    )
  }
  if (!profile.familyReferenceId) {
    throw new ActionError(
      'Family reference ID not found',
      ERROR_CODES.FAMILY_NOT_FOUND,
      undefined,
      404
    )
  }

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    const updated = await updateProgramProfileStatusMany(
      [profileId],
      'REGISTERED',
      ['WITHDRAWN'],
      tx
    )
    if (updated.count !== 1) {
      throw new ActionError(
        'Child status changed during re-enrollment. Please refresh and try again.',
        ERROR_CODES.INVALID_INPUT,
        undefined,
        409
      )
    }
    await createRegisteredEnrollment(profileId, now, tx)
  })

  try {
    const sync = await syncFamilyBillingRate(profile.familyReferenceId)
    return { childId: profileId, warning: sync.warning }
  } catch (error) {
    await logError(logger, error, 'Billing sync failed after re-enrollment', {
      profileId,
      familyReferenceId: profile.familyReferenceId,
    })
    return {
      childId: profileId,
      warning:
        'Child re-enrolled, but the billing update failed. Use Recalculate rate to retry.',
    }
  }
}
