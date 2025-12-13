'use server'

import { revalidatePath } from 'next/cache'

import { Shift } from '@prisma/client'

import { getTodaysCheckInsForTeacher } from '@/lib/db/queries/dugsi-teacher-checkin'
import { createActionLogger } from '@/lib/logger'
import {
  clockIn,
  clockOut,
  getCheckInWindowStatus,
  getTeacherShifts,
  type CheckInWindowStatus,
} from '@/lib/services/dugsi/teacher-checkin-service'
import type { TeacherCheckInDTO } from '@/lib/types/dugsi-attendance'
import { ActionResult, handleActionError } from '@/lib/utils/action-helpers'
import { PRISMA_ERRORS } from '@/lib/utils/type-guards'
import {
  ClockInSchema,
  ClockOutSchema,
} from '@/lib/validations/dugsi-attendance'

const logger = createActionLogger('teacher-checkin')

export async function clockInAction(data: {
  teacherId: string
  shift: Shift
  lat: number
  lng: number
}): Promise<
  ActionResult<{
    checkInId: string
    clockInValid: boolean
    isLate: boolean
    clockInTime: Date
  }>
> {
  try {
    const validated = ClockInSchema.parse(data)
    const result = await clockIn(validated)

    revalidatePath('/checkin')
    revalidatePath('/admin/dugsi/teacher-checkin')

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    return handleActionError(error, 'clockInAction', logger, {
      handlers: {
        [PRISMA_ERRORS.UNIQUE_CONSTRAINT]:
          'Already clocked in for this shift today',
        [PRISMA_ERRORS.FOREIGN_KEY_CONSTRAINT]: 'Invalid teacher reference',
      },
    })
  }
}

export async function clockOutAction(data: {
  checkInId: string
  lat?: number
  lng?: number
}): Promise<ActionResult<{ checkInId: string; clockOutTime: Date | null }>> {
  try {
    const validated = ClockOutSchema.parse(data)
    const result = await clockOut(validated)

    revalidatePath('/checkin')
    revalidatePath('/admin/dugsi/teacher-checkin')

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    return handleActionError(error, 'clockOutAction', logger, {
      handlers: {
        [PRISMA_ERRORS.RECORD_NOT_FOUND]: 'Check-in record not found',
      },
    })
  }
}

export async function getTodaysCheckInsAction(
  teacherId: string
): Promise<ActionResult<TeacherCheckInDTO[]>> {
  try {
    const checkIns = await getTodaysCheckInsForTeacher(teacherId)
    return { success: true, data: checkIns }
  } catch (error) {
    return handleActionError(error, 'getTodaysCheckInsAction', logger)
  }
}

export async function getTeacherShiftsAction(
  teacherId: string
): Promise<ActionResult<Shift[]>> {
  try {
    const shifts = await getTeacherShifts(teacherId)
    return { success: true, data: shifts }
  } catch (error) {
    return handleActionError(error, 'getTeacherShiftsAction', logger)
  }
}

export async function getCheckInWindowStatusAction(
  shift: Shift
): Promise<ActionResult<CheckInWindowStatus>> {
  try {
    const status = getCheckInWindowStatus(shift)
    return { success: true, data: status }
  } catch (error) {
    return handleActionError(error, 'getCheckInWindowStatusAction', logger)
  }
}
