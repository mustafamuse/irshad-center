import {
  Person,
  ContactPoint,
  Teacher,
  TeacherProgram,
  GuardianRelationship,
  ProgramProfile,
  Enrollment,
  Program,
  EnrollmentStatus,
} from '@prisma/client'

import { PROGRAM_LABELS } from '@/lib/constants/program-ui'
import { extractContactInfo } from '@/lib/utils/contact-helpers'

/**
 * Search result for person lookup.
 * Used in teacher admin panel for searching and promoting people to teachers.
 */
export interface PersonSearchResult {
  /** Person's unique identifier */
  id: string
  /** Full name */
  name: string
  /** Primary email address, null if none */
  email: string | null
  /** Primary phone number (PHONE or WHATSAPP), null if none */
  phone: string | null
  /** Whether person has active teacher record */
  isTeacher: boolean
  /** Teacher ID if isTeacher is true, null otherwise */
  teacherId: string | null
  /** Display-friendly role labels (e.g., "Teacher", "Mahad Student", "Parent") */
  roles: string[]
  /** Detailed role information for each role type */
  roleDetails: {
    teacher?: {
      programs: Program[]
    }
    student?: {
      programs: Array<{
        program: Program
        status: EnrollmentStatus
      }>
    }
    parent?: {
      childCount: number
      programBreakdown: Array<{
        program: Program
        count: number
      }>
    }
  }
}

type PersonWithRelations = Person & {
  contactPoints: ContactPoint[]
  teacher?:
    | (Teacher & {
        programs: TeacherProgram[]
      })
    | null
  guardianRelationships: Array<
    GuardianRelationship & {
      dependent: {
        programProfiles: Pick<ProgramProfile, 'program'>[]
      }
    }
  >
  programProfiles: Array<
    ProgramProfile & {
      enrollments: Pick<Enrollment, 'status'>[]
    }
  >
}

/**
 * Maps a Person with relations to a PersonSearchResult.
 * Pure transformation function with no database calls or business logic.
 * Extracts role information (teacher, student, parent) and formats for display.
 *
 * @param person - Person record with contactPoints, teacher, guardianRelationships, and programProfiles
 * @returns Formatted search result with role details
 */
export function mapPersonToSearchResult(
  person: PersonWithRelations
): PersonSearchResult {
  const { email, phone } = extractContactInfo(person.contactPoints)

  const roles: string[] = []
  const roleDetails: PersonSearchResult['roleDetails'] = {}

  if (person.teacher) {
    roles.push('Teacher')
    roleDetails.teacher = {
      programs: person.teacher.programs
        .filter((p) => p.isActive)
        .map((p) => p.program),
    }
  }

  if (person.guardianRelationships.length > 0) {
    roles.push('Parent')

    const childProfiles = person.guardianRelationships.flatMap(
      (gr) => gr.dependent.programProfiles
    )

    const programBreakdown = childProfiles.reduce(
      (acc, p) => {
        const existing = acc.find((item) => item.program === p.program)
        if (existing) {
          existing.count++
        } else {
          acc.push({ program: p.program, count: 1 })
        }
        return acc
      },
      [] as Array<{ program: Program; count: number }>
    )

    roleDetails.parent = {
      childCount: person.guardianRelationships.length,
      programBreakdown,
    }
  }

  if (person.programProfiles.length > 0) {
    const programs = person.programProfiles.map((p) => {
      const label = PROGRAM_LABELS[p.program] || 'Unknown'
      return p.program === 'YOUTH_EVENTS' ? label : `${label} Student`
    })
    roles.push(...programs)

    roleDetails.student = {
      programs: person.programProfiles.map((p) => ({
        program: p.program,
        status: (p.enrollments[0]?.status || 'REGISTERED') as EnrollmentStatus,
      })),
    }
  }

  return {
    id: person.id,
    name: person.name,
    email,
    phone,
    isTeacher: !!person.teacher,
    teacherId: person.teacher?.id ?? null,
    roles: roles.length > 0 ? roles : ['No roles assigned'],
    roleDetails,
  }
}
