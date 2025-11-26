'use server'

/**
 * Dugsi Registration Server Actions
 *
 * IMPORTANT: This registration flow needs migration to the new schema.
 * The Student model no longer exists.
 * TODO: Priority migration in PR 2e.
 */

import { z } from 'zod'

import { dugsiRegistrationSchema } from '@/lib/registration/schemas/registration'

// Type exports for clients
export type RegistrationResult = {
  success: boolean
  error?: string
  errors?: Record<string, string[]>
  redirectUrl?: string
  data?: {
    paymentUrl?: string
    familyId?: string
    children: { id: string; name: string }[]
    count: number
  }
}

export async function registerDugsiChildren(
  _formData: z.infer<typeof dugsiRegistrationSchema>
): Promise<RegistrationResult> {
  console.error(
    '[DUGSI_REGISTRATION] Registration disabled during schema migration'
  )
  return {
    success: false,
    error:
      'Dugsi registration is temporarily unavailable. Please try again later.',
  }
}

export async function checkParentEmailExists(_email: string): Promise<boolean> {
  console.error(
    '[DUGSI_REGISTRATION] Email check disabled during schema migration'
  )
  return false
}
