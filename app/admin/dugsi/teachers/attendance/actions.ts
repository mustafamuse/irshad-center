'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'

import { formatInTimeZone } from 'date-fns-tz'

import { SCHOOL_TIMEZONE } from '@/lib/constants/shift-times'
import { getAttendanceConfig } from '@/lib/db/queries/teacher-attendance'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger } from '@/lib/logger'
import { adminActionClient } from '@/lib/safe-action'
import {
  transitionStatus,
  adminCheckIn,
  generateExpectedSlots,
} from '@/lib/services/dugsi/attendance-record-service'
import { markDateClosed, removeClosure } from '@/lib/services/dugsi/school-closure-service'
import { approveExcuse, rejectExcuse } from '@/lib/services/dugsi/excuse-service'
import {
  OverrideAttendanceStatusSchema,
  AdminCheckInSchema,
  MarkDateClosedSchema,
  RemoveClosureSchema,
  UpdateAttendanceConfigSchema,
  GenerateExpectedSlotsSchema,
  ReviewExcuseSchema,
} from '@/lib/validations/teacher-attendance'
import { prisma } from '@/lib/db'

const logger = createServiceLogger('admin-attendance-actions')

const REVALIDATE_PATHS = [
  '/admin/dugsi/teachers',
  '/admin/dugsi/teachers/attendance',
  '/teacher/checkin',
]

function revalidateAll() {
  for (const path of REVALIDATE_PATHS) {
    revalidatePath(path)
  }
}

// ============================================================================
// MUTATIONS (safe-action with adminActionClient)
// ============================================================================

// Identity note: the admin auth token is a PIN-based HMAC (timestamp + signature) with
// no embedded user identity. changedBy/createdBy/reviewedBy are hardcoded to 'admin'
// because the app is designed for a single admin. If multiple admins are added,
// the token format must be extended to carry an identity (e.g. email or name).
const ADMIN_IDENTITY = 'admin'

const _overrideAttendanceStatusAction = adminActionClient
  .metadata({ actionName: 'overrideAttendanceStatusAction' })
  .schema(OverrideAttendanceStatusSchema)
  .action(async ({ parsedInput }) => {
    const { recordId, toStatus, notes } = parsedInput

    await transitionStatus({
      recordId,
      toStatus,
      source: 'ADMIN_OVERRIDE',
      notes,
      changedBy: ADMIN_IDENTITY,
    })

    after(revalidateAll)
    return { success: true }
  })

export async function overrideAttendanceStatusAction(
  ...args: Parameters<typeof _overrideAttendanceStatusAction>
) {
  return _overrideAttendanceStatusAction(...args)
}

const _adminCheckInAction = adminActionClient
  .metadata({ actionName: 'adminCheckInAction' })
  .schema(AdminCheckInSchema)
  .action(async ({ parsedInput }) => {
    const { teacherId, shift, date } = parsedInput
    const dateObj = new Date(date)

    await adminCheckIn({ teacherId, shift, date: dateObj, changedBy: ADMIN_IDENTITY })

    after(revalidateAll)
    return { success: true }
  })

export async function adminCheckInAction(
  ...args: Parameters<typeof _adminCheckInAction>
) {
  return _adminCheckInAction(...args)
}

const _markDateClosedAction = adminActionClient
  .metadata({ actionName: 'markDateClosedAction' })
  .schema(MarkDateClosedSchema)
  .action(async ({ parsedInput }) => {
    const { date, reason } = parsedInput
    const dateObj = new Date(date)

    const result = await markDateClosed({ date: dateObj, reason, createdBy: ADMIN_IDENTITY })

    after(revalidateAll)
    return { closedCount: result.closedCount }
  })

export async function markDateClosedAction(
  ...args: Parameters<typeof _markDateClosedAction>
) {
  return _markDateClosedAction(...args)
}

const _removeClosureAction = adminActionClient
  .metadata({ actionName: 'removeClosureAction' })
  .schema(RemoveClosureSchema)
  .action(async ({ parsedInput }) => {
    const dateObj = new Date(parsedInput.date)
    const result = await removeClosure({ date: dateObj })

    after(revalidateAll)
    return { reopenedCount: result.reopenedCount }
  })

export async function removeClosureAction(
  ...args: Parameters<typeof _removeClosureAction>
) {
  return _removeClosureAction(...args)
}

const _updateAttendanceConfigAction = adminActionClient
  .metadata({ actionName: 'updateAttendanceConfigAction' })
  .schema(UpdateAttendanceConfigSchema)
  .action(async ({ parsedInput }) => {
    await prisma.dugsiAttendanceConfig.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...parsedInput, updatedBy: ADMIN_IDENTITY },
      update: { ...parsedInput, updatedBy: ADMIN_IDENTITY },
    })

    after(() => revalidatePath('/admin/dugsi/teachers/settings'))
    return { success: true }
  })

export async function updateAttendanceConfigAction(
  ...args: Parameters<typeof _updateAttendanceConfigAction>
) {
  return _updateAttendanceConfigAction(...args)
}

const _generateExpectedSlotsAction = adminActionClient
  .metadata({ actionName: 'generateExpectedSlotsAction' })
  .schema(GenerateExpectedSlotsSchema)
  .action(async ({ parsedInput }) => {
    const dateObj = new Date(parsedInput.date)

    const activeTeachers = await prisma.teacherProgram.findMany({
      where: { program: 'DUGSI_PROGRAM', isActive: true },
      select: { teacherId: true, shifts: true },
    })

    const teacherShifts = activeTeachers.map((tp) => ({
      teacherId: tp.teacherId,
      shifts: tp.shifts,
    }))

    const result = await generateExpectedSlots(teacherShifts, dateObj)

    after(revalidateAll)
    return result
  })

export async function generateExpectedSlotsAction(
  ...args: Parameters<typeof _generateExpectedSlotsAction>
) {
  return _generateExpectedSlotsAction(...args)
}

const _approveExcuseAction = adminActionClient
  .metadata({ actionName: 'approveExcuseAction' })
  .schema(ReviewExcuseSchema)
  .action(async ({ parsedInput }) => {
    const { excuseRequestId, adminNote } = parsedInput
    await approveExcuse({ excuseRequestId, adminNote, reviewedBy: ADMIN_IDENTITY })

    after(revalidateAll)
    return { success: true }
  })

export async function approveExcuseAction(
  ...args: Parameters<typeof _approveExcuseAction>
) {
  return _approveExcuseAction(...args)
}

const _rejectExcuseAction = adminActionClient
  .metadata({ actionName: 'rejectExcuseAction' })
  .schema(ReviewExcuseSchema)
  .action(async ({ parsedInput }) => {
    const { excuseRequestId, adminNote } = parsedInput
    await rejectExcuse({ excuseRequestId, adminNote, reviewedBy: ADMIN_IDENTITY })

    after(revalidateAll)
    return { success: true }
  })

export async function rejectExcuseAction(
  ...args: Parameters<typeof _rejectExcuseAction>
) {
  return _rejectExcuseAction(...args)
}
