import { z } from 'zod'

export const TeacherLoginSchema = z.object({
  lastFour: z.string().regex(/^\d{4}$/, 'Must be exactly 4 digits'),
  redirectTo: z
    .string()
    .startsWith('/teacher')
    .optional()
    .default('/teacher/attendance'),
})

export type TeacherLoginInput = z.infer<typeof TeacherLoginSchema>
