'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { after } from 'next/server'

import { GradeLevel } from '@prisma/client'
import { z } from 'zod'

import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger, logError, logInfo } from '@/lib/logger'
import {
  adminActionClient,
  rateLimitedAdminActionClient,
} from '@/lib/safe-action'
import {
  getFamilyMembers as getFamilyMembersService,
  getDeleteFamilyPreview as getDeleteFamilyPreviewService,
  deleteDugsiFamily as deleteDugsiFamilyService,
  updateParentInfo as updateParentInfoService,
  addSecondParent as addSecondParentService,
  updateChildInfo as updateChildInfoService,
  addChildToFamily as addChildToFamilyService,
  reEnrollChild as reEnrollChildService,
  setPrimaryPayer as setPrimaryPayerService,
  updateFamilyShift as updateFamilyShiftService,
  syncFamilyBillingRate as syncFamilyBillingRateService,
  type SyncFamilyBillingResult,
} from '@/lib/services/dugsi'
import {
  FamilyBillingControlSchema,
  ReEnrollChildSchema,
  UpdateFamilyShiftSchema,
} from '@/lib/validations/dugsi'

import { DugsiRegistration } from '../_types'

const logger = createServiceLogger('dugsi-admin-actions')

const StudentIdSchema = z.object({ studentId: z.string().min(1) })

const UpdateParentInfoSchema = z.object({
  studentId: z.string().min(1),
  parentNumber: z.union([z.literal(1), z.literal(2)]),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(1),
})

const AddSecondParentSchema = z.object({
  studentId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
})

const SetPrimaryPayerSchema = z.object({
  studentId: z.string().min(1),
  parentNumber: z.union([z.literal(1), z.literal(2)]),
})

const UpdateChildInfoSchema = z.object({
  studentId: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  dateOfBirth: z.date().optional(),
  gradeLevel: z.nativeEnum(GradeLevel).optional(),
  schoolName: z.string().optional(),
  healthInfo: z.string().nullable().optional(),
})

const AddChildToFamilySchema = z.object({
  existingStudentId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: z.enum(['MALE', 'FEMALE']),
  dateOfBirth: z.date().optional(),
  gradeLevel: z.nativeEnum(GradeLevel).optional(),
  schoolName: z.string().optional(),
  healthInfo: z.string().nullable().optional(),
})

const _getFamilyMembers = adminActionClient
  .metadata({ actionName: 'getFamilyMembers' })
  .schema(StudentIdSchema)
  .action(async ({ parsedInput }): Promise<DugsiRegistration[]> => {
    return await getFamilyMembersService(parsedInput.studentId)
  })

const _getDeleteFamilyPreview = adminActionClient
  .metadata({ actionName: 'getDeleteFamilyPreview' })
  .schema(StudentIdSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<{
      count: number
      students: Array<{ id: string; name: string; parentEmail: string | null }>
    }> => {
      return await getDeleteFamilyPreviewService(parsedInput.studentId)
    }
  )

const _deleteDugsiFamily = adminActionClient
  .metadata({ actionName: 'deleteDugsiFamily' })
  .schema(StudentIdSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<{
      studentsDeleted: number
      subscriptionsCanceled: number
      message: string
    }> => {
      const result = await deleteDugsiFamilyService(parsedInput.studentId)
      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })

      await logInfo(logger, 'Dugsi family deleted', {
        studentId: parsedInput.studentId,
        studentsDeleted: result.studentsDeleted,
        subscriptionsCanceled: result.subscriptionsCanceled,
      })

      const parts: string[] = []
      parts.push(
        `${result.studentsDeleted} ${result.studentsDeleted === 1 ? 'student' : 'students'}`
      )
      if (result.subscriptionsCanceled > 0) {
        parts.push(
          `${result.subscriptionsCanceled} ${result.subscriptionsCanceled === 1 ? 'subscription' : 'subscriptions'} canceled`
        )
      }

      return {
        ...result,
        message: `Successfully deleted ${parts.join(', ')}`,
      }
    }
  )

const _updateParentInfo = adminActionClient
  .metadata({ actionName: 'updateParentInfo' })
  .schema(UpdateParentInfoSchema)
  .action(
    async ({ parsedInput }): Promise<{ updated: number; message: string }> => {
      const result = await updateParentInfoService(parsedInput)
      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })
      return {
        ...result,
        message: `Successfully updated parent information for ${result.updated} ${result.updated === 1 ? 'student' : 'students'}`,
      }
    }
  )

const _addSecondParent = adminActionClient
  .metadata({ actionName: 'addSecondParent' })
  .schema(AddSecondParentSchema)
  .action(
    async ({ parsedInput }): Promise<{ updated: number; message: string }> => {
      const result = await addSecondParentService(parsedInput)
      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })
      return {
        ...result,
        message: `Successfully added second parent to ${result.updated} ${result.updated === 1 ? 'student' : 'students'}`,
      }
    }
  )

const _setPrimaryPayer = adminActionClient
  .metadata({ actionName: 'setPrimaryPayer' })
  .schema(SetPrimaryPayerSchema)
  .action(
    async ({ parsedInput }): Promise<{ updated: number; message: string }> => {
      const result = await setPrimaryPayerService(parsedInput)
      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })
      return {
        ...result,
        message: `Parent ${parsedInput.parentNumber} is now the primary payer`,
      }
    }
  )

const _updateChildInfo = adminActionClient
  .metadata({ actionName: 'updateChildInfo' })
  .schema(UpdateChildInfoSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    await updateChildInfoService(parsedInput)
    after(() => {
      revalidatePath('/admin/dugsi')
      revalidateTag('dugsi-registrations')
    })
    return { message: 'Successfully updated child information' }
  })

const _updateFamilyShift = adminActionClient
  .metadata({ actionName: 'updateFamilyShift' })
  .schema(UpdateFamilyShiftSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    await updateFamilyShiftService({
      familyReferenceId: parsedInput.familyReferenceId,
      shift: parsedInput.shift,
    })
    after(() => {
      revalidatePath('/admin/dugsi')
      revalidateTag('dugsi-registrations')
    })
    return { message: 'Successfully updated family shift' }
  })

const _addChildToFamily = rateLimitedAdminActionClient
  .metadata({ actionName: 'addChildToFamily', maxAttempts: 10 })
  .schema(AddChildToFamilySchema)
  .action(
    async ({ parsedInput }): Promise<{ childId: string; message: string }> => {
      const result = await addChildToFamilyService(parsedInput)
      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })
      return { ...result, message: 'Successfully added child to family' }
    }
  )

const _reEnrollChild = rateLimitedAdminActionClient
  .metadata({ actionName: 'reEnrollChild', maxAttempts: 10 })
  .schema(ReEnrollChildSchema)
  .action(async ({ parsedInput }) => {
    try {
      const result = await reEnrollChildService(parsedInput.profileId)
      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })
      return result
    } catch (error) {
      if (error instanceof ActionError) throw error
      await logError(logger, error, 'Failed to re-enroll child', {
        profileId: parsedInput.profileId,
      })
      throw new ActionError(
        'Failed to re-enroll child',
        ERROR_CODES.SERVER_ERROR,
        undefined,
        500
      )
    }
  })

const _recalculateFamilyRate = rateLimitedAdminActionClient
  .metadata({ actionName: 'recalculateFamilyRate', maxAttempts: 30 })
  .schema(FamilyBillingControlSchema)
  .action(async ({ parsedInput }): Promise<SyncFamilyBillingResult> => {
    try {
      const result = await syncFamilyBillingRateService(
        parsedInput.familyReferenceId
      )
      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })
      return result
    } catch (error) {
      if (error instanceof ActionError) throw error
      await logError(logger, error, 'Failed to recalculate family rate', {
        familyReferenceId: parsedInput.familyReferenceId,
      })
      throw new ActionError(
        'Failed to recalculate family rate',
        ERROR_CODES.SERVER_ERROR,
        undefined,
        500
      )
    }
  })

export async function getFamilyMembers(
  ...args: Parameters<typeof _getFamilyMembers>
) {
  return _getFamilyMembers(...args)
}
export async function getDeleteFamilyPreview(
  ...args: Parameters<typeof _getDeleteFamilyPreview>
) {
  return _getDeleteFamilyPreview(...args)
}
export async function deleteDugsiFamily(
  ...args: Parameters<typeof _deleteDugsiFamily>
) {
  return _deleteDugsiFamily(...args)
}
export async function updateParentInfo(
  ...args: Parameters<typeof _updateParentInfo>
) {
  return _updateParentInfo(...args)
}
export async function addSecondParent(
  ...args: Parameters<typeof _addSecondParent>
) {
  return _addSecondParent(...args)
}
export async function setPrimaryPayer(
  ...args: Parameters<typeof _setPrimaryPayer>
) {
  return _setPrimaryPayer(...args)
}
export async function updateChildInfo(
  ...args: Parameters<typeof _updateChildInfo>
) {
  return _updateChildInfo(...args)
}
export async function updateFamilyShift(
  ...args: Parameters<typeof _updateFamilyShift>
) {
  return _updateFamilyShift(...args)
}
export async function addChildToFamily(
  ...args: Parameters<typeof _addChildToFamily>
) {
  return _addChildToFamily(...args)
}
export async function reEnrollChild(
  ...args: Parameters<typeof _reEnrollChild>
) {
  return _reEnrollChild(...args)
}
export async function recalculateFamilyRate(
  ...args: Parameters<typeof _recalculateFamilyRate>
) {
  return _recalculateFamilyRate(...args)
}
