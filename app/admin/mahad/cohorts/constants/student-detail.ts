/**
 * Constants for student detail functionality
 */

/**
 * Student detail view modes
 */
export const STUDENT_DETAIL_MODE = {
  VIEW: 'view',
  EDIT: 'edit',
} as const

export type StudentDetailMode =
  (typeof STUDENT_DETAIL_MODE)[keyof typeof STUDENT_DETAIL_MODE]

/**
 * Check if a string is a valid student detail mode
 */
export function isValidMode(
  mode: string | undefined | null
): mode is StudentDetailMode {
  return mode === STUDENT_DETAIL_MODE.VIEW || mode === STUDENT_DETAIL_MODE.EDIT
}

/**
 * Get the default mode or validate and return the provided mode
 */
export function getValidMode(
  mode: string | undefined | null
): StudentDetailMode {
  return isValidMode(mode) ? mode : STUDENT_DETAIL_MODE.VIEW
}

/**
 * Routes for student detail pages
 */
export const STUDENT_ROUTES = {
  LIST: '/admin/mahad/cohorts',
  DETAIL: (id: string) => `/admin/mahad/cohorts/students/${id}` as const,
  DETAIL_EDIT: (id: string) =>
    `/admin/mahad/cohorts/students/${id}?mode=edit` as const,
} as const

/**
 * Aria labels for accessibility
 */
export const ARIA_LABELS = {
  SELECT_STUDENT: (name: string) => `Select ${name}`,
  VIEW_DETAILS: (name: string) => `View details for ${name}`,
  STUDENT_DETAILS_FORM: 'Student details form',
  STUDENT_DETAIL_TITLE: 'student-detail-title',
  STUDENT_DETAIL_DESCRIPTION: 'student-detail-description',
} as const
