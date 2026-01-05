/**
 * Dugsi Class Query Functions
 *
 * Query functions for DugsiClass and DugsiClassTeacher models.
 * Supports class management and teacher assignment operations.
 */

import { Prisma, Shift } from '@prisma/client'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'
import {
  ClassNotFoundError,
  TeacherNotAuthorizedError,
} from '@/lib/errors/dugsi-class-errors'

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
      status: 'ENROLLED',
      shift,
    },
    include: {
      person: {
        select: { name: true },
      },
      dugsiClassEnrollment: {
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
  programProfileIds: string[]
): Promise<{ enrolled: number; skipped: number }> {
  const result = await prisma.dugsiClassEnrollment.createMany({
    data: programProfileIds.map((id) => ({
      classId,
      programProfileId: id,
      isActive: true,
    })),
    skipDuplicates: true,
  })

  return {
    enrolled: result.count,
    skipped: programProfileIds.length - result.count,
  }
}
