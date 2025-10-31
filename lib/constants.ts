// Admin Configuration
// Admin password should be loaded from environment variables for security
// Do not hardcode passwords in the codebase
export function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD
  if (!password) {
    throw new Error(
      'ADMIN_PASSWORD environment variable is not set. Please configure it in your environment.'
    )
  }
  return password
}

// Other constants can be added here
export const APP_NAME = 'Mahad AutoPay App'
export const CURRENCY = 'USD'

/**
 * Student status constants
 * Used for tracking student enrollment and payment status
 */
export const STUDENT_STATUS = {
  ENROLLED: 'enrolled',
  WITHDRAWN: 'withdrawn',
  REGISTERED: 'registered',
} as const

export type StudentStatus = (typeof STUDENT_STATUS)[keyof typeof STUDENT_STATUS]
