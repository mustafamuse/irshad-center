/**
 * Centralized type definitions for Dugsi Admin module
 * Single source of truth for all types used across components
 */

// Base types from Prisma
import {
  Gender,
  EducationLevel,
  GradeLevel,
  SubscriptionStatus,
  StripeAccountType,
} from '@prisma/client'

// Full registration type - manually defined since Student model was removed
// TODO: Migrate to Person/ProgramProfile model
export interface DugsiRegistration {
  id: string
  name: string
  gender: Gender | null
  dateOfBirth: Date | null
  educationLevel: EducationLevel | null
  gradeLevel: GradeLevel | null
  schoolName: string | null
  healthInfo: string | null
  createdAt: Date
  parentFirstName: string | null
  parentLastName: string | null
  parentEmail: string | null
  parentPhone: string | null
  parent2FirstName: string | null
  parent2LastName: string | null
  parent2Email: string | null
  parent2Phone: string | null
  paymentMethodCaptured: boolean
  paymentMethodCapturedAt: Date | null
  stripeCustomerIdDugsi: string | null
  stripeSubscriptionIdDugsi: string | null
  paymentIntentIdDugsi: string | null
  subscriptionStatus: SubscriptionStatus | null
  paidUntil: Date | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
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
