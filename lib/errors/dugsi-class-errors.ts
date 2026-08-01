import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'

export class TeacherNotAuthorizedError extends ActionError {
  constructor() {
    super(
      'Teacher not authorized for Dugsi program',
      ERROR_CODES.UNAUTHORIZED,
      undefined,
      403
    )
    this.name = 'TeacherNotAuthorizedError'
  }
}

export class ClassNotFoundError extends ActionError {
  constructor() {
    super('Class not found or inactive', ERROR_CODES.NOT_FOUND, undefined, 404)
    this.name = 'ClassNotFoundError'
  }
}
