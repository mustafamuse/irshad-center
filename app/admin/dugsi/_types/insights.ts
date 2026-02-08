import { SubscriptionStatus } from '@prisma/client'

export interface ProgramHealthStats {
  totalFamilies: number
  totalStudents: number
  activeStudents: number
  familyStatusBreakdown: Record<SubscriptionStatus | 'none', number>
  paymentMethodCaptureRate: number
}

export interface RevenueByTier {
  tier: string
  childCount: number
  familyCount: number
  expectedRevenue: number
  actualRevenue: number
}

export interface RevenueStats {
  monthlyRevenue: number
  expectedRevenue: number
  variance: number
  mismatchCount: number
  revenueByTier: RevenueByTier[]
}

export interface EnrollmentDistribution {
  morningStudents: number
  afternoonStudents: number
  assignedToClass: number
  unassignedToClass: number
}

export interface RegistrationTrendItem {
  month: string
  label: string
  familyCount: number
  studentCount: number
}

export interface DugsiInsightsData {
  health: ProgramHealthStats
  revenue: RevenueStats
  enrollment: EnrollmentDistribution
  registrationTrend: RegistrationTrendItem[]
}
