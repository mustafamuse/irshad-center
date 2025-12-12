import { ContactPoint, EnrollmentStatus, Program } from '@prisma/client'
import { describe, it, expect } from 'vitest'

import { mapPersonToSearchResult } from '../person-mapper'

function createContactPoint(
  overrides: Partial<ContactPoint> = {}
): ContactPoint {
  return {
    id: 'cp-1',
    personId: 'person-1',
    type: 'EMAIL',
    value: 'test@example.com',
    isPrimary: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    verificationStatus: 'UNVERIFIED',
    verifiedAt: null,
    deactivatedAt: null,
    ...overrides,
  }
}

function createTeacherProgram(program: Program, isActive = true) {
  return {
    id: `tp-${program}`,
    teacherId: 'teacher-1',
    program,
    shifts: [],
    isActive,
    shifts: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function createTeacher(programs: ReturnType<typeof createTeacherProgram>[]) {
  return {
    id: 'teacher-1',
    personId: 'person-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    programs,
  }
}

function createGuardianRelationship(
  dependentId: string,
  programProfiles: { program: Program }[]
) {
  return {
    id: `gr-${dependentId}`,
    guardianId: 'person-1',
    dependentId,
    role: 'PARENT' as const,
    isActive: true,
    isPrimaryPayer: false,
    startDate: new Date(),
    endDate: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    dependent: { programProfiles },
  }
}

function createProgramProfile(
  program: Program,
  enrollmentStatus: EnrollmentStatus = 'ENROLLED'
) {
  return {
    id: `profile-${program}`,
    personId: 'person-1',
    program,
    status: 'REGISTERED' as const,
    monthlyRate: 0,
    gender: null,
    gradeLevel: null,
    schoolName: null,
    graduationStatus: null,
    paymentFrequency: null,
    billingType: null,
    paymentNotes: null,
    healthInfo: null,
    familyReferenceId: null,
    shift: null,
    levelGroup: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    enrollments: [{ status: enrollmentStatus }],
  }
}

function createPerson(overrides: {
  id?: string
  name?: string
  contactPoints?: ContactPoint[]
  teacher?: ReturnType<typeof createTeacher> | null
  guardianRelationships?: ReturnType<typeof createGuardianRelationship>[]
  programProfiles?: ReturnType<typeof createProgramProfile>[]
}) {
  return {
    id: overrides.id ?? 'person-1',
    name: overrides.name ?? 'Test Person',
    createdAt: new Date(),
    updatedAt: new Date(),
    dateOfBirth: null,
    contactPoints: overrides.contactPoints ?? [],
    teacher: overrides.teacher ?? undefined,
    guardianRelationships: overrides.guardianRelationships ?? [],
    programProfiles: overrides.programProfiles ?? [],
  }
}

describe('mapPersonToSearchResult', () => {
  it('should map teacher role', () => {
    const person = createPerson({
      name: 'John Doe',
      contactPoints: [
        createContactPoint({
          value: 'john@example.com',
          isPrimary: true,
        }),
      ],
      teacher: createTeacher([createTeacherProgram(Program.DUGSI_PROGRAM)]),
    })

    const result = mapPersonToSearchResult(person)

    expect(result.isTeacher).toBe(true)
    expect(result.teacherId).toBe('teacher-1')
    expect(result.roles).toContain('Teacher')
    expect(result.roleDetails.teacher).toEqual({
      programs: ['DUGSI_PROGRAM'],
    })
  })

  it('should map student role', () => {
    const person = createPerson({
      name: 'Jane Doe',
      programProfiles: [createProgramProfile(Program.MAHAD_PROGRAM)],
    })

    const result = mapPersonToSearchResult(person)

    expect(result.roles).toContain('Mahad Student')
    expect(result.roleDetails.student).toEqual({
      programs: [
        {
          program: 'MAHAD_PROGRAM',
          status: 'ENROLLED',
        },
      ],
    })
  })

  it('should map parent role with program breakdown', () => {
    const person = createPerson({
      name: 'Parent Name',
      guardianRelationships: [
        createGuardianRelationship('child-1', [
          { program: Program.DUGSI_PROGRAM },
          { program: Program.DUGSI_PROGRAM },
        ]),
        createGuardianRelationship('child-2', [
          { program: Program.MAHAD_PROGRAM },
        ]),
      ],
    })

    const result = mapPersonToSearchResult(person)

    expect(result.roles).toContain('Parent')
    expect(result.roleDetails.parent).toEqual({
      childCount: 2,
      programBreakdown: [
        { program: 'DUGSI_PROGRAM', count: 2 },
        { program: 'MAHAD_PROGRAM', count: 1 },
      ],
    })
  })

  it('should map multiple roles', () => {
    const person = createPerson({
      name: 'Multi Role',
      teacher: createTeacher([createTeacherProgram(Program.MAHAD_PROGRAM)]),
      guardianRelationships: [
        createGuardianRelationship('child-1', [
          { program: Program.DUGSI_PROGRAM },
        ]),
      ],
    })

    const result = mapPersonToSearchResult(person)

    expect(result.roles).toContain('Teacher')
    expect(result.roles).toContain('Parent')
    expect(result.roleDetails.teacher).toBeDefined()
    expect(result.roleDetails.parent).toBeDefined()
  })

  it('should return "No roles assigned" when no roles', () => {
    const person = createPerson({ name: 'No Roles' })

    const result = mapPersonToSearchResult(person)

    expect(result.roles).toEqual(['No roles assigned'])
    expect(result.isTeacher).toBe(false)
    expect(result.teacherId).toBeNull()
  })

  it('should filter inactive teacher programs', () => {
    const person = createPerson({
      name: 'Teacher',
      teacher: createTeacher([
        createTeacherProgram(Program.DUGSI_PROGRAM, true),
        createTeacherProgram(Program.MAHAD_PROGRAM, false),
      ]),
    })

    const result = mapPersonToSearchResult(person)

    expect(result.roleDetails.teacher?.programs).toEqual(['DUGSI_PROGRAM'])
  })
})
