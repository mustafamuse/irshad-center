import { z } from 'zod'

import { emailSchema } from '@/lib/registration/schemas/registration-field-schemas'

export const mahadLookupByEmailSchema = z.object({
  email: emailSchema.transform((s) => s.toLowerCase()),
})

export type MahadLookupByEmailValues = z.infer<typeof mahadLookupByEmailSchema>
