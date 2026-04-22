import { z } from 'zod'

import { nameSchema } from '@/lib/registration/schemas/registration-field-schemas'

export const mahadStudentLookupSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  phoneLast4: z
    .string()
    .regex(/^\d{4}$/, 'Enter exactly 4 digits (last 4 of your phone number)'),
})

export type MahadStudentLookupValues = z.infer<typeof mahadStudentLookupSchema>
