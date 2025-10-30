// Admin Configuration
export const ADMIN_PASSWORD = 'nomorewareerorstress'

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
