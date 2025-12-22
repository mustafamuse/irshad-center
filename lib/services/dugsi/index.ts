/**
 * Dugsi Services
 *
 * Centralized exports for all Dugsi business logic services.
 *
 * Services:
 * - Registration: Student registration and family management
 * - Subscription: Stripe subscription linking and validation
 * - Child: Student-specific operations
 * - Family: Parent/guardian and child updates
 * - Payment: Bank verification and payment status
 * - Checkout: Stripe checkout session creation
 * - Attendance: Attendance tracking and analytics
 */

export * from './registration-service'
export * from './subscription-service'
export * from './child-service'
export * from './family-service'
export * from './payment-service'
export * from './checkout-service'
export * from './attendance-service'
