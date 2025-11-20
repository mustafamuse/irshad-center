'use server'

// ⚠️ CRITICAL MIGRATION NEEDED: This file uses the legacy Student model which has been removed.
// TODO: Migrate to ProgramProfile/Enrollment model

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateStudent(id: string, data: any) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  throw new Error('Migration needed: Student model has been removed. Please migrate to ProgramProfile/Enrollment model.')
}
