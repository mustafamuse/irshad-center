import { Program } from '@prisma/client'
import { describe, it, expect } from 'vitest'

import { mapPersonToSearchResult } from '../person-mapper'

describe('mapPersonToSearchResult', () => {
  it('should map teacher role', () => {
    const person = {
      id: 'person-1',
      name: 'John Doe',
      contactPoints: [
        {
          id: 'cp-1',
          personId: 'person-1',
          type: 'EMAIL' as const,
          value: 'john@example.com',
          isPrimary: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      teacher: {
        id: 'teacher-1',
        personId: 'person-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        programs: [
          {
            id: 'tp-1',
            teacherId: 'teacher-1',
            program: 'DUGSI_PROGRAM' as Program,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
      guardianRelationships: [],
      programProfiles: [],
    }

    const result = mapPersonToSearchResult(person)

    expect(result.isTeacher).toBe(true)
    expect(result.teacherId).toBe('teacher-1')
    expect(result.roles).toContain('Teacher')
    expect(result.roleDetails.teacher).toEqual({
      programs: ['DUGSI_PROGRAM'],
    })
  })

  it('should map student role', () => {
    const person = {
      id: 'person-1',
      name: 'Jane Doe',
      contactPoints: [],
      guardianRelationships: [],
      programProfiles: [
        {
          id: 'profile-1',
          personId: 'person-1',
          program: 'MAHAD_PROGRAM' as Program,
          levelGroup: null,
          shift: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          enrollments: [
            {
              status: 'ENROLLED',
            },
          ],
        },
      ],
    }

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
    const person = {
      id: 'person-1',
      name: 'Parent Name',
      contactPoints: [],
      programProfiles: [],
      guardianRelationships: [
        {
          id: 'gr-1',
          guardianId: 'person-1',
          dependentId: 'child-1',
          relationshipType: 'PARENT',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          dependent: {
            programProfiles: [
              { program: 'DUGSI_PROGRAM' as Program },
              { program: 'DUGSI_PROGRAM' as Program },
            ],
          },
        },
        {
          id: 'gr-2',
          guardianId: 'person-1',
          dependentId: 'child-2',
          relationshipType: 'PARENT',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          dependent: {
            programProfiles: [{ program: 'MAHAD_PROGRAM' as Program }],
          },
        },
      ],
    }

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
    const person = {
      id: 'person-1',
      name: 'Multi Role',
      contactPoints: [],
      teacher: {
        id: 'teacher-1',
        personId: 'person-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        programs: [
          {
            id: 'tp-1',
            teacherId: 'teacher-1',
            program: 'MAHAD_PROGRAM' as Program,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
      guardianRelationships: [
        {
          id: 'gr-1',
          guardianId: 'person-1',
          dependentId: 'child-1',
          relationshipType: 'PARENT',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          dependent: {
            programProfiles: [{ program: 'DUGSI_PROGRAM' as Program }],
          },
        },
      ],
      programProfiles: [],
    }

    const result = mapPersonToSearchResult(person)

    expect(result.roles).toContain('Teacher')
    expect(result.roles).toContain('Parent')
    expect(result.roleDetails.teacher).toBeDefined()
    expect(result.roleDetails.parent).toBeDefined()
  })

  it('should return "No roles assigned" when no roles', () => {
    const person = {
      id: 'person-1',
      name: 'No Roles',
      contactPoints: [],
      guardianRelationships: [],
      programProfiles: [],
    }

    const result = mapPersonToSearchResult(person)

    expect(result.roles).toEqual(['No roles assigned'])
    expect(result.isTeacher).toBe(false)
    expect(result.teacherId).toBeNull()
  })

  it('should filter inactive teacher programs', () => {
    const person = {
      id: 'person-1',
      name: 'Teacher',
      contactPoints: [],
      teacher: {
        id: 'teacher-1',
        personId: 'person-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        programs: [
          {
            id: 'tp-1',
            teacherId: 'teacher-1',
            program: 'DUGSI_PROGRAM' as Program,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'tp-2',
            teacherId: 'teacher-1',
            program: 'MAHAD_PROGRAM' as Program,
            isActive: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
      guardianRelationships: [],
      programProfiles: [],
    }

    const result = mapPersonToSearchResult(person)

    expect(result.roleDetails.teacher?.programs).toEqual(['DUGSI_PROGRAM'])
  })
})
