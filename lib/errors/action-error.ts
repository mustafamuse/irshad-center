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
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  NOT_FOUND: 'NOT_FOUND',
  SERVER_ERROR: 'SERVER_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED: 'UNAUTHORIZED',
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
