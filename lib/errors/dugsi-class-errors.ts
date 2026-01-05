/**
 * Custom error classes for Dugsi class operations.
 * Used for type-safe error handling in actions.
 */

export class TeacherNotAuthorizedError extends Error {
  constructor() {
    super('Teacher not authorized for Dugsi program')
    this.name = 'TeacherNotAuthorizedError'
  }
}

export class ClassNotFoundError extends Error {
  constructor() {
    super('Class not found or inactive')
    this.name = 'ClassNotFoundError'
  }
}
