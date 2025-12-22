import { z } from 'zod'

export const AdminLoginSchema = z.object({
  password: z
    .string()
    .min(1, 'Password is required')
    .max(256, 'Password too long'),
})

export type AdminLoginInput = z.infer<typeof AdminLoginSchema>
