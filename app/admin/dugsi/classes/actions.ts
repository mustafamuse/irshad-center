'use server'

import { revalidatePath } from 'next/cache'

import { Shift } from '@prisma/client'

import { prisma } from '@/lib/db'
import {
  getAllDugsiClasses,
  getDugsiClassById,
  getStudentsInClass,
} from '@/lib/db/queries/dugsi-class'
import { createActionLogger } from '@/lib/logger'
import {
  createDugsiClass,
  updateDugsiClass,
  assignStudentToClass,
  removeStudentFromClass,
} from '@/lib/services/dugsi/class-service'
import type {
  DugsiClassDTO,
  ClassStudentDTO,
} from '@/lib/types/dugsi-attendance'
import { ActionResult, handleActionError } from '@/lib/utils/action-helpers'
import { PRISMA_ERRORS } from '@/lib/utils/type-guards'
import {
  CreateDugsiClassSchema,
  UpdateDugsiClassSchema,
  AssignStudentToClassSchema,
} from '@/lib/validations/dugsi-attendance'

const logger = createActionLogger('dugsi-classes')

export async function getClassesAction(options?: {
  activeOnly?: boolean
  shift?: Shift
}): Promise<ActionResult<DugsiClassDTO[]>> {
  try {
    const classes = await getAllDugsiClasses(options)
    return { success: true, data: classes }
  } catch (error) {
    return handleActionError(error, 'getClassesAction', logger)
  }
}

export async function getClassByIdAction(
  classId: string
): Promise<ActionResult<DugsiClassDTO | null>> {
  try {
    const dugsiClass = await getDugsiClassById(classId)
    return { success: true, data: dugsiClass }
  } catch (error) {
    return handleActionError(error, 'getClassByIdAction', logger)
  }
}

export async function getStudentsInClassAction(
  classId: string
): Promise<ActionResult<ClassStudentDTO[]>> {
  try {
    const students = await getStudentsInClass(classId)
    return { success: true, data: students }
  } catch (error) {
    return handleActionError(error, 'getStudentsInClassAction', logger)
  }
}

export async function createClassAction(data: {
  name: string
  shift: Shift
  description?: string
}): Promise<ActionResult<DugsiClassDTO>> {
  try {
    const validated = CreateDugsiClassSchema.parse(data)
    const dugsiClass = await createDugsiClass(validated)

    revalidatePath('/admin/dugsi/classes')
    revalidatePath('/admin/dugsi/attendance')

    return {
      success: true,
      data: {
        id: dugsiClass.id,
        name: dugsiClass.name,
        shift: dugsiClass.shift,
        description: dugsiClass.description,
        isActive: dugsiClass.isActive,
        studentCount: 0,
        createdAt: dugsiClass.createdAt,
      },
    }
  } catch (error) {
    return handleActionError(error, 'createClassAction', logger, {
      handlers: {
        [PRISMA_ERRORS.UNIQUE_CONSTRAINT]: `A class with the name "${data.name}" already exists`,
      },
    })
  }
}

export async function updateClassAction(
  classId: string,
  data: {
    name?: string
    shift?: Shift
    description?: string
    isActive?: boolean
  }
): Promise<ActionResult<DugsiClassDTO>> {
  try {
    const validated = UpdateDugsiClassSchema.parse(data)

    const existingClass = await getDugsiClassById(classId)
    if (!existingClass) {
      return { success: false, error: 'Class not found' }
    }

    const dugsiClass = await updateDugsiClass(classId, validated)

    revalidatePath('/admin/dugsi/classes')
    revalidatePath('/admin/dugsi/attendance')

    return {
      success: true,
      data: {
        id: dugsiClass.id,
        name: dugsiClass.name,
        shift: dugsiClass.shift,
        description: dugsiClass.description,
        isActive: dugsiClass.isActive,
        studentCount: existingClass.studentCount,
        createdAt: dugsiClass.createdAt,
      },
    }
  } catch (error) {
    return handleActionError(error, 'updateClassAction', logger, {
      handlers: {
        [PRISMA_ERRORS.UNIQUE_CONSTRAINT]: `A class with the name "${data.name}" already exists`,
        [PRISMA_ERRORS.RECORD_NOT_FOUND]: 'Class not found',
      },
    })
  }
}

export async function assignStudentToClassAction(
  classId: string,
  programProfileId: string
): Promise<ActionResult<{ enrollmentId: string }>> {
  try {
    const validated = AssignStudentToClassSchema.parse({
      classId,
      programProfileId,
    })
    const enrollment = await assignStudentToClass(validated)

    revalidatePath('/admin/dugsi/classes')
    revalidatePath('/admin/dugsi/attendance')

    return {
      success: true,
      data: { enrollmentId: enrollment.id },
    }
  } catch (error) {
    return handleActionError(error, 'assignStudentToClassAction', logger, {
      handlers: {
        [PRISMA_ERRORS.UNIQUE_CONSTRAINT]:
          'Student is already enrolled in a class',
        [PRISMA_ERRORS.FOREIGN_KEY_CONSTRAINT]:
          'Invalid class or student reference',
      },
    })
  }
}

export async function removeStudentFromClassAction(
  enrollmentId: string
): Promise<ActionResult> {
  try {
    await removeStudentFromClass(enrollmentId)

    revalidatePath('/admin/dugsi/classes')
    revalidatePath('/admin/dugsi/attendance')

    return { success: true }
  } catch (error) {
    return handleActionError(error, 'removeStudentFromClassAction', logger, {
      handlers: {
        [PRISMA_ERRORS.RECORD_NOT_FOUND]: 'Enrollment not found',
      },
    })
  }
}

export async function bulkAssignStudentsToClassAction(
  classId: string,
  programProfileIds: string[]
): Promise<
  ActionResult<{ assignedCount: number; failedAssignments: string[] }>
> {
  try {
    if (!Array.isArray(programProfileIds) || programProfileIds.length === 0) {
      return { success: false, error: 'No students selected for assignment' }
    }

    const existingClass = await getDugsiClassById(classId)
    if (!existingClass) {
      return { success: false, error: 'Class not found' }
    }

    if (!existingClass.isActive) {
      return {
        success: false,
        error: 'Cannot assign students to inactive class',
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const profiles = await tx.programProfile.findMany({
        where: {
          id: { in: programProfileIds },
          program: 'DUGSI_PROGRAM',
        },
        select: { id: true },
      })

      const validProfileIds = new Set(profiles.map((p) => p.id))
      const invalidIds = programProfileIds.filter(
        (id) => !validProfileIds.has(id)
      )

      if (invalidIds.length > 0) {
        logger.warn(
          { invalidIds },
          'Some profiles not found or not Dugsi students'
        )
      }

      const createResult = await tx.dugsiClassEnrollment.createMany({
        data: profiles.map((p) => ({
          classId,
          programProfileId: p.id,
        })),
        skipDuplicates: true,
      })

      return {
        assignedCount: createResult.count,
        failedAssignments: invalidIds,
      }
    })

    revalidatePath('/admin/dugsi/classes')
    revalidatePath('/admin/dugsi/attendance')

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    return handleActionError(error, 'bulkAssignStudentsToClassAction', logger)
  }
}
