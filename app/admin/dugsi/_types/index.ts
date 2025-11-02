/**
 * Centralized type definitions for Dugsi Admin module
 * Single source of truth for all types used across components
 */

// Base types from Prisma
import { Student } from '@prisma/client'

// Full registration type (extends Prisma Student)
export type DugsiRegistration = Pick<
  Student,
  | 'id'
  | 'name'
  | 'gender'
  | 'dateOfBirth'
  | 'educationLevel'
  | 'gradeLevel'
  | 'schoolName'
  | 'healthInfo'
  | 'createdAt'
  | 'parentFirstName'
  | 'parentLastName'
  | 'parentEmail'
  | 'parentPhone'
  | 'parent2FirstName'
  | 'parent2LastName'
  | 'parent2Email'
  | 'parent2Phone'
  | 'paymentMethodCaptured'
  | 'paymentMethodCapturedAt'
  | 'stripeCustomerIdDugsi'
  | 'stripeSubscriptionIdDugsi'
  | 'subscriptionStatus'
  | 'paidUntil'
  | 'currentPeriodStart'
  | 'currentPeriodEnd'
  | 'familyReferenceId'
  | 'stripeAccountType'
>

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
