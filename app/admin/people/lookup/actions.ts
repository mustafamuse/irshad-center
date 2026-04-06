'use server'

import { revalidatePath, revalidateTag } from 'next/cache'

import { Program } from '@prisma/client'
import { z } from 'zod'

import { countActiveClassesForTeacher } from '@/lib/db/queries/dugsi-class'
import { getPersonWithAllRelations } from '@/lib/db/queries/person'
import { createServiceLogger, logInfo } from '@/lib/logger'
import { adminActionClient } from '@/lib/safe-action'
import { deletePerson } from '@/lib/services/shared/person-service'

const logger = createServiceLogger('person-lookup')

export interface PersonLookupResult {
  id: string
  name: string
  email: string | null
  phone: string | null
  roles: {
    teacher?: {
      id: string
      programs: Program[]
      studentCount: number
    }
    student?: {
      profiles: Array<{
        id: string
        program: Program
        status: string
        levelGroup?: string | null
        shift?: string | null
        teacherName?: string | null
      }>
    }
    parent?: {
      children: Array<{
        id: string
        name: string
        programs: Array<{
          program: Program
          status: string
        }>
      }>
    }
  }
  billingAccounts: Array<{
    id: string
    stripeCustomerId: string | null
    subscriptions: Array<{
      id: string
      status: string
      amount: number
      program: Program
    }>
  }>
  createdAt: Date
  updatedAt: Date
}

export const deletePersonAction = adminActionClient
  .metadata({ actionName: 'deletePersonAction' })
  .inputSchema(z.object({ personId: z.string().uuid('Invalid person ID') }))
  .action(async ({ parsedInput: { personId } }) => {
    await deletePerson(personId)

    revalidatePath('/admin/people/lookup')
    revalidatePath('/admin/people')
    revalidatePath('/admin/teachers')
    revalidatePath('/admin/dugsi')
    revalidateTag('mahad-stats')
    revalidatePath('/admin/mahad')
  })

export const lookupPersonAction = adminActionClient
  .metadata({ actionName: 'lookupPersonAction' })
  .inputSchema(z.object({ query: z.string().min(1) }))
  .action(async ({ parsedInput: { query } }) => {
    if (query.trim().length < 2) {
      return null
    }

    const person = await getPersonWithAllRelations(query)

    if (!person) return null

    const result: PersonLookupResult = {
      id: person.id,
      name: person.name,
      email: person.email,
      phone: person.phone,
      roles: {},
      billingAccounts: person.billingAccounts.map((ba) => ({
        id: ba.id,
        stripeCustomerId: ba.stripeCustomerIdMahad || ba.stripeCustomerIdDugsi,
        subscriptions: ba.subscriptions.map((sub) => ({
          id: sub.id,
          status: sub.status,
          amount: sub.amount,
          program:
            sub.stripeAccountType === 'DUGSI'
              ? ('DUGSI_PROGRAM' as Program)
              : ('MAHAD_PROGRAM' as Program),
        })),
      })),
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
    }

    if (person.teacher) {
      const classCount = await countActiveClassesForTeacher(person.teacher.id)
      result.roles.teacher = {
        id: person.teacher.id,
        programs: person.teacher.programs.map((p) => p.program),
        studentCount: classCount,
      }
    }

    if (person.programProfiles.length > 0) {
      result.roles.student = {
        profiles: person.programProfiles.map((profile) => ({
          id: profile.id,
          program: profile.program,
          status: profile.enrollments[0]?.status || 'REGISTERED',
          levelGroup: profile.gradeLevel ?? null,
          shift: profile.shift ?? null,
          teacherName:
            profile.dugsiClassEnrollment?.class?.teachers?.[0]?.teacher.person
              .name,
        })),
      }
    }

    if (person.guardianRelationships.length > 0) {
      result.roles.parent = {
        children: person.guardianRelationships.map((rel) => ({
          id: rel.dependent.id,
          name: rel.dependent.name,
          programs: rel.dependent.programProfiles.map((profile) => ({
            program: profile.program,
            status: profile.enrollments[0]?.status || 'REGISTERED',
          })),
        })),
      }
    }

    await logInfo(logger, 'Person lookup successful', {
      personId: person.id,
      query,
    })

    return result
  })
