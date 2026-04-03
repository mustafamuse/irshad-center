'use server'

import { revalidatePath } from 'next/cache'

import { Prisma, Program, Shift } from '@prisma/client'
import { z } from 'zod'

import { assertAdmin } from '@/lib/auth'
import { ActionError } from '@/lib/errors/action-error'
import { prisma } from '@/lib/db'
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
import { createServiceLogger, logError } from '@/lib/logger'
import {
  mapPersonToSearchResult,
  PersonSearchResult,
} from '@/lib/mappers/person-mapper'
import {
  updateCheckin,
  deleteCheckin,
} from '@/lib/services/dugsi/teacher-checkin-service'
import {
  createTeacher,
  deleteTeacher,
  assignTeacherToProgram,
  removeTeacherFromProgram,
  bulkAssignPrograms,
  getAllTeachers,
  getTeacherPrograms,
} from '@/lib/services/shared/teacher-service'
import { ValidationError } from '@/lib/services/validation-service'
import { ActionResult } from '@/lib/utils/action-helpers'
import {
  normalizeEmail,
  normalizePhone,
  validateAndNormalizeEmail,
} from '@/lib/utils/contact-normalization'
import {
  UpdateCheckinSchema,
  DeleteCheckinSchema,
  CheckinHistoryFiltersSchema,
  LateReportFiltersSchema,
  DateCheckinFiltersSchema,
} from '@/lib/validations/teacher-checkin'

const logger = createServiceLogger('teacher-admin-actions')

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
  shifts: z.array(z.enum(['MORNING', 'AFTERNOON'])),
})

// ============================================================================
// Teacher CRUD Actions
// ============================================================================

/**
 * Get all Dugsi teachers with their details and today's check-in status.
 * When filtering by DUGSI_PROGRAM, includes check-in data.
 */
export async function getTeachers(
  program?: Program
): Promise<ActionResult<TeacherWithDetails[]>> {
  try {
    await assertAdmin('getTeachers')
    if (program === 'DUGSI_PROGRAM') {
      // Get ALL teachers enrolled in Dugsi (not just those with class assignments)
      const teachers = await getAllTeachers('DUGSI_PROGRAM')
      const teacherIds = teachers.map((t) => t.id)

      // Get check-in status for teachers with class assignments
      const teachersWithStatus = await getAllDugsiTeachersWithTodayStatus()
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

      // Get class counts
      const classCountMap = await getClassCountsByTeacherIds(teacherIds)

      const teachersWithDetails: TeacherWithDetails[] = teachers.map(
        (teacher) => {
          const email = teacher.person.email
          const phone = teacher.person.phone
          const status = statusMap.get(teacher.id)

          // Get shifts from TeacherProgram.shifts (directly assigned)
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

      return { success: true, data: teachersWithDetails }
    }

    const teachers = await getAllTeachers(program)
    const teacherIds = teachers.map((t) => t.id)

    const countMap = await getClassCountsByTeacherIds(teacherIds)

    const teachersWithDetails = teachers.map((teacher) => {
      const email = teacher.person.email
      const phone = teacher.person.phone

      return {
        id: teacher.id,
        personId: teacher.personId,
        name: teacher.person.name,
        email,
        phone,
        programs: teacher.programs
          .filter((p) => p.isActive)
          .map((p) => p.program),
        classCount: countMap.get(teacher.id) ?? 0,
        shifts: [] as Shift[],
        morningCheckin: null,
        afternoonCheckin: null,
        createdAt: teacher.createdAt,
      }
    })

    return { success: true, data: teachersWithDetails }
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to get teachers')
    return {
      success: false,
      error: 'Failed to load teachers',
    }
  }
}

/**
 * Create a new teacher from an existing person.
 */
export async function createTeacherAction(
  rawInput: unknown
): Promise<ActionResult<{ teacherId: string }>> {
  let personId: string | undefined

  try {
    await assertAdmin('createTeacherAction')
    const parsed = createTeacherSchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: 'Invalid input: ' + parsed.error.message }
    }
    const input = parsed.data
    personId = input.personId
    // Use transaction to create teacher and enroll in Dugsi atomically
    const teacher = await prisma.$transaction(async (tx) => {
      const newTeacher = await createTeacher(input.personId, tx)

      // Auto-enroll in Dugsi since this is the Dugsi teachers page
      await tx.teacherProgram.create({
        data: {
          teacherId: newTeacher.id,
          program: 'DUGSI_PROGRAM',
        },
      })

      return newTeacher
    })

    revalidatePath('/admin/dugsi/teachers')

    logger.info(
      {
        teacherId: teacher.id,
        personId: input.personId,
        name: teacher.person.name,
      },
      'Teacher created and enrolled in Dugsi'
    )

    return {
      success: true,
      data: { teacherId: teacher.id },
    }
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to create teacher', {
      personId,
    })

    if (
      error instanceof ValidationError &&
      error.code === 'TEACHER_ALREADY_EXISTS'
    ) {
      return {
        success: false,
        error: 'This person is already a teacher',
      }
    }

    return {
      success: false,
      error: 'Failed to create teacher',
    }
  }
}

/**
 * Create a new teacher by first creating a person.
 */
export async function createTeacherWithPersonAction(
  rawInput: unknown
): Promise<ActionResult<{ teacherId: string }>> {
  const parsed = createTeacherWithPersonSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Invalid input',
    }
  }
  const input = parsed.data

  try {
    await assertAdmin('createTeacherWithPersonAction')
    const normalizedPhone = input.phone ? normalizePhone(input.phone) : null

    const teacher = await prisma.$transaction(async (tx) => {
      const person = await tx.person.create({
        data: {
          name: input.name,
          email: normalizeEmail(input.email),
          phone: normalizedPhone,
        },
      })

      const newTeacher = await createTeacher(person.id, tx)

      // Auto-enroll in Dugsi since this is the Dugsi teachers page
      await tx.teacherProgram.create({
        data: {
          teacherId: newTeacher.id,
          program: 'DUGSI_PROGRAM',
        },
      })

      return newTeacher
    })

    revalidatePath('/admin/dugsi/teachers')

    logger.info(
      {
        teacherId: teacher.id,
        personId: teacher.personId,
        name: teacher.person.name,
      },
      'Teacher created with new person'
    )

    return {
      success: true,
      data: { teacherId: teacher.id },
    }
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      logger.warn(
        { hasEmail: !!input.email, hasPhone: !!input.phone },
        'Duplicate contact on teacher create'
      )
      return {
        success: false,
        error: 'A person with this email or phone already exists',
      }
    }

    await logError(logger, error, 'Failed to create teacher with person', {
      name: input.name,
      hasEmail: !!input.email,
      hasPhone: !!input.phone,
    })

    if (
      error instanceof ValidationError &&
      error.code === 'TEACHER_ALREADY_EXISTS'
    ) {
      return {
        success: false,
        error: 'This person is already a teacher',
      }
    }

    return {
      success: false,
      error: 'Failed to create teacher',
    }
  }
}

/**
 * Delete a teacher (soft delete).
 */
export async function deleteTeacherAction(
  rawInput: unknown
): Promise<ActionResult<void>> {
  let teacherId: string | undefined

  try {
    await assertAdmin('deleteTeacherAction')
    const parsed = deleteTeacherSchema.safeParse({ teacherId: rawInput })
    if (!parsed.success) {
      return { success: false, error: 'Invalid input: ' + parsed.error.message }
    }
    teacherId = parsed.data.teacherId
    await deleteTeacher(teacherId)

    revalidatePath('/admin/teachers')

    logger.info({ teacherId }, 'Teacher deleted')

    return { success: true, data: undefined }
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to delete teacher', { teacherId })
    return {
      success: false,
      error: 'Failed to delete teacher',
    }
  }
}

/**
 * Update teacher details (name, email, phone).
 * Updates the underlying Person record.
 */
export async function updateTeacherDetailsAction(
  input: UpdateTeacherDetailsInput
): Promise<ActionResult<TeacherWithDetails>> {
  try {
    await assertAdmin('updateTeacherDetailsAction')
    const parsed = updateTeacherDetailsSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid input',
      }
    }

    const { teacherId, name, email, phone } = parsed.data
    const teacher = await getTeacherById(teacherId)

    if (!teacher) {
      return { success: false, error: 'Teacher not found' }
    }

    // Schema already validated phone format via .refine() — normalizedPhone is safe.
    const normalizedPhone = phone ? normalizePhone(phone) : null

    // Only include contact fields in update when explicitly provided.
    // undefined = skip field (Prisma leaves it unchanged); null = clear the field.
    const personData: PersonContactFields = { name }
    if (email !== undefined) personData.email = normalizeEmail(email)
    if (phone !== undefined) personData.phone = normalizedPhone

    await updatePersonContact(teacher.personId, personData)

    revalidatePath('/admin/dugsi/teachers')

    logger.info({ teacherId, name }, 'Teacher details updated')

    const result = await getTeachers('DUGSI_PROGRAM')
    if (result.success && result.data) {
      const updated = result.data.find((t) => t.id === teacherId)
      if (updated) {
        return { success: true, data: updated }
      }
    }

    return { success: false, error: 'Failed to fetch updated teacher' }
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      logger.warn(
        { teacherId: input.teacherId },
        'Duplicate contact on teacher update'
      )
      return {
        success: false,
        error: 'This email or phone is already in use',
      }
    }

    await logError(logger, error, 'Failed to update teacher details', {
      teacherId: input.teacherId,
    })

    return {
      success: false,
      error: 'Failed to update teacher details',
    }
  }
}

/**
 * Update teacher shift assignments.
 * Updates TeacherProgram.shifts for DUGSI_PROGRAM.
 */
export async function updateTeacherShiftsAction(
  input: UpdateTeacherShiftsInput
): Promise<ActionResult<Shift[]>> {
  try {
    await assertAdmin('updateTeacherShiftsAction')
    const parsed = updateTeacherShiftsSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid input',
      }
    }

    const { teacherId, shifts } = parsed.data
    const teacherProgram = await getTeacherDugsiProgram(teacherId)

    if (!teacherProgram) {
      return { success: false, error: 'Teacher is not enrolled in Dugsi' }
    }

    await updateTeacherProgramShifts(teacherProgram.id, shifts)

    revalidatePath('/admin/dugsi/teachers')

    logger.info({ teacherId, shifts }, 'Teacher shifts updated')

    return { success: true, data: shifts }
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to update teacher shifts', {
      teacherId: input.teacherId,
    })
    return {
      success: false,
      error: 'Failed to update teacher shifts',
    }
  }
}

/**
 * Get teacher's assigned shifts for Dugsi.
 */
export async function getTeacherShiftsAction(
  teacherId: string
): Promise<ActionResult<Shift[]>> {
  try {
    await assertAdmin('getTeacherShiftsAction')
    const teacherProgram = await getTeacherDugsiProgram(teacherId)

    return { success: true, data: teacherProgram?.shifts ?? [] }
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to get teacher shifts', { teacherId })
    return {
      success: false,
      error: 'Failed to load shifts',
    }
  }
}

/**
 * Deactivate a teacher from Dugsi.
 * Requires all class assignments to be removed first.
 */
export async function deactivateTeacherAction(
  teacherId: string
): Promise<ActionResult<void>> {
  try {
    await assertAdmin('deactivateTeacherAction')
    // Check for active class assignments
    const activeClasses = await getActiveClassesForTeacher(teacherId)

    if (activeClasses.length > 0) {
      const classNames = activeClasses
        .map((c) => `${c.class.name} (${c.class.shift})`)
        .join(', ')
      return {
        success: false,
        error: `Cannot deactivate. Teacher is still assigned to: ${classNames}. Please reassign these classes first.`,
      }
    }

    // Deactivate: clear shifts and mark program enrollment inactive
    await prisma.$transaction(async (tx) => {
      await tx.teacherProgram.updateMany({
        where: {
          teacherId,
          program: 'DUGSI_PROGRAM',
          isActive: true,
        },
        data: {
          shifts: [],
          isActive: false,
        },
      })
    })

    revalidatePath('/admin/dugsi/teachers')

    logger.info({ teacherId }, 'Teacher deactivated from Dugsi')

    return { success: true, data: undefined }
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to deactivate teacher', { teacherId })
    return {
      success: false,
      error: 'Failed to deactivate teacher',
    }
  }
}

// ============================================================================
// Program Enrollment Actions
// ============================================================================

/**
 * Assign a teacher to a program.
 */
export async function assignTeacherToProgramAction(
  input: ProgramAssignmentInput
): Promise<ActionResult<void>> {
  try {
    await assertAdmin('assignTeacherToProgramAction')
    await assignTeacherToProgram(input)

    revalidatePath('/admin/teachers')
    revalidatePath(
      `/admin/${input.program.toLowerCase().replace('_program', '')}`
    )

    logger.info(
      { teacherId: input.teacherId, program: input.program },
      'Teacher assigned to program'
    )

    return { success: true, data: undefined }
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to assign teacher to program', {
      ...input,
    })

    if (
      error instanceof ValidationError &&
      error.code === 'DUPLICATE_PROGRAM_ENROLLMENT'
    ) {
      return {
        success: false,
        error: 'Teacher is already enrolled in this program',
      }
    }

    return {
      success: false,
      error: 'Failed to assign teacher to program',
    }
  }
}

/**
 * Remove a teacher from a program.
 */
export async function removeTeacherFromProgramAction(
  input: ProgramAssignmentInput
): Promise<ActionResult<void>> {
  try {
    await assertAdmin('removeTeacherFromProgramAction')
    // For Dugsi, check for active class assignments
    if (input.program === 'DUGSI_PROGRAM') {
      const activeClasses = await countActiveClassesForTeacher(input.teacherId)

      if (activeClasses > 0) {
        return {
          success: false,
          error: `Cannot remove teacher from ${input.program}. They are assigned to ${activeClasses} class(es). Please remove class assignments first.`,
        }
      }
    }

    await removeTeacherFromProgram(input)

    revalidatePath('/admin/teachers')
    revalidatePath(
      `/admin/${input.program.toLowerCase().replace('_program', '')}`
    )

    logger.info(
      { teacherId: input.teacherId, program: input.program },
      'Teacher removed from program'
    )

    return { success: true, data: undefined }
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to remove teacher from program', {
      ...input,
    })
    return {
      success: false,
      error: 'Failed to remove teacher from program',
    }
  }
}

/**
 * Bulk assign programs to a teacher.
 */
export async function bulkAssignProgramsAction(
  input: BulkProgramAssignmentInput
): Promise<ActionResult<void>> {
  try {
    await assertAdmin('bulkAssignProgramsAction')
    await bulkAssignPrograms(input.teacherId, input.programs)

    revalidatePath('/admin/teachers')
    input.programs.forEach((program) => {
      revalidatePath(`/admin/${program.toLowerCase().replace('_program', '')}`)
    })

    logger.info(
      {
        teacherId: input.teacherId,
        programs: input.programs,
        count: input.programs.length,
      },
      'Programs bulk assigned to teacher'
    )

    return { success: true, data: undefined }
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to bulk assign programs', {
      ...input,
    })
    return {
      success: false,
      error: 'Failed to assign programs to teacher',
    }
  }
}

/**
 * Get programs a teacher is enrolled in.
 */
export async function getTeacherProgramsAction(
  rawInput: unknown
): Promise<ActionResult<Program[]>> {
  let teacherId: string | undefined

  try {
    await assertAdmin('getTeacherProgramsAction')
    const parsed = getTeacherProgramsSchema.safeParse({ teacherId: rawInput })
    if (!parsed.success) {
      return { success: false, error: 'Invalid input: ' + parsed.error.message }
    }
    teacherId = parsed.data.teacherId
    const programs = await getTeacherPrograms(teacherId)

    return {
      success: true,
      data: programs.map((p) => p.program),
    }
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to get teacher programs', {
      teacherId,
    })
    return {
      success: false,
      error: 'Failed to load teacher programs',
    }
  }
}

/**
 * Search for people by name, email, or phone.
 */
export async function searchPeopleAction(
  query: string
): Promise<ActionResult<PersonSearchResult[]>> {
  try {
    await assertAdmin('searchPeopleAction')
    if (!query || query.trim().length < SEARCH_MIN_LENGTH) {
      return { success: true, data: [] }
    }

    const searchTerm = query.trim().toLowerCase()
    const normalizedSearchTerm = normalizePhone(query.trim())

    const people = await prisma.person.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          // validateAndNormalizeEmail returns null for non-email input (e.g. partial names)
          // so the contains query falls back to raw searchTerm for case-insensitive matching.
          {
            email: {
              contains: validateAndNormalizeEmail(query.trim()) ?? searchTerm,
              mode: 'insensitive',
            },
          },
          ...(normalizedSearchTerm ? [{ phone: normalizedSearchTerm }] : []),
        ],
      },
      relationLoadStrategy: 'join',
      include: {
        teacher: {
          include: {
            programs: {
              where: { isActive: true },
            },
          },
        },
        guardianRelationships: {
          where: { isActive: true },
          include: {
            dependent: {
              include: {
                programProfiles: {
                  select: { program: true },
                },
              },
            },
          },
        },
        programProfiles: {
          where: {
            enrollments: {
              some: {
                status: { in: ['REGISTERED', 'ENROLLED'] },
                endDate: null,
              },
            },
          },
          include: {
            enrollments: {
              where: {
                status: { in: ['REGISTERED', 'ENROLLED'] },
                endDate: null,
              },
              select: {
                status: true,
              },
              take: 1,
            },
          },
        },
      },
      take: SEARCH_MAX_RESULTS,
      orderBy: { name: 'asc' },
    })

    const results: PersonSearchResult[] = people.map((person) =>
      mapPersonToSearchResult(person)
    )

    return { success: true, data: results }
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to search people', { query })
    return {
      success: false,
      error: 'Failed to search people',
    }
  }
}

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

/**
 * Get check-in history for a teacher (last 30 days by default).
 */
export async function getTeacherCheckinHistoryAction(
  teacherId: string,
  page: number = 1
): Promise<ActionResult<CheckinHistoryResult>> {
  try {
    await assertAdmin('getTeacherCheckinHistoryAction')
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const result = await getCheckinHistory(
      {
        teacherId,
        dateFrom: thirtyDaysAgo,
      },
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
      success: true,
      data: {
        data: items,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    }
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to get check-in history', {
      teacherId,
    })
    return {
      success: false,
      error: 'Failed to load check-in history',
    }
  }
}

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

/**
 * Get check-ins for a specific date with optional filters.
 */
export async function getCheckinsForDateAction(filters: {
  date?: Date
  shift?: Shift
  teacherId?: string
}): Promise<ActionResult<CheckinRecord[]>> {
  try {
    await assertAdmin('getCheckinsForDateAction')
    const parsed = DateCheckinFiltersSchema.safeParse(filters)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid filters',
      }
    }

    const checkins = await getCheckinsForDate(parsed.data)
    const records = checkins.map(mapCheckinToRecord)

    return { success: true, data: records }
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to get check-ins for date')
    return { success: false, error: 'Failed to load check-ins' }
  }
}

/**
 * Get check-in history with filters and pagination.
 */
export async function getCheckinHistoryWithFiltersAction(filters: {
  dateFrom?: Date
  dateTo?: Date
  shift?: Shift
  teacherId?: string
  isLate?: boolean
  clockInValid?: boolean
  page?: number
  limit?: number
}): Promise<
  ActionResult<{
    data: CheckinRecord[]
    total: number
    page: number
    totalPages: number
  }>
> {
  try {
    await assertAdmin('getCheckinHistoryWithFiltersAction')
    const parsed = CheckinHistoryFiltersSchema.safeParse(filters)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid filters',
      }
    }

    const { page, limit, ...queryFilters } = parsed.data
    const result = await getCheckinHistory(queryFilters, { page, limit })
    const records = result.data.map(mapCheckinToRecord)

    return {
      success: true,
      data: {
        data: records,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    }
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to get check-in history')
    return { success: false, error: 'Failed to load check-in history' }
  }
}

/**
 * Get late arrivals report.
 */
export async function getLateArrivalsAction(filters: {
  dateFrom: Date
  dateTo: Date
  shift?: Shift
  teacherId?: string
}): Promise<ActionResult<CheckinRecord[]>> {
  try {
    await assertAdmin('getLateArrivalsAction')
    const parsed = LateReportFiltersSchema.safeParse(filters)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid filters',
      }
    }

    const checkins = await getLateArrivals(parsed.data)
    const records = checkins.map(mapCheckinToRecord)

    return { success: true, data: records }
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to get late arrivals')
    return { success: false, error: 'Failed to load late arrivals report' }
  }
}

/**
 * Get teachers for dropdown filter.
 */
export async function getTeachersForDropdownAction(): Promise<
  ActionResult<TeacherOption[]>
> {
  try {
    await assertAdmin('getTeachersForDropdownAction')
    const teachers = await getDugsiTeachersForDropdown()
    const options: TeacherOption[] = teachers.map((t) => ({
      id: t.id,
      name: t.name,
    }))

    return { success: true, data: options }
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to get teachers for dropdown')
    return { success: false, error: 'Failed to load teachers' }
  }
}

/**
 * Update a check-in record (admin).
 */
export async function updateCheckinAction(input: {
  checkInId: string
  clockInTime?: Date
  clockOutTime?: Date | null
  isLate?: boolean
  clockInValid?: boolean
  notes?: string | null
}): Promise<ActionResult<CheckinRecord>> {
  try {
    await assertAdmin('updateCheckinAction')
    const parsed = UpdateCheckinSchema.safeParse(input)
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]
      return { success: false, error: firstError?.message || 'Invalid input' }
    }

    const updated = await updateCheckin(parsed.data)
    const record = mapCheckinToRecord(updated)

    revalidatePath('/admin/dugsi/teachers')

    logger.info({ checkInId: input.checkInId }, 'Check-in updated by admin')

    return { success: true, data: record }
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    if (error instanceof ValidationError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to update check-in', {
      checkInId: input.checkInId,
    })
    return { success: false, error: 'Failed to update check-in' }
  }
}

/**
 * Delete a check-in record (admin).
 */
export async function deleteCheckinAction(
  checkInId: string
): Promise<ActionResult<void>> {
  try {
    await assertAdmin('deleteCheckinAction')
    const parsed = DeleteCheckinSchema.safeParse({ checkInId })
    if (!parsed.success) {
      return { success: false, error: 'Invalid check-in ID' }
    }

    await deleteCheckin(parsed.data.checkInId)

    revalidatePath('/admin/dugsi/teachers')

    logger.info({ checkInId }, 'Check-in deleted by admin')

    return { success: true, data: undefined }
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    if (error instanceof ValidationError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to delete check-in', { checkInId })
    return { success: false, error: 'Failed to delete check-in' }
  }
}
