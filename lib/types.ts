/**
 * @deprecated This file contains legacy types from the old monolithic Student model.
 * These types are kept for backward compatibility with legacy dashboard components.
 *
 * For new code, use:
 * - lib/types/student.ts for StudentStatus
 * - lib/types/program-profile.ts for ProgramProfile types
 * - lib/utils/mahad-tuition.ts for rate calculations
 */
import type Stripe from 'stripe'

import { StudentStatus } from './types/student'

/**
 * @deprecated Use ProgramProfile from lib/types/program-profile.ts
 * Rates are now calculated via calculateMahadRate() in lib/utils/mahad-tuition.ts
 */
export interface Student {
  id: string
  name: string
  /** @deprecated Rates now calculated dynamically via calculateMahadRate() */
  monthlyRate: number
  /** @deprecated Replaced by billingType enum */
  hasCustomRate: boolean
  subscription: boolean
  status: StudentStatus
  payorId: string | null
  siblingId: string | null
}

/**
 * @deprecated Legacy type for old JSON-based student data
 */
export interface StudentData {
  id: string
  name: string
  className: string
  /** @deprecated Rates now calculated dynamically */
  monthlyRate: number
  /** @deprecated Replaced by billingType enum */
  hasCustomRate: boolean
  familyId: string | null
  familyName: string
  siblings: string[]
  totalFamilyMembers: number
}

/**
 * @deprecated Legacy type for old JSON-based student storage
 */
export interface StudentsJson {
  students: {
    [key: string]: StudentData
  }
  constants: {
    /** @deprecated Use calculateMahadRate() from lib/utils/mahad-tuition.ts */
    baseRate: number
    discounts: {
      siblings: {
        [key: string]: number
      }
    }
  }
}

export interface DashboardSubscription {
  id: string
  status: Stripe.Subscription.Status
  currentPeriodEnd: number
  customer: {
    name: string | null
    email: string | null
    id: string
  }
  paymentMethod: {
    type: string
    card?: Stripe.PaymentMethod.Card
    us_bank_account?: Stripe.PaymentMethod.UsBankAccount
  } | null
  latestInvoice: {
    id: string
    status: string
    amount_due: number
    hosted_invoice_url: string | null
  }
  students: Student[]
  totalAmount: number
}

export interface DashboardStats {
  totalActiveSubscriptions: number
  totalStudents: number
  activeCount: number
  monthlyRecurringRevenue: number
  potentialRevenue: number
  actualPotentialRevenue: number
  discountImpact: number
  revenueEfficiency: number
  overduePayments: number
  canceledLastMonth: number
  averageRevenuePerStudent: number
  retentionRate: number
  paymentPatterns: {
    totalLatePayments: number
    customersWithLatePayments: number
    averagePaymentDelay: number
    riskiestCustomers: PaymentPattern[]
    paymentMethodStats: {
      ach: { total: number; successful: number; rate: number }
      card: { total: number; successful: number; rate: number }
    }
  }
  financialHealth: FinancialHealth
}

export interface ProcessedStudent {
  id: string
  name: string
  subscriptionId: string
  status: string
  currentPeriodEnd: number | null
  guardian: {
    id: string
    name: string
    email: string
  }
  monthlyAmount: number
  discount: {
    amount: number
    type: 'family' | 'custom' | 'none'
    percentage: number
  }
  familyId?: string
  totalFamilyMembers?: number
  revenue: {
    monthly: number
    annual: number
    lifetime: number
  }
  isEnrolled: boolean
}

export interface PaymentPattern {
  customerId: string
  customerName: string
  paymentHistory: {
    onTimePayments: number
    latePayments: number
    failedPayments: number
    averageDelayDays: number
  }
  riskScore: number // 0-100, higher means more risky
  paymentMethodSuccess: {
    total: number
    successful: number
    successRate: number
  }
  flags: {
    isFrequentlyLate: boolean
    hasMultipleFailures: boolean
    isHighRisk: boolean
  }
}

export interface FinancialHealth {
  revenueStability: {
    score: number // 0-100
    trend: 'increasing' | 'stable' | 'decreasing'
    volatility: number // Standard deviation of monthly revenue
  }
  cashFlow: {
    currentMonth: number
    nextMonthPrediction: number
    predictedGrowth: number
    riskFactors: string[]
  }
  revenueTargets: {
    monthlyTarget: number
    currentProgress: number
    projectedRevenue: number
    shortfall: number
    isOnTrack: boolean
  }
}

export interface StudentMetadata {
  id: string
  name: string
  monthlyRate: number
  familyId?: string
  totalFamilyMembers?: number
}

export interface PaymentNotification {
  type:
    | 'payment_failed'
    | 'payment_succeeded'
    | 'subscription_canceled'
    | 'insufficient_funds_warning'
    | 'balance_refreshed'
  subscriptionId: string
  customerId: string
  customerName: string
  studentNames: string[]
  amount: number
  attemptCount?: number
  nextAttempt?: number
  timestamp: number
  balance?: number
}

export interface DashboardResponse {
  // ... existing fields ...
  notEnrolledPotentialRevenue: number
  notEnrolledTotalDiscounts: number
  notEnrolledBaseRateRevenue: number
  activeCount: number
  unenrolledCount: number
  // Active student metrics
  activeWithFamilyDiscount: number
  activeFamilyDiscountTotal: number
  averageActiveFamilyDiscount: number
  activeNoDiscountCount: number
  activeNoDiscountRevenue: number
  averageActiveAmount: number
  // Not enrolled student metrics
  notEnrolledWithFamilyDiscount: number
  notEnrolledFamilyDiscountTotal: number
  notEnrolledNoDiscountCount: number
  notEnrolledNoDiscountRevenue: number
  unenrolledRevenue: number
  averageUnenrolledAmount: number
}

export interface TableStudent extends ProcessedStudent {
  // Table-specific fields
  selected?: boolean
  rowNumber?: number
  displayDiscount: string // Formatted discount string
  displayAmount: string // Formatted amount string
  displayStatus: string // Formatted status string
  displayDate?: string // Formatted date string
  statusColor: string // CSS color class for status
  discountBadgeVariant: 'default' | 'secondary' | 'outline'
}

export interface SubscriptionQueryParams {
  page: number
  limit: number
  status?: string
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  discountType?: string
  paymentStatus?: string
}

export interface SubscriptionResponse {
  students: ProcessedStudent[]
  totalCount: number
  activeCount: number
  pastDueCount: number
  canceledCount: number
  totalStudents: number
  unenrolledCount: number
  filteredCount: number

  // Active student metrics
  activeWithFamilyDiscount: number
  activeFamilyDiscountTotal: number
  averageActiveFamilyDiscount: number
  activeNoDiscountCount: number
  activeNoDiscountRevenue: number
  activeRevenue: number
  averageActiveAmount: number

  // Not enrolled metrics
  notEnrolledWithFamilyDiscount: number
  notEnrolledFamilyDiscountTotal: number
  notEnrolledNoDiscountCount: number
  notEnrolledNoDiscountRevenue: number
  notEnrolledPotentialRevenue: number
  notEnrolledTotalDiscounts: number

  // Past due metrics
  pastDueRevenue: number
  averagePastDueAmount: number

  // Canceled metrics
  canceledRevenue: number
  lastMonthCanceled: number

  // Family discount metrics
  familyDiscountCount: number
  noDiscountCount: number

  // Pagination
  hasMore: boolean
  nextCursor: string | null

  metrics: {
    totalRevenue: number
    totalDiscounts: number
    averageRevenue: number
    collectionRate: number
  }
}

/**
 * @deprecated Use MAHAD_BASE_RATE from lib/utils/mahad-tuition.ts instead
 * Kept for backward compatibility with legacy dashboard components
 */
export const BASE_RATE = 150
