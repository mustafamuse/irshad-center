'use server'

/**
 * Update Student Action
 *
 * IMPORTANT: This action needs migration to the new schema.
 * The Student model no longer exists.
 * TODO: Priority migration in PR 2e.
 */

import { createStubbedAction } from '@/lib/utils/stub-helpers'

export const updateStudent = createStubbedAction<
  [string, Record<string, unknown>]
>({ feature: 'updateStudent', reason: 'schema_migration' })
