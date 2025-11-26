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
import {
  createStubbedAction,
  createStubbedQuery,
} from '@/lib/utils/stub-helpers'

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

// Note: Using createStubbedAction which returns ActionResult, compatible with RegistrationResult
export const registerDugsiChildren = createStubbedAction<
  [z.infer<typeof dugsiRegistrationSchema>],
  RegistrationResult['data']
>({
  feature: 'dugsi_registration',
  reason: 'schema_migration',
  userMessage:
    'Dugsi registration is temporarily unavailable. Please try again later.',
})

export const checkParentEmailExists = createStubbedQuery<[string], boolean>(
  { feature: 'dugsi_email_check', reason: 'schema_migration' },
  false
)
