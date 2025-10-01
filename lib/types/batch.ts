/**
 * Batch and Student Type Definitions
 *
 * Shared types for batch and student management.
 * These types are built on top of Prisma-generated types.
 */

import { ReactNode } from 'react'

import {
  Batch as PrismaBatch,
  Student as PrismaStudent,
  EducationLevel,
  GradeLevel,
  Prisma,
} from '@prisma/client'
import { LucideIcon } from 'lucide-react'

// ============================================================================
// BATCH TYPES (Built on Prisma types)
// ============================================================================

// Use Prisma's generated type directly
export type Batch = PrismaBatch

// Batch with student count (using Prisma's Select)
export type BatchWithCount = Prisma.BatchGetPayload<{
  select: {
    id: true
    name: true
    startDate: true
    _count: {
      select: { students: true }
    }
  }
}> & {
  studentCount: number // Computed from _count
}

// Simpler version for API responses
export interface BatchSummaryDto {
  id: string
  name: string
  startDate: string | null
  studentCount: number
}

// Create/Update DTOs use Prisma's input types
export type CreateBatchDto = Prisma.BatchCreateInput

export type UpdateBatchDto = Prisma.BatchUpdateInput

export interface BatchSummary {
  totalBatches: number
  totalStudents: number
  activeBatches: number
  averageStudentsPerBatch: number
}

export interface BatchFilters {
  search?: string
  hasStudents?: boolean
  dateRange?: {
    from: Date
    to: Date
  }
}

// Batch assignment types
export interface BatchAssignment {
  batchId: string
  studentIds: string[]
}

export interface BatchTransfer {
  fromBatchId: string
  toBatchId: string
  studentIds: string[]
}

export interface BatchAssignmentResult {
  success: boolean
  assignedCount: number
  failedAssignments?: string[]
  errors?: string[]
}

// ============================================================================
// STUDENT TYPES (Built on Prisma types)
// ============================================================================

// Use Prisma's generated type directly
export type Student = PrismaStudent

// Student with batch relation
export type StudentWithBatch = Prisma.StudentGetPayload<{
  include: {
    batch: true
  }
}>

// For backward compatibility with existing code using enum
export enum StudentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  GRADUATED = 'GRADUATED',
  SUSPENDED = 'SUSPENDED',
  TRANSFERRED = 'TRANSFERRED',
}

// Student with batch and related data for UI
export type BatchStudentData = Prisma.StudentGetPayload<{
  include: {
    batch: {
      select: {
        id: true
        name: true
        startDate: true
        endDate: true
      }
    }
    siblingGroup: {
      include: {
        students: {
          select: {
            id: true
            name: true
            status: true
          }
        }
      }
    }
  }
}>

// Create/Update DTOs use Prisma's input types
export type CreateStudentDto = Prisma.StudentCreateInput

export type UpdateStudentDto = Prisma.StudentUpdateInput

// Legacy interface for backward compatibility (will be removed)
export interface LegacyStudentWithBatch {
  id: string
  name: string
  batch: {
    id: string
    name: string
    startDate: Date | null
    endDate: Date | null
  } | null
}

// Sibling types (using Prisma Select for type safety)
export type StudentSibling = Prisma.StudentGetPayload<{
  select: {
    id: true
    name: true
    status: true
  }
}>

export type SiblingGroupWithStudents = Prisma.SiblingGetPayload<{
  include: {
    students: {
      select: {
        id: true
        name: true
        status: true
      }
    }
  }
}>

// For backward compatibility
export type SiblingGroup = SiblingGroupWithStudents

// Duplicate detection types (using Prisma Select)
export type DuplicateStudent = Prisma.StudentGetPayload<{
  select: {
    id: true
    name: true
    email: true
    status: true
    createdAt: true
    updatedAt: true
    siblingGroup: {
      select: {
        id: true
      }
    }
  }
}>

export interface DuplicateGroup {
  email: string
  count: number
  keepRecord: DuplicateStudent
  duplicateRecords: DuplicateStudent[]
  hasSiblingGroup: boolean
  hasRecentActivity: boolean
  differences: Record<string, Set<string>> | null
  lastUpdated: string
}

// Search and filtering types
export interface SearchMatch {
  field: 'name' | 'email' | 'phone'
  value: string
  highlightRanges: { start: number; end: number }[]
}

export interface EnhancedStudentData extends BatchStudentData {
  searchMatches?: SearchMatch[]
}

export interface StudentFilters {
  search?: {
    query?: string
    fields?: ('name' | 'email' | 'phone')[]
  }
  batch?: {
    selected?: string[]
    includeUnassigned?: boolean
  }
  status?: {
    selected?: StudentStatus[]
  }
  educationLevel?: {
    selected?: EducationLevel[]
  }
  gradeLevel?: {
    selected?: GradeLevel[]
  }
  dateRange?: {
    from?: Date | null
    to?: Date | null
    field?: 'createdAt' | 'updatedAt' | 'dateOfBirth'
  }
}

// Student validation and completeness
export interface StudentCompletenessCheck {
  isComplete: boolean
  missingFields: string[]
  completionPercentage: number
}

// Export types
export interface StudentExportData {
  name: string
  email: string
  phone: string
  batch: string
  status: string
  educationLevel: string
  gradeLevel: string
  completeness: string
}

// API response types
export interface StudentApiResponse {
  students: Student[]
  totalCount: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface StudentSearchResult {
  students: EnhancedStudentData[]
  totalResults: number
  searchTime: number
}

// ============================================================================
// COMMON UTILITY TYPES
// ============================================================================

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

// ============================================================================
// ERROR TYPES
// ============================================================================

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

// ============================================================================
// ACTION RESULT TYPES
// ============================================================================

export interface ActionResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  errors?: string[]
}

// ============================================================================
// EVENT TYPES
// ============================================================================

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

// ============================================================================
// UI TYPES
// ============================================================================

// Component prop types
export interface BaseComponentProps {
  className?: string
  children?: ReactNode
}

// Table and data display types
export interface TableColumn<T> {
  id: string
  header: string
  accessorKey?: keyof T
  cell?: (item: T) => ReactNode
  sortable?: boolean
  width?: string | number
}

export interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

// Filter UI types
export interface FilterOption {
  label: string
  value: string
  count?: number
  icon?: LucideIcon
}

export interface FilterGroup<T = string | string[] | Date | null> {
  id: string
  label: string
  type: 'single' | 'multiple' | 'range' | 'search'
  options?: FilterOption[]
  value?: T
  placeholder?: string
}

// Form types
export interface FormField {
  name: string
  label: string
  type: 'text' | 'email' | 'tel' | 'date' | 'select' | 'textarea' | 'number'
  placeholder?: string
  required?: boolean
  options?: Array<{ label: string; value: string }>
  validation?: {
    min?: number
    max?: number
    pattern?: string
    message?: string
  }
}

export interface FormErrors {
  [key: string]: string | undefined
}

// Dialog and modal types
export interface DialogProps extends BaseComponentProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
}

export interface ConfirmDialogProps extends DialogProps {
  onConfirm: () => void
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

// Loading and error states
export interface LoadingState {
  isLoading: boolean
  loadingText?: string
}

export interface ErrorState {
  hasError: boolean
  error?: Error | string
  retry?: () => void
}

// Toast and notification types
export interface ToastMessage {
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
  duration?: number
}

// Selection and interaction types
export interface SelectionState<T> {
  selectedItems: Set<T>
  isAllSelected: boolean
  isIndeterminate: boolean
  onSelectItem: (item: T) => void
  onSelectAll: () => void
  onClearSelection: () => void
}

// Virtual scrolling types
export interface VirtualListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  itemHeight: number
  containerHeight: number
  overscan?: number
}

// Theme and styling types
export interface ThemeVariant {
  primary: string
  secondary: string
  accent: string
  background: string
  foreground: string
  muted: string
  border: string
}

// Animation and transition types
export interface AnimationProps {
  initial?: any
  animate?: any
  exit?: any
  transition?: any
}
