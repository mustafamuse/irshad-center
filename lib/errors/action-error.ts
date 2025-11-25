/**
 * Standard error class for Server Actions
 * Provides consistent error handling across all actions
 */
export class ActionError extends Error {
  constructor(
    message: string,
    public code?: string,
    public field?: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'ActionError'
  }

  toJSON() {
    return {
      success: false,
      error: this.message,
      code: this.code,
      field: this.field,
    }
  }
}

/**
 * Common error codes for consistency
 */
export const ERROR_CODES = {
  // General errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  NOT_FOUND: 'NOT_FOUND',
  SERVER_ERROR: 'SERVER_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  // Domain-specific errors
  STUDENT_NOT_FOUND: 'STUDENT_NOT_FOUND',
  PARENT_NOT_FOUND: 'PARENT_NOT_FOUND',
  FAMILY_NOT_FOUND: 'FAMILY_NOT_FOUND',
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  ENROLLMENT_NOT_FOUND: 'ENROLLMENT_NOT_FOUND',
  SUBSCRIPTION_NOT_FOUND: 'SUBSCRIPTION_NOT_FOUND',
  DUPLICATE_PARENT: 'DUPLICATE_PARENT',
  INVALID_INPUT: 'INVALID_INPUT',
  STRIPE_ERROR: 'STRIPE_ERROR',
} as const

/**
 * Helper to create validation error responses
 */
export function validationError(message: string, field?: string) {
  return new ActionError(message, ERROR_CODES.VALIDATION_ERROR, field)
}

/**
 * Helper to create server error responses
 */
export function serverError(message: string = 'An unexpected error occurred') {
  return new ActionError(message, ERROR_CODES.SERVER_ERROR, undefined, 500)
}

/**
 * Helper to create not found error responses
 */
export function notFoundError(
  entity: string,
  code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES] = ERROR_CODES.NOT_FOUND
) {
  return new ActionError(`${entity} not found`, code, undefined, 404)
}
