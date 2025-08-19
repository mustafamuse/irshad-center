import { EducationLevel, GradeLevel } from '@prisma/client'

export enum StudentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  GRADUATED = 'GRADUATED',
  SUSPENDED = 'SUSPENDED',
  TRANSFERRED = 'TRANSFERRED',
}

export interface Student {
  id: string
  name: string
  email: string | null
  phone: string | null
  dateOfBirth: Date | null
  educationLevel: EducationLevel | null
  gradeLevel: GradeLevel | null
  schoolName: string | null
  status: StudentStatus
  monthlyRate: number
  customRate: boolean
  batchId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface BatchStudentData {
  id: string
  name: string
  email: string | null
  phone: string | null
  dateOfBirth: string | null
  educationLevel: EducationLevel | null
  gradeLevel: GradeLevel | null
  schoolName: string | null
  status: string
  createdAt: string
  updatedAt: string
  batch: {
    id: string
    name: string
    startDate: string | null
    endDate: string | null
  } | null
  siblingGroup: {
    id: string
    students: {
      id: string
      name: string
      status: string
    }[]
  } | null
}

export interface StudentWithBatch extends Student {
  batch: {
    id: string
    name: string
    startDate: Date | null
    endDate: Date | null
  } | null
}

export interface StudentSibling {
  id: string
  name: string
  status: StudentStatus
}

export interface SiblingGroup {
  id: string
  students: StudentSibling[]
}

export interface CreateStudentDto {
  name: string
  email?: string
  phone?: string
  dateOfBirth?: Date
  educationLevel?: EducationLevel
  gradeLevel?: GradeLevel
  schoolName?: string
  monthlyRate?: number
  customRate?: boolean
  batchId?: string
}

export interface UpdateStudentDto {
  name?: string
  email?: string
  phone?: string
  dateOfBirth?: Date
  educationLevel?: EducationLevel
  gradeLevel?: GradeLevel
  schoolName?: string
  status?: StudentStatus
  monthlyRate?: number
  customRate?: boolean
  batchId?: string
}

// Duplicate detection types
export interface DuplicateStudent {
  id: string
  name: string
  email: string | null
  status: string
  createdAt: string
  updatedAt: string
  siblingGroup: {
    id: string
  } | null
}

export interface DuplicateGroup {
  email: string
  count: number
  keepRecord: DuplicateStudent
  duplicateRecords: DuplicateStudent[]
  hasSiblingGroup: boolean
  hasRecentActivity: boolean
  differences: {
    [field: string]: Set<string>
  } | null
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
