/**
 * Internal factory functions (used by other helpers)
 */

/**
 * Create a full program profile with all fields (for Prisma mocks)
 */
export function createFullProgramProfile(
  overrides: {
    id?: string
    personId?: string
    program?: string
    status?: string
    familyReferenceId?: string | null
    monthlyRate?: number
  } = {}
) {
  const id = overrides.id || 'profile_1'
  const personId = overrides.personId || 'person_1'
  const now = new Date()
  return {
    id,
    personId,
    program: overrides.program || 'DUGSI_PROGRAM',
    status: overrides.status || 'REGISTERED',
    familyReferenceId: overrides.familyReferenceId || 'dugsi_family_123',
    monthlyRate: overrides.monthlyRate ?? 150,
    customRate: false,
    gender: null,
    educationLevel: null,
    gradeLevel: null,
    schoolName: null,
    highSchoolGradYear: null,
    highSchoolGraduated: null,
    collegeGradYear: null,
    collegeGraduated: null,
    postGradYear: null,
    postGradCompleted: null,
    createdAt: now,
    updatedAt: now,
    enrollments: [],
  }
}
