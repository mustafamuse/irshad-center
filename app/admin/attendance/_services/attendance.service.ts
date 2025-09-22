/**
 * Service class for handling attendance-related API operations.
 * Implements the Singleton pattern to ensure a single instance across the application.
 *
 * @example
 * ```ts
 * const service = AttendanceService.getInstance()
 * await service.fetchStudents('batch-123')
 * ```
 */
import { z } from 'zod'
import {
  type AttendanceFilters,
  type AttendanceRecord,
  type AttendanceSession,
  type Student,
} from '../_types'
import {
  attendanceSessionResponseSchema,
  fetchHistoryFiltersSchema,
  markAttendanceRequestSchema,
} from '../_validators/schemas'
import { ApiClient, ApiError, ValidationError } from './api-client'

export class AttendanceService {
  private static instance: AttendanceService
  private apiClient: ApiClient

  private constructor() {
    this.apiClient = ApiClient.getInstance()
  }

  /**
   * Get singleton instance of AttendanceService
   * @returns {AttendanceService} The singleton instance
   */
  public static getInstance(): AttendanceService {
    if (!AttendanceService.instance) {
      AttendanceService.instance = new AttendanceService()
    }
    return AttendanceService.instance
  }

  /**
   * Fetch students for a specific batch with retry logic
   *
   * @param batchId - The ID of the batch to fetch students for
   * @returns Promise<Student[]> Array of students in the batch
   * @throws {ApiError} If the API request fails
   * @throws {ValidationError} If the response data is invalid
   *
   * @example
   * ```ts
   * const students = await service.fetchStudents('batch-123')
   * console.log(students.map(s => s.name))
   * ```
   */
  public async fetchStudents(batchId: string): Promise<Student[]> {
    return this.apiClient.retryWithBackoff(async () => {
      try {
        return await this.apiClient.get<Student[]>(
          `/api/batches/${batchId}/students`
        )
      } catch (error) {
        console.error('Error fetching students:', error)
        throw error instanceof ApiError
          ? error
          : new ApiError('Failed to fetch students')
      }
    })
  }

  /**
   * Mark attendance for multiple students
   *
   * @param date - The date of attendance
   * @param batchId - The batch ID
   * @param attendance - Array of attendance records
   * @throws {ValidationError} If the attendance data is invalid
   * @throws {ApiError} If the API request fails
   *
   * @example
   * ```ts
   * await service.markAttendance(
   *   new Date(),
   *   'batch-123',
   *   [{ studentId: 'student-1', status: 'present' }]
   * )
   * ```
   */
  public async markAttendance(
    date: Date,
    batchId: string,
    attendance: { studentId: string; status: string }[]
  ): Promise<void> {
    const payload = {
      date: date.toISOString(),
      batchId,
      attendance,
    }

    try {
      // Validate request payload
      markAttendanceRequestSchema.parse(payload)
      await this.apiClient.post('/api/admin/attendance/mark', payload)
    } catch (error) {
      console.error('Error marking attendance:', error)
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid attendance data format', error)
      }
      throw error instanceof ApiError
        ? error
        : new ApiError('Failed to mark attendance')
    }
  }

  /**
   * Fetch attendance history with optional filters
   *
   * @param filters - Optional filters for the history query
   * @returns Promise<AttendanceSession[]> Array of attendance sessions
   * @throws {ValidationError} If the filters are invalid
   * @throws {ApiError} If the API request fails
   *
   * @example
   * ```ts
   * const history = await service.fetchHistory({
   *   batchId: 'batch-123',
   *   startDate: new Date('2025-01-01'),
   *   endDate: new Date('2025-12-31')
   * })
   * ```
   */
  public async fetchHistory(
    filters?: AttendanceFilters
  ): Promise<AttendanceSession[]> {
    try {
      if (filters) {
        fetchHistoryFiltersSchema.parse({
          batchId: filters.batchId,
          startDate: filters.startDate?.toISOString(),
          endDate: filters.endDate?.toISOString(),
        })
      }

      const params = new URLSearchParams()
      if (filters?.batchId) params.append('batchId', filters.batchId)
      if (filters?.startDate)
        params.append('startDate', filters.startDate.toISOString())
      if (filters?.endDate)
        params.append('endDate', filters.endDate.toISOString())

      const data = await this.apiClient.get<AttendanceSession[]>(
        '/api/admin/attendance/history?' + params.toString(),
        {},
        z.array(attendanceSessionResponseSchema)
      )

      return data.map((session) => ({
        ...session,
        date: new Date(session.date),
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      }))
    } catch (error) {
      console.error('Error fetching attendance history:', error)
      if (error instanceof ValidationError) {
        throw error
      }
      throw error instanceof ApiError
        ? error
        : new ApiError('Failed to fetch attendance history')
    }
  }

  /**
   * Get attendance summary for a specific session
   *
   * @param sessionId - The ID of the session
   * @returns Promise<{ total: number, present: number, absent: number, late: number, excused: number }>
   * @throws {ApiError} If the API request fails
   *
   * @example
   * ```ts
   * const summary = await service.getSessionSummary('session-123')
   * console.log(`Present: ${summary.present}/${summary.total}`)
   * ```
   */
  public async getSessionSummary(sessionId: string) {
    return this.apiClient.retryWithBackoff(async () => {
      try {
        return await this.apiClient.get(
          `/api/admin/attendance/sessions/${sessionId}/summary`
        )
      } catch (error) {
        console.error('Error fetching session summary:', error)
        throw error instanceof ApiError
          ? error
          : new ApiError('Failed to fetch session summary')
      }
    })
  }

  /**
   * Update an attendance record
   *
   * @param recordId - The ID of the record to update
   * @param status - The new status
   * @param notes - Optional notes
   * @throws {ApiError} If the API request fails
   *
   * @example
   * ```ts
   * await service.updateAttendanceRecord(
   *   'record-123',
   *   'late',
   *   'Student arrived 10 minutes late'
   * )
   * ```
   */
  public async updateAttendanceRecord(
    recordId: string,
    status: string,
    notes?: string
  ): Promise<void> {
    try {
      await this.apiClient.patch(`/api/admin/attendance/records/${recordId}`, {
        status,
        notes,
      })
    } catch (error) {
      console.error('Error updating attendance record:', error)
      throw error instanceof ApiError
        ? error
        : new ApiError('Failed to update attendance record')
    }
  }

  /**
   * Delete an attendance session and all its records
   *
   * @param sessionId - The ID of the session to delete
   * @throws {ApiError} If the API request fails
   *
   * @example
   * ```ts
   * await service.deleteSession('session-123')
   * ```
   */
  public async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.apiClient.delete(`/api/admin/attendance/sessions/${sessionId}`)
    } catch (error) {
      console.error('Error deleting session:', error)
      throw error instanceof ApiError
        ? error
        : new ApiError('Failed to delete session')
    }
  }
}
