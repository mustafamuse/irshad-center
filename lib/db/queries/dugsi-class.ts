import { Shift } from '@prisma/client'

import { prisma } from '@/lib/db'
import type { DatabaseClient } from '@/lib/db/types'
import type {
  DugsiClassDTO,
  ClassStudentDTO,
} from '@/lib/types/dugsi-attendance'

export interface GetClassesOptions {
  activeOnly?: boolean
  shift?: Shift
}

export async function getAllDugsiClasses(
  options: GetClassesOptions = {},
  client: DatabaseClient = prisma
): Promise<DugsiClassDTO[]> {
  const { activeOnly = true, shift } = options

  const classes = await client.dugsiClass.findMany({
    where: {
      ...(activeOnly && { isActive: true }),
      ...(shift && { shift }),
    },
    include: {
      _count: { select: { students: true } },
    },
    orderBy: { name: 'asc' },
  })

  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    shift: c.shift,
    description: c.description,
    isActive: c.isActive,
    studentCount: c._count.students,
    createdAt: c.createdAt,
  }))
}

export async function getDugsiClassById(
  id: string,
  client: DatabaseClient = prisma
): Promise<DugsiClassDTO | null> {
  const result = await client.dugsiClass.findUnique({
    where: { id },
    include: {
      _count: { select: { students: { where: { isActive: true } } } },
    },
  })

  if (!result) return null

  return {
    id: result.id,
    name: result.name,
    shift: result.shift,
    description: result.description,
    isActive: result.isActive,
    studentCount: result._count.students,
    createdAt: result.createdAt,
  }
}

export async function getDugsiClassesByShift(
  shift: Shift,
  client: DatabaseClient = prisma
): Promise<DugsiClassDTO[]> {
  return getAllDugsiClasses({ shift, activeOnly: true }, client)
}

export async function getStudentsInClass(
  classId: string,
  client: DatabaseClient = prisma
): Promise<ClassStudentDTO[]> {
  const enrollments = await client.dugsiClassEnrollment.findMany({
    where: { classId, isActive: true },
    include: {
      programProfile: {
        include: {
          person: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { programProfile: { person: { name: 'asc' } } },
  })

  return enrollments.map((e) => ({
    enrollmentId: e.id,
    programProfileId: e.programProfileId,
    studentName: e.programProfile.person.name,
    startDate: e.startDate,
    isActive: e.isActive,
  }))
}

export async function getClassByStudentProfile(
  programProfileId: string,
  client: DatabaseClient = prisma
) {
  const enrollments = await client.dugsiClassEnrollment.findMany({
    where: { programProfileId, isActive: true },
    include: { class: true },
    take: 1,
  })

  return enrollments[0] ?? null
}
