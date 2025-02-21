import type Stripe from 'stripe'

import { StudentStatus } from './types/student'

export interface Student {
  id: string
  name: string
  monthlyRate: number
  hasCustomRate: boolean
  subscription: boolean
  status: StudentStatus
  payorId: string | null
  siblingId: string | null
}

export interface StudentData {
  id: string
  name: string
  className: string
  monthlyRate: number
  hasCustomRate: boolean
  familyId: string | null
  familyName: string
  siblings: string[]
  totalFamilyMembers: number
}

export interface StudentsJson {
  students: {
    [key: string]: StudentData
  }
  constants: {
    baseRate: number
    discounts: {
      siblings: {
        [key: string]: number
      }
    }
  }
}

export interface EnrollmentFormData {
  students: string[]
  firstName: string
  lastName: string
  email: string
  phone: string
  accountHolderName: string
  routingNumber: string
  accountNumber: string
  confirmAccountNumber: string
  accountType: 'checking' | 'savings'
  termsAccepted: boolean
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

export interface PaymentSetupStatus {
  customerId: string
  subscriptionId: string | null
  setupCompleted: boolean
  bankVerified: boolean
  subscriptionActive: boolean
  timestamp: number
}

export interface BankAccountStatus {
  customerId: string
  verified: boolean
  last4: string | null
  bankName: string | null
  accountType: 'checking' | 'savings' | null
  accountHolderType: 'company' | 'individual' | null
  routingNumber: string | null
  statusDetails: {
    blocked?: {
      network_code: string | null
      reason:
        | 'bank_account_closed'
        | 'bank_account_frozen'
        | 'bank_account_invalid_details'
        | 'bank_account_restricted'
        | 'bank_account_unusable'
        | 'debit_not_authorized'
        | null
    }
  } | null
  timestamp: number
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

export interface SubscriptionPaymentStatus {
  subscriptionId: string
  setupCompleted: boolean
  subscriptionActive: boolean
  bankVerified: boolean
  lastPaymentStatus: 'succeeded' | 'failed' | 'pending'
  lastPaymentDate: string
  currentPeriodEnd: string
  timestamp: number
}

interface _SubscriptionStatus {
  setupIntentId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  subscriptionId?: string
  error?: string
  createdAt: string
  updatedAt: string
}
export type Relationship =
  | 'self'
  | 'father'
  | 'mother'
  | 'sibling'
  | 'uncle'
  | 'aunt'
  | 'step-father'
  | 'step-mother'
  | 'other'
export interface PayorDetails {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  relationship?: Relationship
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

export const BASE_RATE = 150
