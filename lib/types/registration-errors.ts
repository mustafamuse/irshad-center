/**
 * Unified Registration Error Types
 *
 * This file defines all error types that can occur during the Mahad registration process.
 * Using discriminated unions enables type-safe error handling throughout the application.
 */

import { Program } from '@prisma/client'

/**
 * Contact field that caused a duplicate error
 */
export type DuplicateField = 'email' | 'phone' | 'both'

/**
 * Existing person data for duplicate registration dialog
 */
export interface ExistingPersonData {
  name: string
  email: string
  phone?: string
  registeredDate: string
  enrollmentStatus: string
  program: string
}

/**
 * Form field names that can have validation errors
 */
export type ValidationField =
  | 'email'
  | 'phone'
  | 'firstName'
  | 'lastName'
  | 'dateOfBirth'
  | 'gender'
  | 'educationLevel'
  | 'gradeLevel'
  | 'schoolName'
  | 'healthInfo'

/**
 * Duplicate registration error - occurs when a person is already registered for a program
 */
export interface DuplicateRegistrationError {
  type: 'DUPLICATE_REGISTRATION'
  field: DuplicateField
  message: string
  existingPersonId: string
  program: Program
  existingPerson?: ExistingPersonData
}

/**
 * Validation error - occurs when input data is invalid or incomplete
 */
export interface ValidationError {
  type: 'VALIDATION_ERROR'
  field: ValidationField
  message: string
  details?: string
}

/**
 * System error - occurs when there's a database, network, or infrastructure failure
 */
export interface SystemError {
  type: 'SYSTEM_ERROR'
  message: string
  code?: string
  details?: unknown
}

/**
 * Partial success error - occurs when main operation succeeds but related operations fail
 * Example: Student registered successfully but sibling relationships failed
 */
export interface PartialSuccessError {
  type: 'PARTIAL_SUCCESS'
  message: string
  succeeded: Array<{
    operation: string
    entityId: string
  }>
  failed: Array<{
    operation: string
    error: string
  }>
}

/**
 * Union type of all possible registration errors
 */
export type RegistrationError =
  | DuplicateRegistrationError
  | ValidationError
  | SystemError
  | PartialSuccessError

/**
 * Registration operation result - either success or error
 */
export type RegistrationResult<T = void> =
  | {
      success: true
      data: T
    }
  | {
      success: false
      error: RegistrationError
    }

/**
 * Format program name for display in error messages
 * Converts "MAHAD_PROGRAM" → "Mahad", "DUGSI_PROGRAM" → "Dugsi"
 */
function formatProgramName(program: Program): string {
  const name = program.replace('_PROGRAM', '')
  return name.charAt(0) + name.slice(1).toLowerCase()
}

/**
 * Helper function to create a duplicate registration error
 */
export function createDuplicateError(params: {
  field: DuplicateField
  existingPersonId: string
  program: Program
  existingPerson?: ExistingPersonData
}): DuplicateRegistrationError {
  const fieldText =
    params.field === 'both'
      ? 'email address and phone number are'
      : params.field === 'email'
        ? 'email address is'
        : 'phone number is'

  const programName = formatProgramName(params.program)

  return {
    type: 'DUPLICATE_REGISTRATION',
    field: params.field,
    message: `This ${fieldText} already registered for the ${programName} program`,
    existingPersonId: params.existingPersonId,
    program: params.program,
    existingPerson: params.existingPerson,
  }
}

/**
 * Helper function to create a validation error
 */
export function createValidationError(
  field: ValidationField,
  message: string,
  details?: string
): RegistrationError {
  return {
    type: 'VALIDATION_ERROR',
    field,
    message,
    details,
  }
}

/**
 * Helper function to create a system error
 */
export function createSystemError(
  message: string,
  code?: string,
  details?: unknown
): RegistrationError {
  return {
    type: 'SYSTEM_ERROR',
    message,
    code,
    details,
  }
}

/**
 * Helper function to create a partial success error
 */
export function createPartialSuccessError(
  message: string,
  succeeded: Array<{ operation: string; entityId: string }>,
  failed: Array<{ operation: string; error: string }>
): RegistrationError {
  return {
    type: 'PARTIAL_SUCCESS',
    message,
    succeeded,
    failed,
  }
}

/**
 * Type guard to check if an error is a duplicate registration error
 */
export function isDuplicateError(
  error: RegistrationError
): error is DuplicateRegistrationError {
  return error.type === 'DUPLICATE_REGISTRATION'
}

/**
 * Type guard to check if an error is a validation error
 */
export function isValidationError(
  error: RegistrationError
): error is ValidationError {
  return error.type === 'VALIDATION_ERROR'
}

/**
 * Type guard to check if an error is a system error
 */
export function isSystemError(error: RegistrationError): error is SystemError {
  return error.type === 'SYSTEM_ERROR'
}

/**
 * Type guard to check if an error is a partial success error
 */
export function isPartialSuccessError(
  error: RegistrationError
): error is PartialSuccessError {
  return error.type === 'PARTIAL_SUCCESS'
}
