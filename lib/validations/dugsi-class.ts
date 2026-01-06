import { z } from 'zod'

export const AssignTeacherToClassSchema = z.object({
  classId: z.string().uuid('Invalid class ID'),
  teacherId: z.string().uuid('Invalid teacher ID'),
})

export const RemoveTeacherFromClassSchema = z.object({
  classId: z.string().uuid('Invalid class ID'),
  teacherId: z.string().uuid('Invalid teacher ID'),
})

export const EnrollStudentInClassSchema = z.object({
  classId: z.string().uuid('Invalid class ID'),
  programProfileId: z.string().uuid('Invalid student ID'),
})

export const RemoveStudentFromClassSchema = z.object({
  programProfileId: z.string().uuid('Invalid student ID'),
})

export const BulkEnrollStudentsSchema = z.object({
  classId: z.string().uuid('Invalid class ID'),
  programProfileIds: z
    .array(z.string().uuid('Invalid student ID'))
    .min(1, 'Select at least one student'),
})

export type AssignTeacherToClassInput = z.infer<
  typeof AssignTeacherToClassSchema
>
export type RemoveTeacherFromClassInput = z.infer<
  typeof RemoveTeacherFromClassSchema
>
export type EnrollStudentInClassInput = z.infer<
  typeof EnrollStudentInClassSchema
>
export type RemoveStudentFromClassInput = z.infer<
  typeof RemoveStudentFromClassSchema
>
export type BulkEnrollStudentsInput = z.infer<typeof BulkEnrollStudentsSchema>

export const CreateClassSchema = z.object({
  name: z.string().min(1, 'Class name is required').max(100),
  shift: z.enum(['MORNING', 'AFTERNOON']),
  description: z.string().max(500).optional(),
})

export const UpdateClassSchema = z.object({
  classId: z.string().uuid('Invalid class ID'),
  name: z.string().min(1, 'Class name is required').max(100),
  description: z.string().max(500).optional(),
})

export const DeleteClassSchema = z.object({
  classId: z.string().uuid('Invalid class ID'),
})

export type CreateClassInput = z.infer<typeof CreateClassSchema>
export type UpdateClassInput = z.infer<typeof UpdateClassSchema>
export type DeleteClassInput = z.infer<typeof DeleteClassSchema>
