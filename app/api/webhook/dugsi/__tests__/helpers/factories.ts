/**
 * Factory functions for creating test data
 */

import { createFullProgramProfile } from './factories-internal'
import type { TestProgramProfile, TestGuardianRelationship } from './types'

export { createFullProgramProfile }

/**
 * Create a mock program profile for tests
 */
export function createMockProgramProfile(
  overrides: {
    id?: string
    personId?: string
    program?: string
    familyReferenceId?: string | null
    status?: string
    monthlyRate?: number
  } = {}
): TestProgramProfile {
  const id = overrides.id || 'profile_1'
  const personId = overrides.personId || 'person_1'
  return {
    id,
    personId,
    program: overrides.program || 'DUGSI_PROGRAM',
    familyReferenceId: overrides.familyReferenceId ?? 'dugsi_family_123',
    person: {
      id: personId,
      name: `Child ${id.split('_')[1] || '1'}`,
    },
    ...(overrides.status && { status: overrides.status }),
    ...(overrides.monthlyRate !== undefined && {
      monthlyRate: overrides.monthlyRate,
    }),
  }
}

/**
 * Create multiple mock program profiles
 */
export function createMockProgramProfiles(
  count: number,
  baseOverrides: {
    familyReferenceId?: string
    program?: string
  } = {}
): TestProgramProfile[] {
  return Array.from({ length: count }, (_, i) =>
    createMockProgramProfile({
      id: `profile_${i + 1}`,
      personId: `person_${i + 1}`,
      familyReferenceId: baseOverrides.familyReferenceId || 'dugsi_family_123',
      program: baseOverrides.program || 'DUGSI_PROGRAM',
    })
  )
}

/**
 * Create a mock guardian relationship
 */
export function createMockGuardianRelationship(
  overrides: {
    guardianId?: string
    dependentId?: string
    dependent?: {
      id: string
      name: string
      programProfiles?: unknown[]
    }
  } = {}
): TestGuardianRelationship {
  const guardianId = overrides.guardianId || 'guardian_person_1'
  const dependentId = overrides.dependentId || 'person_1'
  const now = new Date()

  return {
    id: 'guardian_rel_1',
    guardianId,
    dependentId,
    role: 'PARENT',
    isActive: true,
    startDate: now,
    endDate: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    guardian: {
      id: guardianId,
      name: 'Parent Guardian',
      dateOfBirth: null,
      createdAt: now,
      updatedAt: now,
      contactPoints: [
        {
          id: 'contact_1',
          personId: guardianId,
          type: 'EMAIL',
          value: 'parent@example.com',
          isPrimary: true,
          verificationStatus: 'UNVERIFIED',
          verifiedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
    ...(overrides.dependent && {
      dependent: {
        id: dependentId,
        name: overrides.dependent.name || 'Child 1',
        dateOfBirth: null,
        createdAt: now,
        updatedAt: now,
        programProfiles: overrides.dependent.programProfiles || [
          createFullProgramProfile({
            id: `profile_${dependentId.split('_')[1] || '1'}`,
            personId: dependentId,
          }),
        ],
      },
    }),
  } as unknown as TestGuardianRelationship
}
