import { BatchRepository } from '../_repositories/batch.repository'
import {
  Batch,
  BatchWithCount,
  CreateBatchDto,
  UpdateBatchDto,
  BatchAssignment,
  BatchTransfer,
  BatchAssignmentResult,
  ActionResult,
  NotFoundError,
  ValidationError,
} from '../_types'
import {
  CreateBatchSchema,
  UpdateBatchSchema,
  BatchAssignmentSchema,
  BatchTransferSchema,
} from '../_validators/schemas'

export class BatchService {
  constructor(private batchRepository: BatchRepository) {}

  async getAllBatches(): Promise<ActionResult<BatchWithCount[]>> {
    try {
      const batches = await this.batchRepository.findAllWithCount()
      return {
        success: true,
        data: batches,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to fetch batches',
      }
    }
  }

  async getBatchById(id: string): Promise<ActionResult<Batch>> {
    try {
      const batch = await this.batchRepository.findById(id)
      if (!batch) {
        throw new NotFoundError('Batch', id)
      }
      return {
        success: true,
        data: batch,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch batch',
      }
    }
  }

  async createBatch(input: CreateBatchDto): Promise<ActionResult<Batch>> {
    try {
      // Validate input
      const validatedInput = CreateBatchSchema.parse(input)

      // Check if batch with same name already exists
      const existingBatch = await this.batchRepository.findByName(
        validatedInput.name
      )
      if (existingBatch) {
        throw new ValidationError(
          'A batch with this name already exists',
          'name'
        )
      }

      const batch = await this.batchRepository.create({
        name: validatedInput.name,
        startDate: validatedInput.startDate || null,
      })

      return {
        success: true,
        data: batch,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create batch',
      }
    }
  }

  async updateBatch(
    id: string,
    input: UpdateBatchDto
  ): Promise<ActionResult<Batch>> {
    try {
      // Validate input
      const validatedInput = UpdateBatchSchema.parse(input)

      // Check if batch exists
      const existingBatch = await this.batchRepository.findById(id)
      if (!existingBatch) {
        throw new NotFoundError('Batch', id)
      }

      // Check if name is being changed and conflicts with another batch
      if (validatedInput.name && validatedInput.name !== existingBatch.name) {
        const conflictingBatch = await this.batchRepository.findByName(
          validatedInput.name
        )
        if (conflictingBatch && conflictingBatch.id !== id) {
          throw new ValidationError(
            'A batch with this name already exists',
            'name'
          )
        }
      }

      const updatedBatch = await this.batchRepository.update(id, validatedInput)

      return {
        success: true,
        data: updatedBatch,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update batch',
      }
    }
  }

  async deleteBatch(id: string): Promise<ActionResult<void>> {
    try {
      // Check if batch exists
      const batch = await this.batchRepository.findById(id)
      if (!batch) {
        throw new NotFoundError('Batch', id)
      }

      // Check if batch has students
      const studentCount = await this.batchRepository.getStudentCount(id)
      if (studentCount > 0) {
        throw new ValidationError(
          `Cannot delete batch with ${studentCount} assigned students. Please reassign or remove students first.`,
          'students'
        )
      }

      await this.batchRepository.delete(id)

      return {
        success: true,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete batch',
      }
    }
  }

  async assignStudents(
    assignment: BatchAssignment
  ): Promise<ActionResult<BatchAssignmentResult>> {
    try {
      // Validate input
      const validatedInput = BatchAssignmentSchema.parse(assignment)

      // Check if batch exists
      const batch = await this.batchRepository.findById(validatedInput.batchId)
      if (!batch) {
        throw new NotFoundError('Batch', validatedInput.batchId)
      }

      // Perform assignment
      const result = await this.batchRepository.assignStudents(
        validatedInput.batchId,
        validatedInput.studentIds
      )

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to assign students',
      }
    }
  }

  async transferStudents(
    transfer: BatchTransfer
  ): Promise<ActionResult<BatchAssignmentResult>> {
    try {
      // Validate input
      const validatedInput = BatchTransferSchema.parse(transfer)

      // Check if both batches exist
      const [fromBatch, toBatch] = await Promise.all([
        this.batchRepository.findById(validatedInput.fromBatchId),
        this.batchRepository.findById(validatedInput.toBatchId),
      ])

      if (!fromBatch) {
        throw new NotFoundError('Source batch', validatedInput.fromBatchId)
      }
      if (!toBatch) {
        throw new NotFoundError('Destination batch', validatedInput.toBatchId)
      }

      // Perform transfer
      const result = await this.batchRepository.transferStudents(
        validatedInput.fromBatchId,
        validatedInput.toBatchId,
        validatedInput.studentIds
      )

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to transfer students',
      }
    }
  }

  async getBatchStudents(batchId: string): Promise<ActionResult<any[]>> {
    try {
      // Check if batch exists
      const batch = await this.batchRepository.findById(batchId)
      if (!batch) {
        throw new NotFoundError('Batch', batchId)
      }

      const students = await this.batchRepository.getBatchStudents(batchId)

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
            : 'Failed to fetch batch students',
      }
    }
  }

  async getBatchSummary() {
    try {
      const summary = await this.batchRepository.getBatchSummary()
      return {
        success: true,
        data: summary,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch batch summary',
      }
    }
  }
}
