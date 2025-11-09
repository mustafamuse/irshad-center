/**
 * TypeScript types for v2 Dashboard
 */

// Section Cards data structure
export interface StatCard {
  title: string
  value: string | number
  trend: {
    value: number
    isPositive: boolean
  }
  description: string
  icon?: string
}

// Chart data types
export interface ChartDataPoint {
  date: string
  collected: number
  expected: number
}

// Data table row types
export interface StudentActivityRow {
  id: string
  name: string
  email: string | null
  batch: string | null
  status: 'current' | 'overdue' | 'pending' | 'none'
  subscriptionStatus: string | null
  lastPayment: string | null
  amount: number
  daysSincePayment: number | null
}

// Dashboard data props
export interface DashboardData {
  stats: {
    totalStudents: number
    activeSubscriptions: number
    monthlyRevenue: number
    needsAttention: number
    studentGrowth: number
    revenueGrowth: number
  }
  chartData: ChartDataPoint[]
  recentActivity: StudentActivityRow[]
}

// Filter options for data table
export interface TableFilters {
  search: string
  status: string[]
  batch: string[]
  dateRange: {
    from: Date | null
    to: Date | null
  }
}

// Batch performance metrics
export interface BatchMetric {
  id: string
  name: string
  studentCount: number
  activeSubscriptions: number
  revenue: number
  healthScore: number
}

// Subscription status distribution
export interface StatusDistribution {
  status: string
  count: number
  percentage: number
}

// Time range options for charts
export type TimeRange = '7d' | '30d' | '90d' | '1y'

// Dashboard view modes
export type ViewMode = 'overview' | 'detailed' | 'analytics'

// Export formats
export type ExportFormat = 'csv' | 'json' | 'pdf'