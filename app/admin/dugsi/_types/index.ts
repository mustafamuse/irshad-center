/**
 * Centralized type definitions for Dugsi Admin module
 * Single source of truth for all types used across components
 */

import {
  Gender,
  GradeLevel,
  Shift,
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
  shift: Shift | null
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

  // Primary payer designation (1 = parent1, 2 = parent2, null = not set)
  primaryPayerParentNumber: 1 | 2 | null

  // Billing info (from BillingAccount + Subscription)
  paymentMethodCaptured: boolean
  paymentMethodCapturedAt: Date | null
  stripeCustomerIdDugsi: string | null
  stripeSubscriptionIdDugsi: string | null
  paymentIntentIdDugsi: string | null
  subscriptionStatus: SubscriptionStatus | null
  subscriptionAmount: number | null
  paidUntil: Date | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null

  // Family tracking
  familyReferenceId: string | null
  stripeAccountType: StripeAccountType | null

  // Teacher info (from DugsiClassEnrollment -> DugsiClass -> DugsiClassTeacher -> Teacher -> Person)
  teacherName: string | null // Primary teacher name (based on student's shift)
  teacherEmail: string | null // Primary teacher email
  teacherPhone: string | null // Primary teacher phone
  morningTeacher: string | null // Morning shift teacher name
  afternoonTeacher: string | null // Afternoon shift teacher name
  hasTeacherAssigned: boolean // Quick check for UI

  // Family billing (from aggregation query)
  familyChildCount: number // Total enrolled children in family (for billing calculation)
}

// Family type
export interface Family {
  familyKey: string
  members: DugsiRegistration[]
  hasPayment: boolean
  hasSubscription: boolean
  hasChurned: boolean
  parentEmail: string | null
  parentPhone: string | null
}

// Filter types
export interface FamilyFilters {
  dateFilter: DateFilter
  hasHealthInfo: boolean
  shift?: 'MORNING' | 'AFTERNOON' | 'all'
}

// Tab and view types
export type TabValue =
  | 'overview'
  | 'active'
  | 'needs-attention'
  | 'churned'
  | 'billing-mismatch'
  | 'all'
export type DateFilter = 'all' | 'today' | 'yesterday' | 'thisWeek' | 'lastWeek'
export type FamilyStatus = 'active' | 'churned' | 'no-payment'
export type SearchField = 'all' | 'childName' | 'parentName' | 'email' | 'phone'

// Stripe payment history types
export interface StripePaymentHistoryItem {
  id: string
  date: Date
  amount: number
  status: 'succeeded' | 'pending' | 'failed'
  description: string
  invoiceUrl: string | null
}

// Bulk payment link types
export interface BulkPaymentLinkItem {
  familyId: string
  familyName: string
  paymentUrl: string
  childCount: number
  rate: number
}

export interface BulkPaymentLinkFailure {
  familyId: string
  familyName: string
  error: string
}

export interface BulkPaymentLinkResult {
  links: BulkPaymentLinkItem[]
  failed: BulkPaymentLinkFailure[]
}

export interface UnassignedStudent {
  profileId: string
  name: string
  dateOfBirth: Date | null
  age: number | null
  shift: Shift | null
  siblings: { name: string; teacherName: string; classShift: Shift }[]
}

// Re-export ActionResult from canonical location
export type { ActionResult } from '@/lib/utils/action-helpers'

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

// Class management types
export interface ClassTeacher {
  id: string
  teacherId: string
  teacherName: string
}

export interface ClassWithDetails {
  id: string
  name: string
  shift: Shift
  description: string | null
  isActive: boolean
  teachers: ClassTeacher[]
  studentCount: number
}

export interface StudentForEnrollment {
  id: string
  programProfileId: string
  name: string
  shift: Shift | null
  isEnrolledInClass: boolean
  currentClassName: string | null
}
