/**
 * Batch and Student Type Definitions
 *
 * Shared types for batch and student management, built on top of the unified
 * Person → ProgramProfile → Enrollment architecture.
 *
 * Migration Status: ✅ COMPLETE
 * - All types migrated from legacy Student model
 * - Uses ProgramProfile/Enrollment types
 * - Maintains backward compatibility for UI components
 */

import { ReactNode } from 'react'

import {
  Batch as PrismaBatch,
  EducationLevel,
  GradeLevel,
  Prisma,
  EnrollmentStatus,
  SubscriptionStatus,
} from '@prisma/client'
import { LucideIcon } from 'lucide-react'

import { StudentStatus as StudentStatusEnum } from './student'

// ============================================================================
// BATCH TYPES (Built on Prisma types)
// ============================================================================

// Use Prisma's generated type directly
export type Batch = PrismaBatch

// Batch with student count - simplified version returned from queries
export interface BatchWithCount {
  id: string
  name: string
  startDate: Date | null
  endDate: Date | null
  createdAt: Date
  updatedAt: Date
  studentCount: number
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
// STUDENT TYPES (Using ProgramProfile/Enrollment Model)
// ============================================================================

/**
 * Student with batch data - represents a ProgramProfile with enrollment info
 * This is the main type used in the admin interface for student lists
 */
export interface Student {
  id: string // ProgramProfile.id
  name: string // Person.name
  email?: string | null
  phone?: string | null
  dateOfBirth?: Date | null
  educationLevel?: EducationLevel | null
  gradeLevel?: GradeLevel | null
  schoolName?: string | null
  monthlyRate?: number | null
  customRate: boolean
  status: StudentStatusEnum // Mapped from EnrollmentStatus
  batchId?: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Student with batch relation
 */
export interface StudentWithBatch extends Student {
  batch?: {
    id: string
    name: string
    startDate: Date | null
    endDate: Date | null
  } | null
}

// Re-export StudentStatus enum from student.ts for convenience
export { StudentStatusEnum as StudentStatus }
export type { StudentStatusEnum }

/**
 * Student with batch and related data for UI (full data - used in lists)
 * Includes subscription and sibling information
 */
export interface BatchStudentData extends StudentWithBatch {
  subscription?: {
    id: string
    status: string
    stripeSubscriptionId: string | null
    amount: number
  } | null
  siblingCount?: number
}

/**
 * Student detail data - matches what getStudentById returns (subset of fields)
 * Used for detail views and forms
 */
export interface StudentDetailData extends BatchStudentData {
  enrollments?: Array<{
    id: string
    status: EnrollmentStatus
    startDate: Date
    endDate: Date | null
    batch?: {
      id: string
      name: string
    } | null
  }>
  payments?: Array<{
    id: string
    amount: number
    month: number
    year: number
    createdAt: Date
  }>
}

/**
 * Create/Update DTOs for students
 * Note: Students should be created through registration-service.ts
 */
export interface CreateStudentDto {
  name: string
  email?: string | null
  phone?: string | null
  dateOfBirth?: Date | null
  educationLevel?: EducationLevel | null
  gradeLevel?: GradeLevel | null
  schoolName?: string | null
  monthlyRate?: number
  customRate?: boolean
  batchId?: string | null
}

export interface UpdateStudentDto {
  name?: string
  email?: string | null
  phone?: string | null
  dateOfBirth?: Date | null
  educationLevel?: EducationLevel | null
  gradeLevel?: GradeLevel | null
  schoolName?: string | null
  status?: string
  monthlyRate?: number
  customRate?: boolean
  batchId?: string | null
}

// Legacy interface for backward compatibility (will be removed)
export interface LegacyStudentWithBatch {
  id: string
  name: string
  Batch: {
    id: string
    name: string
    startDate: Date | null
    endDate: Date | null
  } | null
}

/**
 * Sibling types using the SiblingRelationship model
 */
export interface StudentSibling {
  id: string // Person.id
  name: string
  programProfiles: Array<{
    id: string // ProgramProfile.id
    program: string
  }>
}

/**
 * Sibling group with students
 */
export interface SiblingGroupWithStudents {
  id: string // Composite key from relationship
  isActive: boolean
  detectionMethod: string | null
  confidence: number | null
  students: StudentSibling[]
}

// For backward compatibility
export type SiblingGroup = SiblingGroupWithStudents

/**
 * Duplicate detection types using ProgramProfile
 */
export interface DuplicateStudent {
  id: string // ProgramProfile.id
  name: string // Person.name
  email?: string | null
  phone?: string | null
  createdAt: Date
  updatedAt: Date
  status: StudentStatusEnum
  batch?: {
    id: string
    name: string
  } | null
}

export interface DuplicateGroup {
  phone: string // The duplicate phone number (previously email)
  email: string // For backward compatibility
  count: number
  profiles: DuplicateStudent[]
  keepRecord: DuplicateStudent // The recommended record to keep
  duplicateRecords: DuplicateStudent[] // Records to potentially remove
  hasSiblingGroup: boolean
  hasRecentActivity: boolean
  differences?: Record<string, Set<string>> | null
  lastUpdated: number
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
    selected?: StudentStatusEnum[]
  }
  subscriptionStatus?: {
    selected?: SubscriptionStatus[]
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
  initial?: Record<string, unknown>
  animate?: Record<string, unknown>
  exit?: Record<string, unknown>
  transition?: Record<string, unknown>
}
