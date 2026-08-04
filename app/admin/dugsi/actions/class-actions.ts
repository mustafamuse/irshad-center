'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'

import { Prisma, Shift } from '@prisma/client'
import { z } from 'zod'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import {
  getClassesWithDetails,
  getAllTeachersForAssignment,
  getAvailableStudentsForClass,
  getUnassignedDugsiStudents,
  assignTeacherToClass,
  removeTeacherFromClass,
  enrollStudentInClass,
  removeStudentFromClass,
  bulkEnrollStudents,
  createClass,
  updateClass,
  deleteClass,
  getClassById,
  getClassPreviewForDelete,
} from '@/lib/db/queries/dugsi-class'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import {
  ClassNotFoundError,
  TeacherNotAuthorizedError,
} from '@/lib/errors/dugsi-class-errors'
import { createServiceLogger } from '@/lib/logger'
import { adminActionClient } from '@/lib/safe-action'
import { getTeachersByProgram as getTeachersByProgramService } from '@/lib/services/shared/teacher-service'
import {
  AssignTeacherToClassSchema,
  RemoveTeacherFromClassSchema,
  EnrollStudentInClassSchema,
  RemoveStudentFromClassSchema,
  BulkEnrollStudentsSchema,
  CreateClassSchema,
  UpdateClassSchema,
  DeleteClassSchema,
} from '@/lib/validations/dugsi-class'

import {
  ClassWithDetails,
  StudentForEnrollment,
  UnassignedStudent,
} from '../_types'

const logger = createServiceLogger('dugsi-admin-actions')

const ClassIdSchema = z.object({ classId: z.string().min(1) })

const _getAvailableDugsiTeachers = adminActionClient
  .metadata({ actionName: 'getAvailableDugsiTeachers' })
  .action(
    async (): Promise<
      Array<{
        id: string
        name: string
        email: string | null
        phone: string | null
      }>
    > => {
      const teachers = await getTeachersByProgramService(DUGSI_PROGRAM)
      return teachers.map((t) => ({
        id: t.id,
        name: t.person.name,
        email: t.person.email,
        phone: t.person.phone,
      }))
    }
  )

const _getUnassignedStudentsAction = adminActionClient
  .metadata({ actionName: 'getUnassignedStudentsAction' })
  .action(async (): Promise<UnassignedStudent[]> => {
    return await getUnassignedDugsiStudents()
  })

const _getClassesWithDetailsAction = adminActionClient
  .metadata({ actionName: 'getClassesWithDetailsAction' })
  .action(async (): Promise<ClassWithDetails[]> => {
    const classes = await getClassesWithDetails()
    return classes.map((c) => ({
      id: c.id,
      name: c.name,
      shift: c.shift,
      description: c.description,
      isActive: c.isActive,
      teachers: c.teachers.map((t) => ({
        id: t.id,
        teacherId: t.teacherId,
        teacherName: t.teacher.person.name,
      })),
      studentCount: c.students.length,
    }))
  })

const _getAllTeachersForClassAssignmentAction = adminActionClient
  .metadata({ actionName: 'getAllTeachersForClassAssignmentAction' })
  .action(async (): Promise<Array<{ id: string; name: string }>> => {
    return await getAllTeachersForAssignment()
  })

const _getAvailableStudentsForClassAction = adminActionClient
  .metadata({ actionName: 'getAvailableStudentsForClassAction' })
  .schema(z.object({ shift: z.nativeEnum(Shift) }))
  .action(async ({ parsedInput }): Promise<StudentForEnrollment[]> => {
    return await getAvailableStudentsForClass(parsedInput.shift)
  })

const _getClassDeletePreviewAction = adminActionClient
  .metadata({ actionName: 'getClassDeletePreviewAction' })
  .schema(ClassIdSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<{ teacherCount: number; studentCount: number }> => {
      const preview = await getClassPreviewForDelete(parsedInput.classId)
      if (!preview) {
        throw new ActionError(
          'Class not found',
          ERROR_CODES.NOT_FOUND,
          undefined,
          404
        )
      }
      return preview
    }
  )

const _assignTeacherToClassAction = adminActionClient
  .metadata({ actionName: 'assignTeacherToClassAction' })
  .schema(AssignTeacherToClassSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    const { classId, teacherId } = parsedInput
    try {
      await assignTeacherToClass(classId, teacherId)
    } catch (error) {
      if (error instanceof ClassNotFoundError) {
        throw new ActionError(
          'Class not found or has been deactivated',
          ERROR_CODES.NOT_FOUND
        )
      }
      if (error instanceof TeacherNotAuthorizedError) {
        throw new ActionError(
          'Teacher must be enrolled in Dugsi program before assignment',
          ERROR_CODES.UNAUTHORIZED
        )
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ActionError(
          'This teacher is already assigned to this class',
          ERROR_CODES.VALIDATION_ERROR
        )
      }
      throw error
    }

    after(() => {
      revalidatePath('/admin/dugsi/classes')
      revalidatePath('/teacher/checkin')
    })
    logger.info({ classId, teacherId }, 'Teacher assigned to class')
    return { message: 'Teacher assigned to class' }
  })

const _removeTeacherFromClassAction = adminActionClient
  .metadata({ actionName: 'removeTeacherFromClassAction' })
  .schema(RemoveTeacherFromClassSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    const { classId, teacherId } = parsedInput
    await removeTeacherFromClass(classId, teacherId)
    after(() => {
      revalidatePath('/admin/dugsi/classes')
      revalidatePath('/teacher/checkin')
    })
    logger.info({ classId, teacherId }, 'Teacher removed from class')
    return { message: 'Teacher removed from class' }
  })

const _enrollStudentInClassAction = adminActionClient
  .metadata({ actionName: 'enrollStudentInClassAction' })
  .schema(EnrollStudentInClassSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    const { classId, programProfileId } = parsedInput
    try {
      await enrollStudentInClass(classId, programProfileId)
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ActionError(
          'This student is already enrolled in a class',
          ERROR_CODES.VALIDATION_ERROR
        )
      }
      throw error
    }
    after(() => {
      revalidatePath('/admin/dugsi/classes')
    })
    logger.info({ classId, programProfileId }, 'Student enrolled in class')
    return { message: 'Student enrolled in class' }
  })

const _removeStudentFromClassAction = adminActionClient
  .metadata({ actionName: 'removeStudentFromClassAction' })
  .schema(RemoveStudentFromClassSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    const { programProfileId } = parsedInput
    await removeStudentFromClass(programProfileId)
    after(() => {
      revalidatePath('/admin/dugsi/classes')
    })
    logger.info({ programProfileId }, 'Student removed from class')
    return { message: 'Student removed from class' }
  })

const _bulkEnrollStudentsAction = adminActionClient
  .metadata({ actionName: 'bulkEnrollStudentsAction' })
  .schema(BulkEnrollStudentsSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<{ enrolled: number; moved: number; message: string }> => {
      const { classId, programProfileIds } = parsedInput
      const result = await bulkEnrollStudents(classId, programProfileIds)
      after(() => {
        revalidatePath('/admin/dugsi/classes')
      })
      logger.info(
        { classId, enrolled: result.enrolled, moved: result.moved },
        'Bulk enrollment completed'
      )
      return {
        ...result,
        message: `Enrolled ${result.enrolled} students${result.moved > 0 ? ` (${result.moved} moved from other classes)` : ''}`,
      }
    }
  )

const _createClassAction = adminActionClient
  .metadata({ actionName: 'createClassAction' })
  .schema(CreateClassSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<ClassWithDetails & { message: string }> => {
      const { name, shift, description } = parsedInput
      try {
        const newClass = await createClass(name, shift as Shift, description)
        after(() => {
          revalidatePath('/admin/dugsi/classes')
          revalidatePath('/teacher/checkin')
        })
        logger.info({ classId: newClass.id, name, shift }, 'Class created')
        return {
          id: newClass.id,
          name: newClass.name,
          shift: newClass.shift,
          description: newClass.description,
          isActive: newClass.isActive,
          teachers: [],
          studentCount: 0,
          message: 'Class created successfully',
        }
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          throw new ActionError(
            'A class with this name already exists for this shift',
            ERROR_CODES.VALIDATION_ERROR
          )
        }
        throw error
      }
    }
  )

const _updateClassAction = adminActionClient
  .metadata({ actionName: 'updateClassAction' })
  .schema(UpdateClassSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<ClassWithDetails & { message: string }> => {
      const { classId, name, description } = parsedInput
      try {
        await updateClass(classId, { name, description })
      } catch (error) {
        if (error instanceof ClassNotFoundError) {
          throw new ActionError(
            'Class not found or has been deactivated',
            ERROR_CODES.NOT_FOUND
          )
        }
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          throw new ActionError(
            'A class with this name already exists',
            ERROR_CODES.VALIDATION_ERROR
          )
        }
        throw error
      }

      const updatedClass = await getClassById(classId)
      if (!updatedClass) {
        throw new ActionError(
          'Class not found',
          ERROR_CODES.NOT_FOUND,
          undefined,
          404
        )
      }

      after(() => {
        revalidatePath('/admin/dugsi/classes')
        revalidatePath('/teacher/checkin')
      })
      logger.info({ classId, name }, 'Class updated')

      return {
        id: updatedClass.id,
        name: updatedClass.name,
        shift: updatedClass.shift,
        description: updatedClass.description,
        isActive: updatedClass.isActive,
        teachers: updatedClass.teachers.map((t) => ({
          id: t.id,
          teacherId: t.teacherId,
          teacherName: t.teacher.person.name,
        })),
        studentCount: updatedClass.students.length,
        message: 'Class updated successfully',
      }
    }
  )

const _deleteClassAction = adminActionClient
  .metadata({ actionName: 'deleteClassAction' })
  .schema(DeleteClassSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    const { classId } = parsedInput
    try {
      await deleteClass(classId)
    } catch (error) {
      if (error instanceof ClassNotFoundError) {
        throw new ActionError(
          'Class not found or has been deactivated',
          ERROR_CODES.NOT_FOUND
        )
      }
      throw error
    }
    after(() => {
      revalidatePath('/admin/dugsi/classes')
      revalidatePath('/teacher/checkin')
    })
    logger.info({ classId }, 'Class deleted')
    return { message: 'Class deleted successfully' }
  })

export async function getAvailableDugsiTeachers(
  ...args: Parameters<typeof _getAvailableDugsiTeachers>
) {
  return _getAvailableDugsiTeachers(...args)
}
export async function getUnassignedStudentsAction(
  ...args: Parameters<typeof _getUnassignedStudentsAction>
) {
  return _getUnassignedStudentsAction(...args)
}
export async function getClassesWithDetailsAction(
  ...args: Parameters<typeof _getClassesWithDetailsAction>
) {
  return _getClassesWithDetailsAction(...args)
}
export async function getAllTeachersForClassAssignmentAction(
  ...args: Parameters<typeof _getAllTeachersForClassAssignmentAction>
) {
  return _getAllTeachersForClassAssignmentAction(...args)
}
export async function getAvailableStudentsForClassAction(
  ...args: Parameters<typeof _getAvailableStudentsForClassAction>
) {
  return _getAvailableStudentsForClassAction(...args)
}
export async function getClassDeletePreviewAction(
  ...args: Parameters<typeof _getClassDeletePreviewAction>
) {
  return _getClassDeletePreviewAction(...args)
}
export async function assignTeacherToClassAction(
  ...args: Parameters<typeof _assignTeacherToClassAction>
) {
  return _assignTeacherToClassAction(...args)
}
export async function removeTeacherFromClassAction(
  ...args: Parameters<typeof _removeTeacherFromClassAction>
) {
  return _removeTeacherFromClassAction(...args)
}
export async function enrollStudentInClassAction(
  ...args: Parameters<typeof _enrollStudentInClassAction>
) {
  return _enrollStudentInClassAction(...args)
}
export async function removeStudentFromClassAction(
  ...args: Parameters<typeof _removeStudentFromClassAction>
) {
  return _removeStudentFromClassAction(...args)
}
export async function bulkEnrollStudentsAction(
  ...args: Parameters<typeof _bulkEnrollStudentsAction>
) {
  return _bulkEnrollStudentsAction(...args)
}
export async function createClassAction(
  ...args: Parameters<typeof _createClassAction>
) {
  return _createClassAction(...args)
}
export async function updateClassAction(
  ...args: Parameters<typeof _updateClassAction>
) {
  return _updateClassAction(...args)
}
export async function deleteClassAction(
  ...args: Parameters<typeof _deleteClassAction>
) {
  return _deleteClassAction(...args)
}
