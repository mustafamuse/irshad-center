'use server'

import { Program } from '@prisma/client'

import { getMultiRolePeople } from '@/lib/db/queries/person'
import { createServiceLogger, logError } from '@/lib/logger'
import { ActionResult } from '@/lib/utils/action-helpers'

const logger = createServiceLogger('people-actions')

export interface MultiRolePerson {
  id: string
  name: string
  email: string | null
  phone: string | null
  roleCount: number
  roles: {
    teacher: {
      programs: Program[]
    } | null
    student: {
      programs: Program[]
    } | null
    parent: {
      childCount: number
    } | null
  }
}

export async function getMultiRolePeopleAction(filters?: {
  minRoles?: number
  hasTeacher?: boolean
  hasStudent?: boolean
  hasParent?: boolean
  program?: Program
}): Promise<ActionResult<MultiRolePerson[]>> {
  try {
    const people = await getMultiRolePeople(filters)

    const results: MultiRolePerson[] = people.map((person) => ({
      id: person.id,
      name: person.name,
      email:
        person.contactPoints.find((cp) => cp.type === 'EMAIL')?.value ?? null,
      phone:
        person.contactPoints.find((cp) => cp.type === 'PHONE')?.value ?? null,
      roleCount: [
        person.teacher ? 1 : 0,
        person.programProfiles.length > 0 ? 1 : 0,
        person.guardianRelationships.length > 0 ? 1 : 0,
      ].reduce((a, b) => a + b, 0),
      roles: {
        teacher: person.teacher
          ? {
              programs: person.teacher.programs.map((p) => p.program),
            }
          : null,
        student:
          person.programProfiles.length > 0
            ? {
                programs: person.programProfiles.map((p) => p.program),
              }
            : null,
        parent:
          person.guardianRelationships.length > 0
            ? {
                childCount: person.guardianRelationships.length,
              }
            : null,
      },
    }))

    return { success: true, data: results }
  } catch (error) {
    await logError(logger, error, 'Failed to load multi-role people', filters)
    return { success: false, error: 'Failed to load multi-role people' }
  }
}
