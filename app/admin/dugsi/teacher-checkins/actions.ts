'use server'

import { revalidatePath } from 'next/cache'

import { Shift } from '@prisma/client'

import {
  getAllDugsiTeachersWithTodayStatus,
  getCheckinHistory,
  getCheckinsForDate,
  getDugsiTeachersForDropdown,
  getLateArrivals,
  type PaginatedCheckins,
  type TeacherCheckinWithRelations,
  type TeacherWithCheckinStatus,
} from '@/lib/db/queries/teacher-checkin'
import { createServiceLogger, logError } from '@/lib/logger'
import {
  deleteCheckin,
  updateCheckin,
} from '@/lib/services/dugsi/teacher-checkin-service'
import { ValidationError } from '@/lib/services/validation-service'
import type { UpdateCheckinInput } from '@/lib/validations/teacher-checkin'

import type { ActionResult, CheckinFilters } from './_types'

const logger = createServiceLogger('teacher-checkin-admin-actions')

export async function getTodayCheckinsAction(
  _shift?: Shift
): Promise<TeacherWithCheckinStatus[]> {
  return getAllDugsiTeachersWithTodayStatus()
}

export async function getCheckinsForDateAction(
  date: string,
  shift?: Shift,
  teacherId?: string
): Promise<TeacherCheckinWithRelations[]> {
  const dateObj = new Date(date)
  return getCheckinsForDate({ date: dateObj, shift, teacherId })
}

export async function getCheckinHistoryAction(
  filters: CheckinFilters,
  pagination: { page: number; limit: number }
): Promise<PaginatedCheckins> {
  return getCheckinHistory(
    {
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
      dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
      shift: filters.shift,
      teacherId: filters.teacherId,
      isLate: filters.isLate,
    },
    pagination
  )
}

export async function getLateArrivalsAction(
  dateFrom: string,
  dateTo: string,
  shift?: Shift,
  teacherId?: string
): Promise<TeacherCheckinWithRelations[]> {
  return getLateArrivals({
    dateFrom: new Date(dateFrom),
    dateTo: new Date(dateTo),
    shift,
    teacherId,
  })
}

export async function getTeachersForFilterAction(): Promise<
  Array<{ id: string; name: string }>
> {
  const teachers = await getDugsiTeachersForDropdown()
  return teachers.map((t) => ({ id: t.id, name: t.name }))
}

export async function updateCheckinAction(
  input: UpdateCheckinInput
): Promise<ActionResult> {
  try {
    await updateCheckin(input)
    revalidatePath('/admin/dugsi/teacher-checkins')
    revalidatePath('/teacher/checkin')

    return {
      success: true,
      message: 'Check-in record updated successfully',
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        success: false,
        error: error.message,
      }
    }

    await logError(logger, error, 'Failed to update check-in', { input })
    return {
      success: false,
      error: 'Failed to update check-in record',
    }
  }
}

export async function deleteCheckinAction(
  checkInId: string
): Promise<ActionResult> {
  try {
    await deleteCheckin(checkInId)
    revalidatePath('/admin/dugsi/teacher-checkins')
    revalidatePath('/teacher/checkin')

    return {
      success: true,
      message: 'Check-in record deleted successfully',
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        success: false,
        error: error.message,
      }
    }

    await logError(logger, error, 'Failed to delete check-in', { checkInId })
    return {
      success: false,
      error: 'Failed to delete check-in record',
    }
  }
}
