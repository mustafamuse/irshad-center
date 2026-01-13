/**
 * Dugsi Class Query Functions
 *
 * Query functions for DugsiClass and DugsiClassTeacher models.
 * Supports class management and teacher assignment operations.
 */

import { DugsiClass, Prisma, Shift } from '@prisma/client'

import {
  BULK_ENROLLMENT_TIMEOUT_MS,
  DUGSI_PROGRAM,
} from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'
import {
  ClassNotFoundError,
  TeacherNotAuthorizedError,
} from '@/lib/errors/dugsi-class-errors'
import { createServiceLogger } from '@/lib/logger'

const logger = createServiceLogger('dugsi-class-queries')

export const dugsiClassInclude = {
  teachers: {
    where: { isActive: true },
    include: {
      teacher: {
        include: {
          person: {
            select: { name: true },
          },
        },
      },
    },
  },
  students: {
    where: { isActive: true },
  },
} as const satisfies Prisma.DugsiClassInclude

export type DugsiClassWithRelations = Prisma.DugsiClassGetPayload<{
  include: typeof dugsiClassInclude
}>

export async function getClassesWithDetails(
  client: DatabaseClient = prisma
): Promise<DugsiClassWithRelations[]> {
  return client.dugsiClass.findMany({
    where: { isActive: true },
    include: dugsiClassInclude,
    orderBy: [{ shift: 'asc' }, { name: 'asc' }],
  })
}

export async function getAllTeachersForAssignment(
  client: DatabaseClient = prisma
): Promise<Array<{ id: string; name: string }>> {
  const teachers = await client.teacher.findMany({
    include: {
      person: {
        select: { name: true },
      },
    },
    orderBy: {
      person: { name: 'asc' },
    },
  })

  return teachers.map((t) => ({
    id: t.id,
    name: t.person.name,
  }))
}

export interface StudentForEnrollmentResult {
  id: string
  programProfileId: string
  name: string
  shift: Shift | null
  isEnrolledInClass: boolean
  currentClassName: string | null
}

export async function getAvailableStudentsForClass(
  shift: Shift,
  client: DatabaseClient = prisma
): Promise<StudentForEnrollmentResult[]> {
  const students = await client.programProfile.findMany({
    where: {
      program: DUGSI_PROGRAM,
      status: { in: ['ENROLLED', 'REGISTERED'] },
      shift,
    },
    include: {
      person: {
        select: { name: true },
      },
      dugsiClassEnrollment: {
        where: { isActive: true, class: { isActive: true } },
        include: {
          class: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: {
      person: { name: 'asc' },
    },
  })

  return students.map((s) => ({
    id: s.id,
    programProfileId: s.id,
    name: s.person.name,
    shift: s.shift,
    isEnrolledInClass: !!s.dugsiClassEnrollment,
    currentClassName: s.dugsiClassEnrollment?.class?.name ?? null,
  }))
}

export async function assignTeacherToClass(
  classId: string,
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<void> {
  const dugsiClass = await client.dugsiClass.findUnique({
    where: { id: classId },
    select: { isActive: true },
  })
  if (!dugsiClass || !dugsiClass.isActive) {
    throw new ClassNotFoundError()
  }

  const authorized = await client.teacherProgram.findFirst({
    where: { teacherId, program: DUGSI_PROGRAM, isActive: true },
  })
  if (!authorized) {
    throw new TeacherNotAuthorizedError()
  }

  await client.dugsiClassTeacher.create({
    data: {
      classId,
      teacherId,
      isActive: true,
    },
  })
}

export async function removeTeacherFromClass(
  classId: string,
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<void> {
  await client.dugsiClassTeacher.update({
    where: {
      classId_teacherId: {
        classId,
        teacherId,
      },
    },
    data: { isActive: false },
  })
}

export async function enrollStudentInClass(
  classId: string,
  programProfileId: string,
  client: DatabaseClient = prisma
): Promise<void> {
  await client.dugsiClassEnrollment.create({
    data: {
      classId,
      programProfileId,
      isActive: true,
    },
  })
}

/**
 * Remove a student from their enrolled class.
 *
 * Note: Students can only be enrolled in ONE class at a time
 * (enforced by unique constraint on programProfileId).
 * This function removes the student from whatever class they're in.
 */
export async function removeStudentFromClass(
  programProfileId: string,
  client: DatabaseClient = prisma
): Promise<void> {
  await client.dugsiClassEnrollment.update({
    where: { programProfileId },
    data: { isActive: false, endDate: new Date() },
  })
}

export async function bulkEnrollStudents(
  classId: string,
  programProfileIds: string[],
  client: DatabaseClient = prisma
): Promise<{ enrolled: number; moved: number }> {
  const uniqueIds = Array.from(new Set(programProfileIds))

  logger.info(
    { classId, totalStudents: uniqueIds.length, programProfileIds: uniqueIds },
    'Starting bulk enrollment'
  )

  const enrollStudents = async (
    tx: DatabaseClient
  ): Promise<{ enrolled: number; moved: number }> => {
    let enrolled = 0
    let moved = 0

    for (let i = 0; i < uniqueIds.length; i++) {
      const programProfileId = uniqueIds[i]
      logger.debug(
        { programProfileId, index: i + 1, total: uniqueIds.length },
        'Processing student'
      )

      const existing = await tx.dugsiClassEnrollment.findUnique({
        where: { programProfileId },
        select: { classId: true, isActive: true },
      })

      if (existing?.classId === classId && existing.isActive) {
        logger.debug(
          { programProfileId },
          'Skipping - already enrolled in this class'
        )
        continue
      }

      const wasMoving = existing?.isActive && existing.classId !== classId

      logger.debug(
        { programProfileId, wasMoving, action: 'upsert' },
        'Upserting enrollment'
      )

      await tx.dugsiClassEnrollment.upsert({
        where: { programProfileId },
        create: { classId, programProfileId, isActive: true },
        update: {
          classId,
          isActive: true,
          ...(existing?.classId !== classId && { startDate: new Date() }),
          endDate: null,
        },
      })

      if (wasMoving) moved++
      enrolled++
    }

    logger.info({ classId, enrolled, moved }, 'Bulk enrollment completed')
    return { enrolled, moved }
  }

  try {
    if (client !== prisma) {
      return await enrollStudents(client)
    }

    return await prisma.$transaction(enrollStudents, {
      timeout: BULK_ENROLLMENT_TIMEOUT_MS,
    })
  } catch (error) {
    logger.error(
      {
        classId,
        programProfileIds: uniqueIds,
        error:
          error instanceof Error
            ? { message: error.message, name: error.name, stack: error.stack }
            : error,
      },
      'Bulk enrollment failed'
    )
    throw error
  }
}

export async function createClass(
  name: string,
  shift: Shift,
  description?: string,
  client: DatabaseClient = prisma
): Promise<DugsiClass> {
  return client.dugsiClass.create({
    data: {
      name,
      shift,
      description: description ?? null,
      isActive: true,
    },
  })
}

export async function updateClass(
  classId: string,
  data: { name: string; description?: string },
  client: DatabaseClient = prisma
): Promise<DugsiClass> {
  const dugsiClass = await client.dugsiClass.findUnique({
    where: { id: classId },
    select: { isActive: true },
  })
  if (!dugsiClass || !dugsiClass.isActive) {
    throw new ClassNotFoundError()
  }

  return client.dugsiClass.update({
    where: { id: classId },
    data: {
      name: data.name,
      description: data.description ?? null,
    },
  })
}

export async function deleteClass(
  classId: string,
  client: DatabaseClient = prisma
): Promise<void> {
  const dugsiClass = await client.dugsiClass.findUnique({
    where: { id: classId },
    select: { isActive: true },
  })
  if (!dugsiClass || !dugsiClass.isActive) {
    throw new ClassNotFoundError()
  }

  await client.dugsiClass.update({
    where: { id: classId },
    data: { isActive: false },
  })
}

export async function getClassById(
  classId: string,
  client: DatabaseClient = prisma
): Promise<DugsiClassWithRelations | null> {
  return client.dugsiClass.findUnique({
    where: { id: classId, isActive: true },
    include: dugsiClassInclude,
  })
}

export async function getClassPreviewForDelete(
  classId: string,
  client: DatabaseClient = prisma
): Promise<{ teacherCount: number; studentCount: number } | null> {
  const dugsiClass = await client.dugsiClass.findUnique({
    where: { id: classId, isActive: true },
    include: {
      teachers: {
        where: { isActive: true },
        select: { id: true },
      },
      students: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  })

  if (!dugsiClass) return null

  return {
    teacherCount: dugsiClass.teachers.length,
    studentCount: dugsiClass.students.length,
  }
}
