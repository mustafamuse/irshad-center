/**
 * Dugsi Class Query Functions
 *
 * Query functions for DugsiClass and DugsiClassTeacher models.
 * Supports class management and teacher assignment operations.
 */

import { DugsiClass, Prisma, Shift } from '@prisma/client'

import type { UnassignedStudent } from '@/app/admin/dugsi/_types'
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
import { createServiceLogger, logError } from '@/lib/logger'

const logger = createServiceLogger('dugsi-class-queries')

const siblingPersonSelect = {
  name: true,
  programProfiles: {
    where: { program: DUGSI_PROGRAM },
    select: {
      dugsiClassEnrollment: {
        select: {
          isActive: true,
          class: {
            select: {
              shift: true,
              teachers: {
                where: { isActive: true },
                select: {
                  teacher: {
                    select: { person: { select: { name: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const

export async function getUnassignedDugsiStudents(
  client: DatabaseClient = prisma
): Promise<UnassignedStudent[]> {
  const profiles = await client.programProfile.findMany({
    where: {
      program: DUGSI_PROGRAM,
      status: { in: ['ENROLLED', 'REGISTERED'] },
      OR: [
        { dugsiClassEnrollment: null },
        { dugsiClassEnrollment: { isActive: false } },
      ],
    },
    include: {
      person: {
        select: {
          id: true,
          name: true,
          dateOfBirth: true,
          siblingRelationships1: {
            where: { isActive: true },
            select: { person2: { select: siblingPersonSelect } },
          },
          siblingRelationships2: {
            where: { isActive: true },
            select: { person1: { select: siblingPersonSelect } },
          },
        },
      },
    },
    orderBy: { person: { name: 'asc' } },
  })

  const now = new Date()

  return profiles.map((p) => {
    const dob = p.person.dateOfBirth
    let age: number | null = null
    if (dob) {
      age = now.getFullYear() - dob.getFullYear()
      const monthDiff = now.getMonth() - dob.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
        age--
      }
    }

    type SiblingPerson =
      (typeof p.person.siblingRelationships1)[number]['person2']
    type SiblingEntry = { name: string; teacherName: string; classShift: Shift }
    const siblings: SiblingEntry[] = []

    const extractFromPerson = (person: SiblingPerson) => {
      for (const profile of person.programProfiles) {
        const enrollment = profile.dugsiClassEnrollment
        if (!enrollment?.isActive) continue
        const teacherName =
          enrollment.class.teachers[0]?.teacher.person.name ?? 'No teacher'
        siblings.push({
          name: person.name,
          teacherName,
          classShift: enrollment.class.shift,
        })
      }
    }

    for (const rel of p.person.siblingRelationships1) {
      extractFromPerson(rel.person2)
    }
    for (const rel of p.person.siblingRelationships2) {
      extractFromPerson(rel.person1)
    }

    return {
      profileId: p.id,
      name: p.person.name,
      dateOfBirth: p.person.dateOfBirth,
      age,
      shift: p.shift,
      siblings,
    }
  })
}

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
    relationLoadStrategy: 'join',
    include: dugsiClassInclude,
    orderBy: [{ shift: 'asc' }, { name: 'asc' }],
  })
}

export async function getAllTeachersForAssignment(
  client: DatabaseClient = prisma
): Promise<Array<{ id: string; name: string }>> {
  const teachers = await client.teacher.findMany({
    relationLoadStrategy: 'join',
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
    relationLoadStrategy: 'join',
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
    const existingEnrollments = await tx.dugsiClassEnrollment.findMany({
      where: { programProfileId: { in: uniqueIds } },
      select: { programProfileId: true, classId: true, isActive: true },
    })

    const existingMap = new Map(
      existingEnrollments.map((e) => [e.programProfileId, e])
    )

    let enrolled = 0
    let moved = 0

    for (const programProfileId of uniqueIds) {
      const existing = existingMap.get(programProfileId)

      if (existing?.classId === classId && existing.isActive) {
        continue
      }

      const wasMoving = existing?.isActive && existing.classId !== classId

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
    await logError(logger, error, 'Bulk enrollment failed', {
      classId,
      programProfileIds: uniqueIds,
    })
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
    relationLoadStrategy: 'join',
    include: dugsiClassInclude,
  })
}

export async function getClassPreviewForDelete(
  classId: string,
  client: DatabaseClient = prisma
): Promise<{ teacherCount: number; studentCount: number } | null> {
  const dugsiClass = await client.dugsiClass.findUnique({
    where: { id: classId, isActive: true },
    relationLoadStrategy: 'join',
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
