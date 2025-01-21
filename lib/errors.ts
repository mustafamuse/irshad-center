import { Prisma } from '@prisma/client'
import { Stripe } from 'stripe'

// Base Error class for all application errors
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// Specific error types
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400)
    this.name = 'ValidationError'
  }
}

export class DuplicateError extends AppError {
  constructor(message: string) {
    super(message, 'DUPLICATE_ERROR', 409)
    this.name = 'DuplicateError'
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(message, 'DATABASE_ERROR', 500)
    this.name = 'DatabaseError'
  }
}

export class StripeError extends AppError {
  constructor(message: string, statusCode: number = 500) {
    super(message, 'STRIPE_ERROR', statusCode)
    this.name = 'StripeError'
  }
}

// Error handlers
export function handlePrismaError(
  error: Prisma.PrismaClientKnownRequestError
): AppError {
  switch (error.code) {
    case 'P2002':
      return new DuplicateError('A record with this information already exists')
    case 'P2003':
      return new ValidationError('Invalid reference to related data')
    case 'P2025':
      return new ValidationError('Record not found')
    default:
      console.error('Database error:', error)
      return new DatabaseError('An unexpected database error occurred')
  }
}

export function handleStripeError(error: Stripe.errors.StripeError): AppError {
  switch (error.type) {
    case 'StripeRateLimitError':
      return new StripeError('Too many requests, please try again later', 429)
    case 'StripeInvalidRequestError':
      return new StripeError('Invalid payment information provided', 400)
    case 'StripeAuthenticationError':
      return new StripeError('Payment authentication failed', 401)
    case 'StripeAPIError':
      return new StripeError('Payment service unavailable', 503)
    default:
      console.error('Stripe error:', error)
      return new StripeError('An unexpected payment error occurred')
  }
}

// Validation error creators
export const Errors = {
  invalidInput: (field: string) =>
    new ValidationError(`Invalid ${field} provided`),
  missingField: (field: string) => new ValidationError(`${field} is required`),
  duplicateEmail: () =>
    new DuplicateError('A user with this email already exists'),
  invalidClass: (studentName: string) =>
    new ValidationError(`Missing class assignment for student: ${studentName}`),
  invalidFamily: () =>
    new ValidationError('Family ID is required for family grouping'),
  stripeCustomer: () =>
    new StripeError('Unable to process customer information'),
  setupIntent: () => new StripeError('Failed to setup payment method'),
  enrollment: () =>
    new AppError('Failed to process enrollment', 'ENROLLMENT_ERROR', 500),
}
