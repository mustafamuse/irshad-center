/**
 * Stub Helper Utilities
 *
 * Factory functions for creating stubbed server actions during schema migration.
 * These utilities reduce boilerplate and ensure consistent logging patterns
 * across all stubbed functions.
 *
 * @example
 * ```typescript
 * // Instead of 10 lines of boilerplate:
 * export const getStudents = createStubbedQuery<[StudentQueryOptions?], StudentDTO[]>(
 *   { feature: 'getStudents', reason: 'schema_migration' },
 *   []
 * )
 * ```
 */

import { createActionLogger, logWarning } from '@/lib/logger'
import type { ActionResult } from '@/lib/utils/action-helpers'

// ============================================================================
// TYPES
// ============================================================================

type StubReason = 'schema_migration' | 'feature_not_implemented'

interface StubConfig {
  /** Feature name for logging (e.g., 'getStudents', 'dugsi_registration') */
  feature: string
  /** Reason the feature is stubbed */
  reason: StubReason
  /** Custom user-facing error message (optional) */
  userMessage?: string
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates a stubbed server action that returns an error result.
 * Use for actions that normally return ActionResult<T>.
 *
 * @example
 * ```typescript
 * export const registerStudent = createStubbedAction<[StudentData], Student>(
 *   { feature: 'registerStudent', reason: 'schema_migration' }
 * )
 * ```
 */
export function createStubbedAction<TArgs extends unknown[], TReturn = void>(
  config: StubConfig
): (...args: TArgs) => Promise<ActionResult<TReturn>> {
  const logger = createActionLogger(config.feature)
  const message =
    config.userMessage ??
    'This feature is temporarily unavailable. Please try again later.'

  return async (..._args: TArgs): Promise<ActionResult<TReturn>> => {
    await logWarning(logger, `${config.feature} disabled`, {
      reason: config.reason,
    })
    return { success: false, error: message }
  }
}

/**
 * Creates a stubbed query that returns a default value.
 * Use for queries that return arrays, booleans, or other non-ActionResult types.
 *
 * @example
 * ```typescript
 * export const getStudents = createStubbedQuery<[QueryOptions?], Student[]>(
 *   { feature: 'getStudents', reason: 'schema_migration' },
 *   [] // default empty array
 * )
 *
 * export const checkEmailExists = createStubbedQuery<[string], boolean>(
 *   { feature: 'checkEmailExists', reason: 'schema_migration' },
 *   false // default false
 * )
 * ```
 */
export function createStubbedQuery<TArgs extends unknown[], TReturn>(
  config: StubConfig,
  defaultValue: TReturn
): (...args: TArgs) => Promise<TReturn> {
  const logger = createActionLogger(config.feature)

  return async (..._args: TArgs): Promise<TReturn> => {
    await logWarning(logger, `${config.feature} disabled`, {
      reason: config.reason,
    })
    return defaultValue
  }
}

/**
 * Creates a stubbed webhook handler that throws an error.
 * Throwing is required for Stripe webhook retry logic - a thrown error
 * signals to Stripe that the webhook should be retried.
 *
 * @example
 * ```typescript
 * export const handleCheckoutCompleted = createStubbedWebhookHandler<[Stripe.Event]>(
 *   { feature: 'handleCheckoutCompleted', reason: 'schema_migration' }
 * )
 * ```
 */
export function createStubbedWebhookHandler<TArgs extends unknown[]>(
  config: StubConfig
): (...args: TArgs) => Promise<never> {
  const logger = createActionLogger(config.feature)

  return async (..._args: TArgs): Promise<never> => {
    await logWarning(logger, `${config.feature} disabled`, {
      reason: config.reason,
    })
    throw new Error(`${config.feature} needs migration to new schema`)
  }
}
