/**
 * Shared Services
 *
 * Cross-program business logic services.
 * These services work with any program (Dugsi, Mahad, Youth, Donations).
 *
 * Use these for operations that are program-agnostic:
 * - Billing accounts and subscriptions
 * - Payment processing
 * - Guardian/parent management
 */

export * from './billing-service'
export * from './subscription-service'
export * from './payment-service'
export * from './parent-service'
