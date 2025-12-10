import type { Shift } from '@prisma/client'

import type { Person, PersonWithRelations } from './person'
import type { ProgramProfile } from './program-profile'

/**
 * Teacher - Staff role linked to Person
 * A Person can be a teacher while also being a parent, payer, or student
 */
export interface Teacher {
  id: string
  personId: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Teacher with Person relation
 */
export interface TeacherWithPerson extends Teacher {
  person: Person
}

/**
 * Teacher with full Person relations (contact points, etc.)
 */
export interface TeacherWithPersonRelations extends Teacher {
  person: PersonWithRelations
}

/**
 * TeacherAssignment - Links teachers to Dugsi students with shift information
 * IMPORTANT: Currently Dugsi-only (programProfile.program must be DUGSI_PROGRAM)
 */
export interface TeacherAssignment {
  id: string
  teacherId: string
  programProfileId: string // Must be DUGSI_PROGRAM ProgramProfile
  shift: Shift | null
  startDate: Date
  endDate: Date | null
  isActive: boolean
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * TeacherAssignment with Teacher and ProgramProfile relations
 */
export interface TeacherAssignmentWithRelations extends TeacherAssignment {
  teacher: TeacherWithPerson
  programProfile: ProgramProfile
}

/**
 * TeacherAssignment with full relations (including Person)
 */
export interface TeacherAssignmentWithFullRelations extends TeacherAssignment {
  teacher: TeacherWithPersonRelations
  programProfile: ProgramProfile & {
    person: Person
  }
}

/**
 * Teacher with assignments
 */
export interface TeacherWithAssignments extends TeacherWithPerson {
  assignments: TeacherAssignment[]
}

/**
 * Teacher with assignments and full relations
 */
export interface TeacherWithFullAssignments extends TeacherWithPersonRelations {
  assignments: TeacherAssignmentWithFullRelations[]
}

/**
 * Validation: Check if ProgramProfile is Dugsi
 */
export function isDugsiProfile(programProfile: { program: string }): boolean {
  return programProfile.program === 'DUGSI_PROGRAM'
}

/**
 * Validation: Check if shift is valid
 */
export function isValidShift(shift: string): shift is Shift {
  return shift === 'MORNING' || shift === 'AFTERNOON'
}
