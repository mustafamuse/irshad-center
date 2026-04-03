'use server'

import { Program } from '@prisma/client'

import { getMultiRolePeople } from '@/lib/db/queries/person'
import { adminActionClient } from '@/lib/safe-action'

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

const _getMultiRolePeopleAction = adminActionClient
  .metadata({ actionName: 'getMultiRolePeopleAction' })
  .action(async () => {
    const people = await getMultiRolePeople()

    return people.map(
      (person): MultiRolePerson => ({
        id: person.id,
        name: person.name,
        email: person.email,
        phone: person.phone,
        roleCount: [
          person.teacher ? 1 : 0,
          person.programProfiles.length > 0 ? 1 : 0,
          person.guardianRelationships.length > 0 ? 1 : 0,
        ].reduce((a, b) => a + b, 0),
        roles: {
          teacher: person.teacher
            ? { programs: person.teacher.programs.map((p) => p.program) }
            : null,
          student:
            person.programProfiles.length > 0
              ? { programs: person.programProfiles.map((p) => p.program) }
              : null,
          parent:
            person.guardianRelationships.length > 0
              ? { childCount: person.guardianRelationships.length }
              : null,
        },
      })
    )
  })

export async function getMultiRolePeopleAction(
  ...args: Parameters<typeof _getMultiRolePeopleAction>
) {
  return _getMultiRolePeopleAction(...args)
}
