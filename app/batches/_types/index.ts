// Re-export all types for easy importing
export * from './batch.types'
export * from './student.types'
export * from './ui.types'

// Common utility types
export interface ApiResponse<T> {
  data: T
  success: boolean
  message?: string
  errors?: string[]
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    hasNext: boolean
    hasPrevious: boolean
  }
}

export interface SortConfig {
  field: string
  direction: 'asc' | 'desc'
}

export interface FilterConfig {
  [key: string]:
    | string
    | number
    | boolean
    | Date
    | null
    | undefined
    | string[]
    | number[]
}

export interface PaginationInput {
  page: number
  pageSize: number
}

// Error types
export class BatchError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'BatchError'
  }
}

export class ValidationError extends BatchError {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message, 'VALIDATION_ERROR', 400)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends BatchError {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} with id ${id} not found`
      : `${resource} not found`
    super(message, 'NOT_FOUND', 404)
    this.name = 'NotFoundError'
  }
}

// Action result types
export interface ActionResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  errors?: string[]
}

// Event types
export interface BatchEvent {
  type:
    | 'batch_created'
    | 'batch_updated'
    | 'batch_deleted'
    | 'students_assigned'
    | 'students_transferred'
  payload: Record<string, unknown>
  timestamp: Date
  userId?: string
}
