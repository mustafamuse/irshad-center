'use server'

import { revalidatePath } from 'next/cache'

import { GradeLevel } from '@prisma/client'

import { createServiceLogger, logError, logInfo } from '@/lib/logger'
import {
  getAllDugsiRegistrations,
  getFamilyMembers as getFamilyMembersService,
  getDeleteFamilyPreview as getDeleteFamilyPreviewService,
  deleteDugsiFamily as deleteDugsiFamilyService,
  updateParentInfo as updateParentInfoService,
  addSecondParent as addSecondParentService,
  updateChildInfo as updateChildInfoService,
  addChildToFamily as addChildToFamilyService,
  setPrimaryPayer as setPrimaryPayerService,
  updateFamilyShift as updateFamilyShiftService,
} from '@/lib/services/dugsi'
import {
  UpdateFamilyShiftSchema,
  type UpdateFamilyShiftInput,
} from '@/lib/validations/dugsi'

import type { ActionResult, DugsiRegistration } from '../_types'

const logger = createServiceLogger('dugsi-family-actions')

export async function getDugsiRegistrations(filters?: {
  shift?: 'MORNING' | 'AFTERNOON'
}): Promise<DugsiRegistration[]> {
  return await getAllDugsiRegistrations(undefined, filters)
}

export async function getFamilyMembers(
  studentId: string
): Promise<DugsiRegistration[]> {
  return await getFamilyMembersService(studentId)
}

export async function getDeleteFamilyPreview(studentId: string): Promise<
  ActionResult<{
    count: number
    students: Array<{ id: string; name: string; parentEmail: string | null }>
  }>
> {
  try {
    const result = await getDeleteFamilyPreviewService(studentId)
    return {
      success: true,
      data: result,
    }
  } catch (error) {
    await logError(logger, error, 'Failed to get delete preview', {
      studentId,
    })
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to get delete preview',
    }
  }
}

export async function deleteDugsiFamily(
  studentId: string
): Promise<
  ActionResult<{ studentsDeleted: number; subscriptionsCanceled: number }>
> {
  try {
    const result = await deleteDugsiFamilyService(studentId)
    revalidatePath('/admin/dugsi')

    await logInfo(logger, 'Dugsi family deleted', {
      studentId,
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
      success: true,
      data: result,
      message: `Successfully deleted ${parts.join(', ')}`,
    }
  } catch (error) {
    await logError(logger, error, 'Failed to delete family', { studentId })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete family',
    }
  }
}

export async function updateParentInfo(params: {
  studentId: string
  parentNumber: 1 | 2
  firstName: string
  lastName: string
  phone: string
}): Promise<ActionResult<{ updated: number }>> {
  try {
    const result = await updateParentInfoService(params)
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: result,
      message: `Successfully updated parent information for ${result.updated} ${result.updated === 1 ? 'student' : 'students'}`,
    }
  } catch (error) {
    await logError(logger, error, 'Failed to update parent information', {
      studentId: params.studentId,
      parentNumber: params.parentNumber,
    })
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update parent information',
    }
  }
}

export async function addSecondParent(params: {
  studentId: string
  firstName: string
  lastName: string
  email: string
  phone: string
}): Promise<ActionResult<{ updated: number }>> {
  try {
    const result = await addSecondParentService(params)
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: result,
      message: `Successfully added second parent to ${result.updated} ${result.updated === 1 ? 'student' : 'students'}`,
    }
  } catch (error) {
    await logError(logger, error, 'Failed to add second parent', {
      studentId: params.studentId,
    })
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to add second parent',
    }
  }
}

export async function setPrimaryPayer(params: {
  studentId: string
  parentNumber: 1 | 2
}): Promise<ActionResult<{ updated: number }>> {
  try {
    const result = await setPrimaryPayerService(params)
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: result,
      message: `Parent ${params.parentNumber} is now the primary payer`,
    }
  } catch (error) {
    await logError(logger, error, 'Failed to set primary payer', {
      studentId: params.studentId,
      parentNumber: params.parentNumber,
    })
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to set primary payer',
    }
  }
}

export async function updateChildInfo(params: {
  studentId: string
  firstName?: string
  lastName?: string
  gender?: 'MALE' | 'FEMALE'
  dateOfBirth?: Date
  gradeLevel?: GradeLevel
  schoolName?: string
  healthInfo?: string | null
}): Promise<ActionResult> {
  try {
    await updateChildInfoService(params)
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      message: 'Successfully updated child information',
    }
  } catch (error) {
    await logError(logger, error, 'Failed to update child information', {
      studentId: params.studentId,
    })
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update child information',
    }
  }
}

export async function updateFamilyShift(
  params: UpdateFamilyShiftInput
): Promise<ActionResult> {
  try {
    const validated = UpdateFamilyShiftSchema.parse(params)

    await updateFamilyShiftService({
      familyReferenceId: validated.familyReferenceId,
      shift: validated.shift,
    })

    revalidatePath('/admin/dugsi', 'layout')

    return {
      success: true,
      message: 'Successfully updated family shift',
    }
  } catch (error) {
    await logError(logger, error, 'Failed to update family shift', {
      familyReferenceId: params.familyReferenceId,
      attemptedShift: params.shift,
    })
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update family shift',
    }
  }
}

export async function addChildToFamily(params: {
  existingStudentId: string
  firstName: string
  lastName: string
  gender: 'MALE' | 'FEMALE'
  dateOfBirth?: Date
  gradeLevel?: GradeLevel
  schoolName?: string
  healthInfo?: string | null
}): Promise<ActionResult<{ childId: string }>> {
  try {
    const result = await addChildToFamilyService(params)
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: result,
      message: 'Successfully added child to family',
    }
  } catch (error) {
    await logError(logger, error, 'Failed to add child to family', {
      existingStudentId: params.existingStudentId,
    })
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to add child to family',
    }
  }
}
