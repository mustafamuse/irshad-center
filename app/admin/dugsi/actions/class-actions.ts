'use server'

import { revalidatePath } from 'next/cache'

import { Shift } from '@prisma/client'

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
import {
  ClassNotFoundError,
  TeacherNotAuthorizedError,
} from '@/lib/errors/dugsi-class-errors'
import { createServiceLogger, logError } from '@/lib/logger'
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

import type {
  ActionResult,
  ClassWithDetails,
  StudentForEnrollment,
  UnassignedStudent,
} from '../_types'

const logger = createServiceLogger('dugsi-class-actions')

export async function getAvailableDugsiTeachers(): Promise<
  ActionResult<
    Array<{
      id: string
      name: string
      email: string | null
      phone: string | null
    }>
  >
> {
  try {
    const teachers = await getTeachersByProgramService(DUGSI_PROGRAM)

    const teacherList = teachers.map((t) => ({
      id: t.id,
      name: t.person.name,
      email:
        t.person.contactPoints?.find((cp) => cp.type === 'EMAIL')?.value ??
        null,
      phone:
        t.person.contactPoints?.find(
          (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
        )?.value ?? null,
    }))

    return { success: true, data: teacherList }
  } catch (error) {
    await logError(logger, error, 'Failed to get available Dugsi teachers')
    return {
      success: false,
      error: 'Failed to load available teachers',
    }
  }
}

export async function getUnassignedStudentsAction(): Promise<
  ActionResult<UnassignedStudent[]>
> {
  try {
    const students = await getUnassignedDugsiStudents()
    return { success: true, data: students }
  } catch (error) {
    await logError(logger, error, 'Failed to get unassigned students')
    return {
      success: false,
      error: 'Unable to load unassigned students. Please refresh the page.',
    }
  }
}

export async function assignTeacherToClassAction(
  rawInput: unknown
): Promise<ActionResult<void>> {
  const parsed = AssignTeacherToClassSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Invalid input',
    }
  }
  const { classId, teacherId } = parsed.data

  try {
    await assignTeacherToClass(classId, teacherId)

    revalidatePath('/admin/dugsi/classes')
    revalidatePath('/teacher/checkin')

    logger.info({ classId, teacherId }, 'Teacher assigned to class')

    return {
      success: true,
      data: undefined,
      message: 'Teacher assigned to class',
    }
  } catch (error) {
    if (error instanceof ClassNotFoundError) {
      return {
        success: false,
        error: 'Class not found or has been deactivated',
      }
    }

    if (error instanceof TeacherNotAuthorizedError) {
      return {
        success: false,
        error: 'Teacher must be enrolled in Dugsi program before assignment',
      }
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return {
        success: false,
        error: 'This teacher is already assigned to this class',
      }
    }

    await logError(logger, error, 'Failed to assign teacher to class', {
      classId,
      teacherId,
    })
    return {
      success: false,
      error: 'Unable to assign teacher. Please try again.',
    }
  }
}

export async function removeTeacherFromClassAction(
  rawInput: unknown
): Promise<ActionResult<void>> {
  const parsed = RemoveTeacherFromClassSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Invalid input',
    }
  }
  const { classId, teacherId } = parsed.data

  try {
    await removeTeacherFromClass(classId, teacherId)

    revalidatePath('/admin/dugsi/classes')
    revalidatePath('/teacher/checkin')

    logger.info({ classId, teacherId }, 'Teacher removed from class')

    return {
      success: true,
      data: undefined,
      message: 'Teacher removed from class',
    }
  } catch (error) {
    await logError(logger, error, 'Failed to remove teacher from class', {
      classId,
      teacherId,
    })
    return {
      success: false,
      error: 'Unable to remove teacher. Please try again.',
    }
  }
}

export async function getClassesWithDetailsAction(): Promise<
  ActionResult<ClassWithDetails[]>
> {
  try {
    const classes = await getClassesWithDetails()

    const result: ClassWithDetails[] = classes.map((c) => ({
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

    return { success: true, data: result }
  } catch (error) {
    await logError(logger, error, 'Failed to get classes with details')
    return {
      success: false,
      error: 'Unable to load classes. Please refresh the page.',
    }
  }
}

export async function getAllTeachersForClassAssignmentAction(): Promise<
  ActionResult<Array<{ id: string; name: string }>>
> {
  try {
    const teachers = await getAllTeachersForAssignment()
    return { success: true, data: teachers }
  } catch (error) {
    await logError(logger, error, 'Failed to get teachers for class assignment')
    return {
      success: false,
      error: 'Unable to load teachers. Please refresh the page.',
    }
  }
}

export async function getAvailableStudentsForClassAction(input: {
  shift: Shift
}): Promise<ActionResult<StudentForEnrollment[]>> {
  try {
    const students = await getAvailableStudentsForClass(input.shift)
    return { success: true, data: students }
  } catch (error) {
    await logError(logger, error, 'Failed to get available students for class')
    return {
      success: false,
      error: 'Unable to load students. Please refresh the page.',
    }
  }
}

export async function enrollStudentInClassAction(
  rawInput: unknown
): Promise<ActionResult<void>> {
  const parsed = EnrollStudentInClassSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Invalid input',
    }
  }
  const { classId, programProfileId } = parsed.data

  try {
    await enrollStudentInClass(classId, programProfileId)

    revalidatePath('/admin/dugsi/classes')

    logger.info({ classId, programProfileId }, 'Student enrolled in class')

    return {
      success: true,
      data: undefined,
      message: 'Student enrolled in class',
    }
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return {
        success: false,
        error: 'This student is already enrolled in a class',
      }
    }

    await logError(logger, error, 'Failed to enroll student in class', {
      classId,
      programProfileId,
    })
    return {
      success: false,
      error: 'Unable to enroll student. Please try again.',
    }
  }
}

export async function removeStudentFromClassAction(
  rawInput: unknown
): Promise<ActionResult<void>> {
  const parsed = RemoveStudentFromClassSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Invalid input',
    }
  }
  const { programProfileId } = parsed.data

  try {
    await removeStudentFromClass(programProfileId)

    revalidatePath('/admin/dugsi/classes')

    logger.info({ programProfileId }, 'Student removed from class')

    return {
      success: true,
      data: undefined,
      message: 'Student removed from class',
    }
  } catch (error) {
    await logError(logger, error, 'Failed to remove student from class', {
      programProfileId,
    })
    return {
      success: false,
      error: 'Unable to remove student. Please try again.',
    }
  }
}

export async function bulkEnrollStudentsAction(
  rawInput: unknown
): Promise<ActionResult<{ enrolled: number; moved: number }>> {
  const parsed = BulkEnrollStudentsSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Invalid input',
    }
  }
  const { classId, programProfileIds } = parsed.data

  try {
    const result = await bulkEnrollStudents(classId, programProfileIds)

    revalidatePath('/admin/dugsi/classes')

    logger.info(
      { classId, enrolled: result.enrolled, moved: result.moved },
      'Bulk enrollment completed'
    )

    return {
      success: true,
      data: result,
      message: `Enrolled ${result.enrolled} students${result.moved > 0 ? ` (${result.moved} moved from other classes)` : ''}`,
    }
  } catch (error) {
    await logError(logger, error, 'Failed to bulk enroll students', { classId })
    return {
      success: false,
      error: 'Unable to enroll students. Please try again.',
    }
  }
}

export async function createClassAction(
  rawInput: unknown
): Promise<ActionResult<ClassWithDetails>> {
  const parsed = CreateClassSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Invalid input',
    }
  }
  const { name, shift, description } = parsed.data

  try {
    const newClass = await createClass(name, shift as Shift, description)

    revalidatePath('/admin/dugsi/classes')
    revalidatePath('/teacher/checkin')

    logger.info({ classId: newClass.id, name, shift }, 'Class created')

    return {
      success: true,
      data: {
        id: newClass.id,
        name: newClass.name,
        shift: newClass.shift,
        description: newClass.description,
        isActive: newClass.isActive,
        teachers: [],
        studentCount: 0,
      },
      message: 'Class created successfully',
    }
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return {
        success: false,
        error: 'A class with this name already exists for this shift',
      }
    }

    await logError(logger, error, 'Failed to create class', { name, shift })
    return {
      success: false,
      error: 'Unable to create class. Please try again.',
    }
  }
}

export async function updateClassAction(
  rawInput: unknown
): Promise<ActionResult<ClassWithDetails>> {
  const parsed = UpdateClassSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Invalid input',
    }
  }
  const { classId, name, description } = parsed.data

  try {
    await updateClass(classId, { name, description })

    const updatedClass = await getClassById(classId)
    if (!updatedClass) {
      return { success: false, error: 'Class not found' }
    }

    revalidatePath('/admin/dugsi/classes')
    revalidatePath('/teacher/checkin')

    logger.info({ classId, name }, 'Class updated')

    return {
      success: true,
      data: {
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
      },
      message: 'Class updated successfully',
    }
  } catch (error) {
    if (error instanceof ClassNotFoundError) {
      return {
        success: false,
        error: 'Class not found or has been deactivated',
      }
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return {
        success: false,
        error: 'A class with this name already exists',
      }
    }

    await logError(logger, error, 'Failed to update class', { classId, name })
    return {
      success: false,
      error: 'Unable to update class. Please try again.',
    }
  }
}

export async function deleteClassAction(
  rawInput: unknown
): Promise<ActionResult<void>> {
  const parsed = DeleteClassSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Invalid input',
    }
  }
  const { classId } = parsed.data

  try {
    await deleteClass(classId)

    revalidatePath('/admin/dugsi/classes')
    revalidatePath('/teacher/checkin')

    logger.info({ classId }, 'Class deleted')

    return {
      success: true,
      data: undefined,
      message: 'Class deleted successfully',
    }
  } catch (error) {
    if (error instanceof ClassNotFoundError) {
      return {
        success: false,
        error: 'Class not found or has been deactivated',
      }
    }

    await logError(logger, error, 'Failed to delete class', { classId })
    return {
      success: false,
      error: 'Unable to delete class. Please try again.',
    }
  }
}

export async function getClassDeletePreviewAction(input: {
  classId: string
}): Promise<ActionResult<{ teacherCount: number; studentCount: number }>> {
  try {
    const preview = await getClassPreviewForDelete(input.classId)

    if (!preview) {
      return {
        success: false,
        error: 'Class not found',
      }
    }

    return { success: true, data: preview }
  } catch (error) {
    await logError(logger, error, 'Failed to get class delete preview', {
      classId: input.classId,
    })
    return {
      success: false,
      error: 'Unable to load class details. Please try again.',
    }
  }
}
