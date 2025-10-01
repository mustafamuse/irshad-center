import { StudentRepository } from '../_repositories/student.repository'
import {
  Student,
  BatchStudentData,
  CreateStudentDto,
  UpdateStudentDto,
  StudentFilters,
  StudentSearchResult,
  DuplicateGroup,
  StudentStatus,
  ActionResult,
  NotFoundError,
  ValidationError,
} from '../_types'
import {
  CreateStudentSchema,
  UpdateStudentSchema,
  SearchSchema,
} from '../_validators/schemas'

export class StudentService {
  constructor(private studentRepository: StudentRepository) {}

  async getAllStudents(): Promise<ActionResult<BatchStudentData[]>> {
    try {
      const students = await this.studentRepository.findAllWithBatch()
      return {
        success: true,
        data: students,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to fetch students',
      }
    }
  }

  async getStudentById(id: string): Promise<ActionResult<Student>> {
    try {
      const student = await this.studentRepository.findById(id)
      if (!student) {
        throw new NotFoundError('Student', id)
      }
      return {
        success: true,
        data: student,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to fetch student',
      }
    }
  }

  async searchStudents(
    query: string,
    filters?: StudentFilters,
    page: number = 1,
    pageSize: number = 20
  ): Promise<ActionResult<StudentSearchResult>> {
    try {
      // Validate input
      const validatedSearch = SearchSchema.parse({
        query,
        filters,
        pagination: { page, pageSize },
      })

      const startTime = performance.now()
      const result = await this.studentRepository.search(
        validatedSearch.query,
        validatedSearch.filters,
        validatedSearch.pagination
      )
      const searchTime = performance.now() - startTime

      return {
        success: true,
        data: {
          students: result.students,
          totalResults: result.totalResults,
          searchTime,
        },
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to search students',
      }
    }
  }

  async getStudentsByBatch(
    batchId: string
  ): Promise<ActionResult<BatchStudentData[]>> {
    try {
      const students = await this.studentRepository.findByBatch(batchId)
      return {
        success: true,
        data: students,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch students by batch',
      }
    }
  }

  async getUnassignedStudents(): Promise<ActionResult<BatchStudentData[]>> {
    try {
      const students = await this.studentRepository.findUnassigned()
      return {
        success: true,
        data: students,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch unassigned students',
      }
    }
  }

  async createStudent(input: CreateStudentDto): Promise<ActionResult<Student>> {
    try {
      // Validate input
      const validatedInput = CreateStudentSchema.parse(input)

      // Check for duplicate email if provided
      if (validatedInput.email) {
        const existingStudent = await this.studentRepository.findByEmail(
          validatedInput.email
        )
        if (existingStudent) {
          throw new ValidationError(
            'A student with this email already exists',
            'email'
          )
        }
      }

      const student = await this.studentRepository.create(validatedInput)

      return {
        success: true,
        data: student,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create student',
      }
    }
  }

  async updateStudent(
    id: string,
    input: UpdateStudentDto
  ): Promise<ActionResult<Student>> {
    try {
      // Validate input
      const validatedInput = UpdateStudentSchema.parse(input)

      // Check if student exists
      const existingStudent = await this.studentRepository.findById(id)
      if (!existingStudent) {
        throw new NotFoundError('Student', id)
      }

      // Check for duplicate email if being changed
      if (
        validatedInput.email &&
        validatedInput.email !== existingStudent.email
      ) {
        const conflictingStudent = await this.studentRepository.findByEmail(
          validatedInput.email
        )
        if (conflictingStudent && conflictingStudent.id !== id) {
          throw new ValidationError(
            'A student with this email already exists',
            'email'
          )
        }
      }

      const updatedStudent = await this.studentRepository.update(
        id,
        validatedInput
      )

      return {
        success: true,
        data: updatedStudent,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update student',
      }
    }
  }

  async deleteStudent(id: string): Promise<ActionResult<void>> {
    try {
      // Check if student exists
      const student = await this.studentRepository.findById(id)
      if (!student) {
        throw new NotFoundError('Student', id)
      }

      // Check for dependencies (siblings, etc.)
      const warnings = await this.studentRepository.getDeleteWarnings(id)
      if (warnings.hasSiblings || warnings.hasPayments) {
        throw new ValidationError(
          'Cannot delete student with active dependencies. Please resolve first.',
          'dependencies'
        )
      }

      await this.studentRepository.delete(id)

      return {
        success: true,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete student',
      }
    }
  }

  async updateStudentStatus(
    id: string,
    status: StudentStatus
  ): Promise<ActionResult<Student>> {
    try {
      // Check if student exists
      const student = await this.studentRepository.findById(id)
      if (!student) {
        throw new NotFoundError('Student', id)
      }

      const updatedStudent = await this.studentRepository.update(id, { status })

      return {
        success: true,
        data: updatedStudent,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update student status',
      }
    }
  }

  async getDuplicateStudents(): Promise<ActionResult<DuplicateGroup[]>> {
    try {
      const duplicates = await this.studentRepository.findDuplicates()
      return {
        success: true,
        data: duplicates,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch duplicate students',
      }
    }
  }

  async resolveDuplicates(
    keepId: string,
    deleteIds: string[],
    mergeData: boolean = false
  ): Promise<ActionResult<void>> {
    try {
      // Validate that all IDs exist
      const students = await Promise.all([
        this.studentRepository.findById(keepId),
        ...deleteIds.map((id) => this.studentRepository.findById(id)),
      ])

      const allExist = students.every((student) => student !== null)
      if (!allExist) {
        throw new ValidationError('One or more student IDs are invalid')
      }

      await this.studentRepository.resolveDuplicates(
        keepId,
        deleteIds,
        mergeData
      )

      return {
        success: true,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to resolve duplicates',
      }
    }
  }

  async getStudentCompleteness(id: string) {
    try {
      const student = await this.studentRepository.findById(id)
      if (!student) {
        throw new NotFoundError('Student', id)
      }

      const completeness = await this.studentRepository.getCompleteness(id)

      return {
        success: true,
        data: completeness,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get student completeness',
      }
    }
  }

  async bulkUpdateStatus(
    studentIds: string[],
    status: StudentStatus
  ): Promise<ActionResult<number>> {
    try {
      const updatedCount = await this.studentRepository.bulkUpdateStatus(
        studentIds,
        status
      )

      return {
        success: true,
        data: updatedCount,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to bulk update student status',
      }
    }
  }

  async exportStudents(
    format: 'csv' | 'xlsx' | 'json',
    filters?: StudentFilters,
    fields?: string[]
  ) {
    try {
      const result = await this.studentRepository.export(
        format,
        filters,
        fields
      )

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to export students',
      }
    }
  }
}
