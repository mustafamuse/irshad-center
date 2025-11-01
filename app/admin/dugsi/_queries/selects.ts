/**
 * Centralized Prisma select objects for Dugsi queries
 * Ensures consistent field selection across all queries
 */

// Full registration select - includes all fields needed for Dugsi admin
export const DUGSI_REGISTRATION_SELECT = {
  id: true,
  name: true,
  gender: true,
  dateOfBirth: true,
  educationLevel: true,
  gradeLevel: true,
  schoolName: true,
  healthInfo: true,
  createdAt: true,
  parentFirstName: true,
  parentLastName: true,
  parentEmail: true,
  parentPhone: true,
  parent2FirstName: true,
  parent2LastName: true,
  parent2Email: true,
  parent2Phone: true,
  // Payment fields
  paymentMethodCaptured: true,
  paymentMethodCapturedAt: true,
  stripeCustomerIdDugsi: true,
  stripeSubscriptionIdDugsi: true,
  subscriptionStatus: true,
  paidUntil: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
  familyReferenceId: true,
  stripeAccountType: true,
} as const

// Family lookup select - minimal fields for family identification
export const DUGSI_FAMILY_SELECT = {
  parentPhone: true,
  parent2Phone: true,
} as const

// Payment status select - payment-related fields only
export const DUGSI_PAYMENT_STATUS_SELECT = {
  id: true,
  name: true,
  paymentMethodCaptured: true,
  paymentMethodCapturedAt: true,
  stripeCustomerIdDugsi: true,
  stripeSubscriptionIdDugsi: true,
  subscriptionStatus: true,
  paidUntil: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
} as const
