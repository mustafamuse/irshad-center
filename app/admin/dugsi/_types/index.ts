/**
 * Centralized type definitions for Dugsi Admin module
 * Single source of truth for all types used across components
 */

import {
  Gender,
  GradeLevel,
  SubscriptionStatus,
  StripeAccountType,
} from '@prisma/client'

/**
 * DugsiRegistration - DTO for Dugsi student data displayed in admin UI
 *
 * This is a view model that flattens the normalized Person/ProgramProfile/Guardian
 * structure into a flat object for easier UI consumption.
 *
 * Data flows: ProgramProfile -> mapProfileToDugsiRegistration() -> DugsiRegistration
 */
export interface DugsiRegistration {
  // Student info (from Person + ProgramProfile)
  id: string
  name: string
  gender: Gender | null
  dateOfBirth: Date | null
  gradeLevel: GradeLevel | null // K-12 grade level for Dugsi students
  schoolName: string | null
  healthInfo: string | null
  createdAt: Date

  // Parent 1 info (from GuardianRelationship -> Person -> ContactPoints)
  parentFirstName: string | null
  parentLastName: string | null
  parentEmail: string | null
  parentPhone: string | null

  // Parent 2 info (optional second guardian)
  parent2FirstName: string | null
  parent2LastName: string | null
  parent2Email: string | null
  parent2Phone: string | null

  // Billing info (from BillingAccount + Subscription)
  paymentMethodCaptured: boolean
  paymentMethodCapturedAt: Date | null
  stripeCustomerIdDugsi: string | null
  stripeSubscriptionIdDugsi: string | null
  paymentIntentIdDugsi: string | null
  subscriptionStatus: SubscriptionStatus | null
  paidUntil: Date | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null

  // Family tracking
  familyReferenceId: string | null
  stripeAccountType: StripeAccountType | null
}

// Family type
export interface Family {
  familyKey: string
  members: DugsiRegistration[]
  hasPayment: boolean
  hasSubscription: boolean
  parentEmail: string | null
  parentPhone: string | null
}

// Filter types
export interface FamilyFilters {
  dateFilter: DateFilter
  hasHealthInfo: boolean
}

// Tab and view types
export type TabValue =
  | 'overview'
  | 'active'
  | 'pending'
  | 'needs-attention'
  | 'all'
export type ViewMode = 'grid' | 'table'
export type DateFilter = 'all' | 'today' | 'yesterday' | 'thisWeek' | 'lastWeek'
export type FamilyStatus = 'active' | 'pending' | 'no-payment'

// Action result types
export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Action data payload types
export interface SubscriptionValidationData {
  subscriptionId: string
  customerId: string
  status: string
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
}

export interface PaymentStatusData {
  familyEmail: string
  studentCount: number
  hasPaymentMethod: boolean
  hasSubscription: boolean
  stripeCustomerId: string | null
  subscriptionId: string | null
  subscriptionStatus: string | null
  paidUntil: Date | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  students: Array<{ id: string; name: string }>
}

export interface BankVerificationData {
  paymentIntentId: string
  status: string
}

export interface SubscriptionLinkData {
  updated: number
}
