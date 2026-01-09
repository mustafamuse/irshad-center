import { z } from 'zod'

export const adminPinSchema = z.object({
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/, 'PIN must be 4 digits'),
  redirectTo: z.string().startsWith('/admin').optional().default('/admin'),
})

export type AdminPinInput = z.infer<typeof adminPinSchema>
