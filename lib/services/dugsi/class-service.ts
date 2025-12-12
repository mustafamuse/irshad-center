import { prisma } from '@/lib/db'
import { getClassByStudentProfile } from '@/lib/db/queries/dugsi-class'
import { getProgramProfileById } from '@/lib/db/queries/program-profile'
import type { DatabaseClient } from '@/lib/db/types'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger, logError } from '@/lib/logger'
import type {
  CreateDugsiClassInput,
  UpdateDugsiClassInput,
  AssignStudentInput,
} from '@/lib/types/dugsi-attendance'
import { isPrismaError, PRISMA_ERRORS } from '@/lib/utils/type-guards'
import {
  CreateDugsiClassSchema,
  UpdateDugsiClassSchema,
  AssignStudentToClassSchema,
} from '@/lib/validations/dugsi-attendance'

const logger = createServiceLogger('dugsi-class-service')

export async function createDugsiClass(input: CreateDugsiClassInput) {
  const validated = CreateDugsiClassSchema.parse(input)
  try {
    const dugsiClass = await prisma.dugsiClass.create({
      data: {
        name: validated.name,
        shift: validated.shift,
        ...(validated.description && { description: validated.description }),
      },
    })

    logger.info(
      {
        classId: dugsiClass.id,
        name: dugsiClass.name,
        shift: dugsiClass.shift,
      },
      'Dugsi class created'
    )

    return dugsiClass
  } catch (error) {
    await logError(logger, error, 'Failed to create Dugsi class', {
      input,
    })
    throw error
  }
}

export async function updateDugsiClass(
  id: string,
  input: UpdateDugsiClassInput
) {
  const validated = UpdateDugsiClassSchema.parse(input)
  try {
    const dugsiClass = await prisma.dugsiClass.update({
      where: { id },
      data: validated,
    })

    logger.info(
      {
        classId: dugsiClass.id,
        updates: input,
      },
      'Dugsi class updated'
    )

    return dugsiClass
  } catch (error) {
    await logError(logger, error, 'Failed to update Dugsi class', {
      classId: id,
      input,
    })
    throw error
  }
}

export async function assignStudentToClass(
  input: AssignStudentInput,
  client: DatabaseClient = prisma
) {
  const validated = AssignStudentToClassSchema.parse(input)
  const { classId, programProfileId } = validated

  try {
    const profile = await getProgramProfileById(programProfileId, client)
    if (!profile) {
      throw new ActionError(
        'Student not found',
        ERROR_CODES.PROFILE_NOT_FOUND,
        'programProfileId',
        404
      )
    }

    if (profile.program !== 'DUGSI_PROGRAM') {
      throw new ActionError(
        'Student is not enrolled in Dugsi program',
        ERROR_CODES.VALIDATION_ERROR,
        'programProfileId',
        400
      )
    }

    const dugsiClass = await client.dugsiClass.findUnique({
      where: { id: classId },
    })

    if (!dugsiClass) {
      throw new ActionError(
        'Dugsi class not found',
        ERROR_CODES.NOT_FOUND,
        'classId',
        404
      )
    }

    if (!dugsiClass.isActive) {
      throw new ActionError(
        'Cannot assign student to inactive class',
        ERROR_CODES.VALIDATION_ERROR,
        'classId',
        400
      )
    }

    const enrollment = await client.dugsiClassEnrollment.create({
      data: {
        classId,
        programProfileId,
      },
    })

    logger.info(
      {
        enrollmentId: enrollment.id,
        classId,
        programProfileId,
      },
      'Student assigned to Dugsi class'
    )

    return enrollment
  } catch (error) {
    if (error instanceof ActionError) {
      throw error
    }
    if (
      isPrismaError(error) &&
      error.code === PRISMA_ERRORS.UNIQUE_CONSTRAINT
    ) {
      const existingEnrollment = await getClassByStudentProfile(
        programProfileId,
        client
      )
      if (existingEnrollment) {
        throw new ActionError(
          `Student is already enrolled in class: ${existingEnrollment.class.name}`,
          ERROR_CODES.VALIDATION_ERROR,
          'programProfileId',
          400
        )
      }
      throw new ActionError(
        'Student is already enrolled in a class',
        ERROR_CODES.VALIDATION_ERROR,
        'programProfileId',
        400
      )
    }
    await logError(logger, error, 'Failed to assign student to class', {
      input,
    })
    throw error
  }
}

export async function removeStudentFromClass(
  enrollmentId: string,
  client: DatabaseClient = prisma
) {
  try {
    const existingEnrollment = await client.dugsiClassEnrollment.findUnique({
      where: { id: enrollmentId },
    })

    if (!existingEnrollment) {
      throw new ActionError(
        'Class enrollment not found',
        ERROR_CODES.NOT_FOUND,
        'enrollmentId',
        404
      )
    }

    const enrollment = await client.dugsiClassEnrollment.update({
      where: { id: enrollmentId },
      data: {
        isActive: false,
        endDate: new Date(),
      },
    })

    logger.info(
      {
        enrollmentId: enrollment.id,
        classId: enrollment.classId,
        programProfileId: enrollment.programProfileId,
      },
      'Student removed from Dugsi class'
    )

    return enrollment
  } catch (error) {
    if (error instanceof ActionError) {
      throw error
    }
    await logError(logger, error, 'Failed to remove student from class', {
      enrollmentId,
    })
    throw error
  }
}
