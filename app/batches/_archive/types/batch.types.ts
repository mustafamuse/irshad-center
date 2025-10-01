// Import types if needed in future
// import { EducationLevel, GradeLevel } from '@prisma/client'

export interface Batch {
  id: string
  name: string
  startDate: Date | null
  endDate: Date | null
  studentCount: number
  createdAt: Date
  updatedAt: Date
}

export interface BatchWithCount {
  id: string
  name: string
  startDate: string | null
  studentCount: number
}

export interface CreateBatchDto {
  name: string
  startDate?: Date
}

export interface UpdateBatchDto {
  name?: string
  startDate?: Date
  endDate?: Date
}

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
