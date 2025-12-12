'use server'

import { revalidatePath } from 'next/cache'

import { Shift } from '@prisma/client'

import {
  getTeacherCheckIns,
  getTodaysCheckInsForTeacher,
} from '@/lib/db/queries/dugsi-teacher-checkin'
import { createActionLogger } from '@/lib/logger'
import {
  clockIn,
  clockOut,
  getTeacherShifts,
} from '@/lib/services/dugsi/teacher-checkin-service'
import type { TeacherCheckInDTO } from '@/lib/types/dugsi-attendance'
import { ActionResult, handleActionError } from '@/lib/utils/action-helpers'
import { PRISMA_ERRORS } from '@/lib/utils/type-guards'
import {
  ClockInSchema,
  ClockOutSchema,
} from '@/lib/validations/dugsi-attendance'

const logger = createActionLogger('dugsi-teacher-checkin')

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

    revalidatePath('/admin/dugsi/teacher-checkin')
    revalidatePath('/admin/dugsi/teacher-attendance')

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

    revalidatePath('/admin/dugsi/teacher-checkin')
    revalidatePath('/admin/dugsi/teacher-attendance')

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

export async function getTeacherCheckInsAction(dateRange?: {
  startDate?: Date
  endDate?: Date
}): Promise<ActionResult<TeacherCheckInDTO[]>> {
  try {
    const checkIns = await getTeacherCheckIns(dateRange)
    return { success: true, data: checkIns }
  } catch (error) {
    return handleActionError(error, 'getTeacherCheckInsAction', logger)
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
