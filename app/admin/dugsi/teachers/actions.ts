'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'

import { Program, Shift } from '@prisma/client'
import { z } from 'zod'

import {
  countActiveClassesForTeacher,
  getActiveClassesForTeacher,
  getClassCountsByTeacherIds,
} from '@/lib/db/queries/dugsi-class'
import {
  type PersonContactFields,
  updatePersonContact,
} from '@/lib/db/queries/person'
import {
  getTeacherById,
  getTeacherDugsiProgram,
  updateTeacherProgramShifts,
} from '@/lib/db/queries/teacher'
import {
  getAllDugsiTeachersWithTodayStatus,
  getCheckinHistory,
  getCheckinsForDate,
  getLateArrivals,
  getDugsiTeachersForDropdown,
  TeacherCheckinWithRelations,
} from '@/lib/db/queries/teacher-checkin'
import { searchPeopleWithRoles } from '@/lib/db/queries/teacher-management'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger } from '@/lib/logger'
import {
  mapPersonToSearchResult,
  PersonSearchResult,
} from '@/lib/mappers/person-mapper'
import { adminActionClient } from '@/lib/safe-action'
import {
  updateCheckin,
  deleteCheckin,
} from '@/lib/services/dugsi/teacher-checkin-service'
import {
  createTeacherAndAssignDugsi,
  createPersonTeacherAndAssignDugsi,
  deactivateTeacherFromDugsi,
  deleteTeacher,
  assignTeacherToProgram,
  removeTeacherFromProgram,
  bulkAssignPrograms,
  getAllTeachers,
  getTeacherPrograms,
} from '@/lib/services/shared/teacher-service'
import { ValidationError } from '@/lib/services/validation-service'
import {
  normalizeEmail,
  normalizePhone,
} from '@/lib/utils/contact-normalization'
import { isPrismaError } from '@/lib/utils/type-guards'
import {
  UpdateCheckinSchema,
  DeleteCheckinSchema,
  CheckinHistoryFiltersSchema,
  LateReportFiltersSchema,
  DateCheckinFiltersSchema,
} from '@/lib/validations/teacher-checkin'

const logger = createServiceLogger('teacher-admin-actions')

function throwIfAlreadyTeacher(error: unknown): never {
  if (
    error instanceof ValidationError &&
    error.code === 'TEACHER_ALREADY_EXISTS'
  ) {
    throw new ActionError(
      'This person is already a teacher',
      ERROR_CODES.VALIDATION_ERROR
    )
  }
  throw error as Error
}

function throwIfCheckinValidationError(error: unknown): never {
  if (error instanceof ValidationError) {
    throw new ActionError(error.message, ERROR_CODES.VALIDATION_ERROR)
  }
  throw error as Error
}

// Search configuration
const SEARCH_MIN_LENGTH = 2
const SEARCH_MAX_RESULTS = 20

// Re-export PersonSearchResult for client components
export type { PersonSearchResult }

// ============================================================================
// Types
// ============================================================================

export interface CheckinStatus {
  clockInTime: Date | null
  clockOutTime: Date | null
  isLate: boolean
}

export interface TeacherWithDetails {
  id: string
  personId: string
  name: string
  email: string | null
  phone: string | null
  programs: Program[]
  classCount: number
  shifts: Shift[]
  morningCheckin: CheckinStatus | null
  afternoonCheckin: CheckinStatus | null
  createdAt: Date
}

export interface CreateTeacherInput {
  personId: string
}

export interface ProgramAssignmentInput {
  teacherId: string
  program: Program
}

export interface BulkProgramAssignmentInput {
  teacherId: string
  programs: Program[]
}

export interface UpdateTeacherDetailsInput {
  teacherId: string
  name: string
  email?: string
  phone?: string
}

export interface UpdateTeacherShiftsInput {
  teacherId: string
  shifts: Shift[]
}

// ============================================================================
// Validation Schemas
// ============================================================================

const uuidSchema = z.string().uuid('Invalid ID format')

const createTeacherSchema = z.object({
  personId: uuidSchema,
})

const createTeacherWithPersonSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z
    .string()
    .refine(
      (val) => !val || normalizePhone(val) !== null,
      'Invalid phone number. Expected a 10-digit US number (e.g. 612-555-1234)'
    )
    .optional(),
})

const deleteTeacherSchema = z.object({
  teacherId: uuidSchema,
})

const getTeacherProgramsSchema = z.object({
  teacherId: uuidSchema,
})

const updateTeacherDetailsSchema = z.object({
  teacherId: uuidSchema,
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z
    .string()
    .refine(
      (val) => !val || normalizePhone(val) !== null,
      'Invalid phone number. Expected a 10-digit US number (e.g. 612-555-1234)'
    )
    .optional(),
})

const updateTeacherShiftsSchema = z.object({
  teacherId: uuidSchema,
  shifts: z.array(z.nativeEnum(Shift)),
})

const getTeachersSchema = z.object({
  program: z.nativeEnum(Program).optional(),
})

const programAssignmentSchema = z.object({
  teacherId: z.string().uuid(),
  program: z.nativeEnum(Program),
})

const bulkProgramAssignmentSchema = z.object({
  teacherId: z.string().uuid(),
  programs: z.array(z.nativeEnum(Program)),
})

const checkinHistoryInputSchema = z.object({
  teacherId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
})

// ============================================================================
// Teacher CRUD Actions
// ============================================================================

const _getTeachers = adminActionClient
  .metadata({ actionName: 'getTeachers' })
  .schema(getTeachersSchema)
  .action(async ({ parsedInput }) => {
    const { program } = parsedInput
    if (program === 'DUGSI_PROGRAM') {
      const [teachers, teachersWithStatus] = await Promise.all([
        getAllTeachers('DUGSI_PROGRAM'),
        getAllDugsiTeachersWithTodayStatus(),
      ])
      const teacherIds = teachers.map((t) => t.id)

      const statusMap = new Map(
        teachersWithStatus.map((t) => [
          t.id,
          {
            shifts: t.shifts,
            morningCheckin: t.morningCheckin,
            afternoonCheckin: t.afternoonCheckin,
          },
        ])
      )

      const classCountMap = await getClassCountsByTeacherIds(teacherIds)

      const teachersWithDetails: TeacherWithDetails[] = teachers.map(
        (teacher) => {
          const email = teacher.person.email
          const phone = teacher.person.phone
          const status = statusMap.get(teacher.id)

          const dugsiProgram = teacher.programs.find(
            (p) => p.program === 'DUGSI_PROGRAM' && p.isActive
          )
          const assignedShifts = dugsiProgram?.shifts ?? []

          return {
            id: teacher.id,
            personId: teacher.personId,
            name: teacher.person.name,
            email,
            phone,
            programs: teacher.programs
              .filter((p) => p.isActive)
              .map((p) => p.program),
            classCount: classCountMap.get(teacher.id) ?? 0,
            shifts: assignedShifts,
            morningCheckin: status?.morningCheckin
              ? {
                  clockInTime: status.morningCheckin.clockInTime,
                  clockOutTime: status.morningCheckin.clockOutTime,
                  isLate: status.morningCheckin.isLate,
                }
              : null,
            afternoonCheckin: status?.afternoonCheckin
              ? {
                  clockInTime: status.afternoonCheckin.clockInTime,
                  clockOutTime: status.afternoonCheckin.clockOutTime,
                  isLate: status.afternoonCheckin.isLate,
                }
              : null,
            createdAt: teacher.createdAt,
          }
        }
      )

      return teachersWithDetails
    }

    const teachers = await getAllTeachers(program)
    const teacherIds = teachers.map((t) => t.id)

    const countMap = await getClassCountsByTeacherIds(teacherIds)

    return teachers.map((teacher) => ({
      id: teacher.id,
      personId: teacher.personId,
      name: teacher.person.name,
      email: teacher.person.email,
      phone: teacher.person.phone,
      programs: teacher.programs
        .filter((p) => p.isActive)
        .map((p) => p.program),
      classCount: countMap.get(teacher.id) ?? 0,
      shifts: [] as Shift[],
      morningCheckin: null,
      afternoonCheckin: null,
      createdAt: teacher.createdAt,
    }))
  })

const _createTeacherAction = adminActionClient
  .metadata({ actionName: 'createTeacherAction' })
  .schema(createTeacherSchema)
  .action(async ({ parsedInput }) => {
    const { personId } = parsedInput
    try {
      const teacher = await createTeacherAndAssignDugsi(personId)
      after(() => revalidatePath('/admin/dugsi/teachers'))
      return { teacherId: teacher.id }
    } catch (error) {
      throwIfAlreadyTeacher(error)
    }
  })

const _createTeacherWithPersonAction = adminActionClient
  .metadata({ actionName: 'createTeacherWithPersonAction' })
  .schema(createTeacherWithPersonSchema)
  .action(async ({ parsedInput }) => {
    const { name, email, phone } = parsedInput
    try {
      const teacher = await createPersonTeacherAndAssignDugsi({
        name,
        email: normalizeEmail(email),
        phone: phone ? normalizePhone(phone) : null,
      })
      after(() => revalidatePath('/admin/dugsi/teachers'))
      return { teacherId: teacher.id }
    } catch (error) {
      throwIfAlreadyTeacher(error)
    }
  })

const _deleteTeacherAction = adminActionClient
  .metadata({ actionName: 'deleteTeacherAction' })
  .schema(deleteTeacherSchema)
  .action(async ({ parsedInput }) => {
    const { teacherId } = parsedInput
    await deleteTeacher(teacherId)

    after(() => revalidatePath('/admin/dugsi/teachers'))

    logger.info({ teacherId }, 'Teacher deleted')
  })

const _updateTeacherDetailsAction = adminActionClient
  .metadata({ actionName: 'updateTeacherDetailsAction' })
  .schema(updateTeacherDetailsSchema)
  .action(async ({ parsedInput }) => {
    const { teacherId, name, email, phone } = parsedInput
    try {
      const teacher = await getTeacherById(teacherId)

      if (!teacher) {
        throw new ActionError('Teacher not found', ERROR_CODES.NOT_FOUND)
      }

      const normalizedPhone = phone ? normalizePhone(phone) : null

      const personData: PersonContactFields = { name }
      if (email !== undefined) personData.email = normalizeEmail(email)
      if (phone !== undefined) personData.phone = normalizedPhone

      await updatePersonContact(teacher.personId, personData)

      after(() => revalidatePath('/admin/dugsi/teachers'))

      logger.info({ teacherId, name }, 'Teacher details updated')

      const teachers = await getAllTeachers('DUGSI_PROGRAM')
      const teacherIds = teachers.map((t) => t.id)
      const classCountMap = await getClassCountsByTeacherIds(teacherIds)
      const updated = teachers.find((t) => t.id === teacherId)

      if (!updated) {
        throw new ActionError(
          'Failed to fetch updated teacher',
          ERROR_CODES.NOT_FOUND
        )
      }

      const dugsiProgram = updated.programs.find(
        (p) => p.program === 'DUGSI_PROGRAM' && p.isActive
      )

      return {
        id: updated.id,
        personId: updated.personId,
        name: updated.person.name,
        email: updated.person.email,
        phone: updated.person.phone,
        programs: updated.programs
          .filter((p) => p.isActive)
          .map((p) => p.program),
        classCount: classCountMap.get(updated.id) ?? 0,
        shifts: dugsiProgram?.shifts ?? [],
        morningCheckin: null,
        afternoonCheckin: null,
        createdAt: updated.createdAt,
      } satisfies TeacherWithDetails
    } catch (error) {
      if (error instanceof ActionError) throw error
      if (isPrismaError(error) && error.code === 'P2002') {
        logger.warn({ teacherId }, 'Duplicate contact on teacher update')
        throw new ActionError(
          'This email or phone is already in use',
          ERROR_CODES.VALIDATION_ERROR
        )
      }
      throw error
    }
  })

const _updateTeacherShiftsAction = adminActionClient
  .metadata({ actionName: 'updateTeacherShiftsAction' })
  .schema(updateTeacherShiftsSchema)
  .action(async ({ parsedInput }) => {
    const { teacherId, shifts } = parsedInput
    const teacherProgram = await getTeacherDugsiProgram(teacherId)

    if (!teacherProgram) {
      throw new ActionError(
        'Teacher is not enrolled in Dugsi',
        ERROR_CODES.NOT_FOUND
      )
    }

    await updateTeacherProgramShifts(teacherProgram.id, shifts)

    after(() => revalidatePath('/admin/dugsi/teachers'))

    logger.info({ teacherId, shifts }, 'Teacher shifts updated')

    return shifts
  })

const _getTeacherShiftsAction = adminActionClient
  .metadata({ actionName: 'getTeacherShiftsAction' })
  .schema(z.object({ teacherId: uuidSchema }))
  .action(async ({ parsedInput }) => {
    const { teacherId } = parsedInput
    const teacherProgram = await getTeacherDugsiProgram(teacherId)
    return teacherProgram?.shifts ?? []
  })

const _deactivateTeacherAction = adminActionClient
  .metadata({ actionName: 'deactivateTeacherAction' })
  .schema(z.object({ teacherId: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    const { teacherId } = parsedInput
    const activeClasses = await getActiveClassesForTeacher(teacherId)

    if (activeClasses.length > 0) {
      const classNames = activeClasses
        .map((c) => `${c.class.name} (${c.class.shift})`)
        .join(', ')
      throw new ActionError(
        `Cannot deactivate. Teacher is still assigned to: ${classNames}. Please reassign these classes first.`,
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    await deactivateTeacherFromDugsi(teacherId)

    after(() => revalidatePath('/admin/dugsi/teachers'))
  })

// ============================================================================
// Program Enrollment Actions
// ============================================================================

const _assignTeacherToProgramAction = adminActionClient
  .metadata({ actionName: 'assignTeacherToProgramAction' })
  .schema(programAssignmentSchema)
  .action(async ({ parsedInput }) => {
    try {
      await assignTeacherToProgram(parsedInput)

      after(() => {
        revalidatePath('/admin/teachers')
        revalidatePath(
          `/admin/${parsedInput.program.toLowerCase().replace('_program', '')}`
        )
      })

      logger.info(
        { teacherId: parsedInput.teacherId, program: parsedInput.program },
        'Teacher assigned to program'
      )
    } catch (error) {
      if (error instanceof ValidationError) {
        if (error.code === 'DUPLICATE_PROGRAM_ENROLLMENT')
          throw new ActionError(
            'Teacher is already enrolled in this program',
            ERROR_CODES.VALIDATION_ERROR
          )
        if (error.code === 'TEACHER_NOT_FOUND')
          throw new ActionError('Teacher not found', ERROR_CODES.NOT_FOUND)
      }
      throw error
    }
  })

const _removeTeacherFromProgramAction = adminActionClient
  .metadata({ actionName: 'removeTeacherFromProgramAction' })
  .schema(programAssignmentSchema)
  .action(async ({ parsedInput }) => {
    if (parsedInput.program === 'DUGSI_PROGRAM') {
      const activeClasses = await countActiveClassesForTeacher(
        parsedInput.teacherId
      )

      if (activeClasses > 0) {
        throw new ActionError(
          `Cannot remove teacher from ${parsedInput.program}. They are assigned to ${activeClasses} class(es). Please remove class assignments first.`,
          ERROR_CODES.VALIDATION_ERROR
        )
      }
    }

    await removeTeacherFromProgram(parsedInput)

    after(() => {
      revalidatePath('/admin/teachers')
      revalidatePath(
        `/admin/${parsedInput.program.toLowerCase().replace('_program', '')}`
      )
    })

    logger.info(
      { teacherId: parsedInput.teacherId, program: parsedInput.program },
      'Teacher removed from program'
    )
  })

const _bulkAssignProgramsAction = adminActionClient
  .metadata({ actionName: 'bulkAssignProgramsAction' })
  .schema(bulkProgramAssignmentSchema)
  .action(async ({ parsedInput }) => {
    const { teacherId, programs } = parsedInput
    try {
      await bulkAssignPrograms(teacherId, programs)
    } catch (error) {
      if (error instanceof ValidationError) {
        if (error.code === 'TEACHER_NOT_FOUND')
          throw new ActionError(error.message, ERROR_CODES.NOT_FOUND)
        throw new ActionError(error.message, ERROR_CODES.VALIDATION_ERROR)
      }
      throw error
    }

    after(() => {
      revalidatePath('/admin/teachers')
      programs.forEach((program) => {
        revalidatePath(
          `/admin/${program.toLowerCase().replace('_program', '')}`
        )
      })
    })

    logger.info(
      { teacherId, programs, count: programs.length },
      'Programs bulk assigned to teacher'
    )
  })

const _getTeacherProgramsAction = adminActionClient
  .metadata({ actionName: 'getTeacherProgramsAction' })
  .schema(getTeacherProgramsSchema)
  .action(async ({ parsedInput }) => {
    const { teacherId } = parsedInput
    const programs = await getTeacherPrograms(teacherId)
    return programs.map((p) => p.program)
  })

const _searchPeopleAction = adminActionClient
  .metadata({ actionName: 'searchPeopleAction' })
  .schema(z.object({ query: z.string() }))
  .action(async ({ parsedInput }) => {
    const { query } = parsedInput
    if (!query || query.trim().length < SEARCH_MIN_LENGTH) {
      return [] as PersonSearchResult[]
    }

    const people = await searchPeopleWithRoles(query, SEARCH_MAX_RESULTS)
    return people.map((person) => mapPersonToSearchResult(person))
  })

// ============================================================================
// Check-in History Actions
// ============================================================================

export interface CheckinHistoryItem {
  id: string
  date: string
  shift: Shift
  clockInTime: Date
  clockOutTime: Date | null
  isLate: boolean
  clockInValid: boolean
}

export interface CheckinHistoryResult {
  data: CheckinHistoryItem[]
  total: number
  page: number
  totalPages: number
}

const _getTeacherCheckinHistoryAction = adminActionClient
  .metadata({ actionName: 'getTeacherCheckinHistoryAction' })
  .schema(checkinHistoryInputSchema)
  .action(async ({ parsedInput }) => {
    const { teacherId, page } = parsedInput
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const result = await getCheckinHistory(
      { teacherId, dateFrom: thirtyDaysAgo },
      { page, limit: 10 }
    )

    const items: CheckinHistoryItem[] = result.data.map((checkin) => ({
      id: checkin.id,
      date: checkin.date.toISOString().split('T')[0],
      shift: checkin.shift,
      clockInTime: checkin.clockInTime,
      clockOutTime: checkin.clockOutTime,
      isLate: checkin.isLate,
      clockInValid: checkin.clockInValid,
    }))

    return {
      data: items,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    } satisfies CheckinHistoryResult
  })

// ============================================================================
// Check-in Admin Actions (Edit/Delete)
// ============================================================================

export interface CheckinRecord {
  id: string
  teacherId: string
  teacherName: string
  date: string
  shift: Shift
  clockInTime: Date
  clockOutTime: Date | null
  isLate: boolean
  clockInValid: boolean
  notes: string | null
}

export interface TeacherOption {
  id: string
  name: string
}

function mapCheckinToRecord(
  checkin: TeacherCheckinWithRelations
): CheckinRecord {
  return {
    id: checkin.id,
    teacherId: checkin.teacherId,
    teacherName: checkin.teacher.person.name,
    date: checkin.date.toISOString().split('T')[0],
    shift: checkin.shift,
    clockInTime: checkin.clockInTime,
    clockOutTime: checkin.clockOutTime,
    isLate: checkin.isLate,
    clockInValid: checkin.clockInValid,
    notes: checkin.notes,
  }
}

const _getCheckinsForDateAction = adminActionClient
  .metadata({ actionName: 'getCheckinsForDateAction' })
  .schema(DateCheckinFiltersSchema)
  .action(async ({ parsedInput }) => {
    const checkins = await getCheckinsForDate(parsedInput)
    return checkins.map(mapCheckinToRecord)
  })

const _getCheckinHistoryWithFiltersAction = adminActionClient
  .metadata({ actionName: 'getCheckinHistoryWithFiltersAction' })
  .schema(CheckinHistoryFiltersSchema)
  .action(async ({ parsedInput }) => {
    const { page, limit, ...queryFilters } = parsedInput
    const result = await getCheckinHistory(queryFilters, { page, limit })
    const records = result.data.map(mapCheckinToRecord)

    return {
      data: records,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    }
  })

const _getLateArrivalsAction = adminActionClient
  .metadata({ actionName: 'getLateArrivalsAction' })
  .schema(LateReportFiltersSchema)
  .action(async ({ parsedInput }) => {
    const checkins = await getLateArrivals(parsedInput)
    return checkins.map(mapCheckinToRecord)
  })

const _getTeachersForDropdownAction = adminActionClient
  .metadata({ actionName: 'getTeachersForDropdownAction' })
  .action(async () => {
    const teachers = await getDugsiTeachersForDropdown()
    return teachers.map((t) => ({
      id: t.id,
      name: t.name,
    })) satisfies TeacherOption[]
  })

const _updateCheckinAction = adminActionClient
  .metadata({ actionName: 'updateCheckinAction' })
  .schema(UpdateCheckinSchema)
  .action(async ({ parsedInput }) => {
    try {
      const updated = await updateCheckin(parsedInput)
      const record = mapCheckinToRecord(updated)

      after(() => {
        revalidatePath('/admin/dugsi/teachers')
        revalidatePath('/admin/dugsi/teachers/attendance')
        revalidatePath('/teacher/checkin')
      })

      logger.info(
        { checkInId: parsedInput.checkInId },
        'Check-in updated by admin'
      )

      return record
    } catch (error) {
      throwIfCheckinValidationError(error)
    }
  })

const _deleteCheckinAction = adminActionClient
  .metadata({ actionName: 'deleteCheckinAction' })
  .schema(DeleteCheckinSchema)
  .action(async ({ parsedInput }) => {
    try {
      await deleteCheckin(parsedInput.checkInId, 'admin')

      after(() => {
        revalidatePath('/admin/dugsi/teachers')
        revalidatePath('/admin/dugsi/teachers/attendance')
        revalidatePath('/teacher/checkin')
      })

      logger.info(
        { checkInId: parsedInput.checkInId },
        'Check-in deleted by admin'
      )
    } catch (error) {
      throwIfCheckinValidationError(error)
    }
  })

export async function getTeachers(...args: Parameters<typeof _getTeachers>) {
  return _getTeachers(...args)
}
export async function createTeacherAction(
  ...args: Parameters<typeof _createTeacherAction>
) {
  return _createTeacherAction(...args)
}
export async function createTeacherWithPersonAction(
  ...args: Parameters<typeof _createTeacherWithPersonAction>
) {
  return _createTeacherWithPersonAction(...args)
}
export async function deleteTeacherAction(
  ...args: Parameters<typeof _deleteTeacherAction>
) {
  return _deleteTeacherAction(...args)
}
export async function updateTeacherDetailsAction(
  ...args: Parameters<typeof _updateTeacherDetailsAction>
) {
  return _updateTeacherDetailsAction(...args)
}
export async function updateTeacherShiftsAction(
  ...args: Parameters<typeof _updateTeacherShiftsAction>
) {
  return _updateTeacherShiftsAction(...args)
}
export async function getTeacherShiftsAction(
  ...args: Parameters<typeof _getTeacherShiftsAction>
) {
  return _getTeacherShiftsAction(...args)
}
export async function deactivateTeacherAction(
  ...args: Parameters<typeof _deactivateTeacherAction>
) {
  return _deactivateTeacherAction(...args)
}
export async function assignTeacherToProgramAction(
  ...args: Parameters<typeof _assignTeacherToProgramAction>
) {
  return _assignTeacherToProgramAction(...args)
}
export async function removeTeacherFromProgramAction(
  ...args: Parameters<typeof _removeTeacherFromProgramAction>
) {
  return _removeTeacherFromProgramAction(...args)
}
export async function bulkAssignProgramsAction(
  ...args: Parameters<typeof _bulkAssignProgramsAction>
) {
  return _bulkAssignProgramsAction(...args)
}
export async function getTeacherProgramsAction(
  ...args: Parameters<typeof _getTeacherProgramsAction>
) {
  return _getTeacherProgramsAction(...args)
}
export async function searchPeopleAction(
  ...args: Parameters<typeof _searchPeopleAction>
) {
  return _searchPeopleAction(...args)
}
export async function getTeacherCheckinHistoryAction(
  ...args: Parameters<typeof _getTeacherCheckinHistoryAction>
) {
  return _getTeacherCheckinHistoryAction(...args)
}
export async function getCheckinsForDateAction(
  ...args: Parameters<typeof _getCheckinsForDateAction>
) {
  return _getCheckinsForDateAction(...args)
}
export async function getCheckinHistoryWithFiltersAction(
  ...args: Parameters<typeof _getCheckinHistoryWithFiltersAction>
) {
  return _getCheckinHistoryWithFiltersAction(...args)
}
export async function getLateArrivalsAction(
  ...args: Parameters<typeof _getLateArrivalsAction>
) {
  return _getLateArrivalsAction(...args)
}
export async function getTeachersForDropdownAction(
  ...args: Parameters<typeof _getTeachersForDropdownAction>
) {
  return _getTeachersForDropdownAction(...args)
}
export async function updateCheckinAction(
  ...args: Parameters<typeof _updateCheckinAction>
) {
  return _updateCheckinAction(...args)
}
export async function deleteCheckinAction(
  ...args: Parameters<typeof _deleteCheckinAction>
) {
  return _deleteCheckinAction(...args)
}
