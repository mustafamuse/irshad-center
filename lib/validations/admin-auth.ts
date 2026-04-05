import { z } from 'zod'

export const adminPinSchema = z.object({
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/, 'PIN must be 4 digits'),
  redirectTo: z
    .string()
    .startsWith('/admin')
    .refine(
      (v) => !v.includes('..') && !v.includes('%2e') && !v.includes('%2E'),
      'Invalid redirect path'
    )
    .optional()
    .default('/admin'),
})

export type AdminPinInput = z.infer<typeof adminPinSchema>
