'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { after } from 'next/server'

import { returnValidationErrors } from 'next-safe-action'

import { ActionError } from '@/lib/errors/action-error'
import { dugsiRegistrationSchema } from '@/lib/registration/schemas/registration'
import { rateLimitedActionClient } from '@/lib/safe-action'
import { createFamilyRegistration } from '@/lib/services/registration-service'
import { findGuardianByEmail } from '@/lib/services/shared/parent-service'

const _registerDugsiChildren = rateLimitedActionClient
  .metadata({ actionName: 'registerDugsiChildren' })
  .schema(dugsiRegistrationSchema)
  .action(async ({ parsedInput: validated }) => {
    const familyReferenceId = crypto.randomUUID()

    try {
      const result = await createFamilyRegistration({
        children: validated.children.map((child) => ({
          firstName: child.firstName,
          lastName: child.lastName,
          dateOfBirth: child.dateOfBirth,
          gender: child.gender,
          gradeLevel: child.gradeLevel,
          shift: child.shift,
          schoolName: child.schoolName || null,
          healthInfo: child.healthInfo || null,
        })),
        parent1Email: validated.parent1Email,
        parent1Phone: validated.parent1Phone,
        parent1FirstName: validated.parent1FirstName,
        parent1LastName: validated.parent1LastName,
        parent2Email: validated.isSingleParent ? null : validated.parent2Email,
        parent2Phone: validated.isSingleParent ? null : validated.parent2Phone,
        parent2FirstName: validated.isSingleParent
          ? null
          : validated.parent2FirstName,
        parent2LastName: validated.isSingleParent
          ? null
          : validated.parent2LastName,
        primaryPayer: validated.isSingleParent
          ? 'parent1'
          : validated.primaryPayer,
        familyReferenceId,
      })

      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })

      return {
        familyId: familyReferenceId,
        children: result.profiles.map((p) => ({ id: p.id, name: p.name })),
        count: result.profiles.length,
      }
    } catch (error) {
      if (error instanceof ActionError && error.field) {
        if (error.field === 'email' || error.field === 'parent1Email') {
          returnValidationErrors(dugsiRegistrationSchema, {
            parent1Email: { _errors: [error.message] },
          })
        } else if (error.field === 'phone' || error.field === 'parent1Phone') {
          returnValidationErrors(dugsiRegistrationSchema, {
            parent1Phone: { _errors: [error.message] },
          })
        }
      }
      throw error
    }
  })

export async function registerDugsiChildren(
  ...args: Parameters<typeof _registerDugsiChildren>
) {
  return _registerDugsiChildren(...args)
}

export async function checkParentEmailExists(email: string): Promise<boolean> {
  try {
    const existing = await findGuardianByEmail(email)
    return existing !== null
  } catch {
    return false
  }
}
