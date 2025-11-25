/**
 * Dugsi Services
 *
 * Centralized exports for all Dugsi business logic services.
 *
 * Services:
 * - Registration: Student registration and family management
 * - Subscription: Stripe subscription linking and validation
 * - Child: Student-specific operations
 *
 * Note: Bank and parent services have been consolidated into
 * lib/services/shared/payment-service and lib/services/shared/parent-service
 */

export * from './registration-service'
export * from './subscription-service'
export * from './child-service'
