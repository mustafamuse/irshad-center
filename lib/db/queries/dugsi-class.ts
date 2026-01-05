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
  await client.dugsiClassTeacher.delete({
    where: {
      classId_teacherId: {
        classId,
        teacherId,
      },
    },
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

export async function removeStudentFromClass(
  programProfileId: string,
  client: DatabaseClient = prisma
): Promise<void> {
  await client.dugsiClassEnrollment.delete({
    where: {
      programProfileId,
    },
  })
}

export async function bulkEnrollStudents(
  classId: string,
  programProfileIds: string[]
): Promise<{ enrolled: number; skipped: number }> {
  let enrolled = 0
  let skipped = 0

  await prisma.$transaction(async (tx) => {
    for (const programProfileId of programProfileIds) {
      const existing = await tx.dugsiClassEnrollment.findUnique({
        where: { programProfileId },
      })

      if (existing) {
        skipped++
      } else {
        await tx.dugsiClassEnrollment.create({
          data: {
            classId,
            programProfileId,
            isActive: true,
          },
        })
        enrolled++
      }
    }
  })

  return { enrolled, skipped }
}
