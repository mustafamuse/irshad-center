import { Prisma } from '@prisma/client'

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
  DUPLICATE_CONTACT: 'DUPLICATE_CONTACT',
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
  ALREADY_LINKED: 'ALREADY_LINKED',
  INVALID_INPUT: 'INVALID_INPUT',
  STRIPE_ERROR: 'STRIPE_ERROR',
  NO_ACTIVE_SUBSCRIPTION: 'NO_ACTIVE_SUBSCRIPTION',
  ACTIVE_SUBSCRIPTION: 'ACTIVE_SUBSCRIPTION',
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
 * Rethrow P2002 unique-constraint violations as ActionError with DUPLICATE_CONTACT code.
 * If the error is not P2002, it is rethrown unchanged.
 */
export function throwIfP2002(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const target = error.meta?.target as string[] | undefined
    const field = target?.includes('email')
      ? 'email'
      : target?.includes('phone')
        ? 'phone'
        : 'email or phone'
    throw new ActionError(
      `This ${field} is already associated with another person`,
      ERROR_CODES.DUPLICATE_CONTACT,
      field,
      409
    )
  }
  throw error
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
