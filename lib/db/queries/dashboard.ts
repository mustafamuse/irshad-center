/**
 * Dashboard Query Functions
 *
 * Specialized queries for the v2 dashboard providing aggregated statistics,
 * time-series data, and recent activity.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { startOfMonth, endOfMonth, subDays, format } from 'date-fns'

/**
 * Dashboard statistics for top cards
 */
export type DashboardStats = {
  totalStudents: number
  activeSubscriptions: number
  monthlyRevenue: number
  needsAttention: number
  studentGrowth: number // percentage change from last month
  revenueGrowth: number // percentage change from last month
}

/**
 * Time series data point for charts
 */
export type PaymentTrendDataPoint = {
  date: string
  collected: number
  expected: number
}

/**
 * Recent student activity for table
 */
export type RecentActivity = {
  id: string
  name: string
  email: string | null
  batch: string | null
  subscriptionStatus: string | null
  lastPaymentDate: Date | null
  monthlyRate: number
  paymentStatus: 'current' | 'overdue' | 'pending' | 'none'
  daysSinceLastPayment: number | null
}

/**
 * Get aggregated dashboard statistics
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  // Get current month start and end dates
  const now = new Date()
  const currentMonthStart = startOfMonth(now)
  const currentMonthEnd = endOfMonth(now)
  const lastMonthStart = startOfMonth(subDays(currentMonthStart, 1))
  const lastMonthEnd = endOfMonth(subDays(currentMonthStart, 1))

  // Get all active students (not withdrawn)
  const [
    totalStudents,
    activeSubscriptions,
    needsAttentionCount,
    currentMonthStudents,
    lastMonthStudents,
    allActiveStudents
  ] = await Promise.all([
    // Total students (excluding withdrawn)
    prisma.student.count({
      where: {
        status: {
          not: 'withdrawn'
        }
      }
    }),

    // Active subscriptions
    prisma.student.count({
      where: {
        status: {
          not: 'withdrawn'
        },
        subscriptionStatus: 'active'
      }
    }),

    // Needs attention (past_due, incomplete, or no subscription)
    prisma.student.count({
      where: {
        status: {
          not: 'withdrawn'
        },
        OR: [
          { subscriptionStatus: 'past_due' },
          { subscriptionStatus: 'incomplete' },
          { subscriptionStatus: 'incomplete_expired' },
          { subscriptionStatus: null },
          { stripeCustomerId: null }
        ]
      }
    }),

    // Students created this month
    prisma.student.count({
      where: {
        createdAt: {
          gte: currentMonthStart,
          lte: currentMonthEnd
        }
      }
    }),

    // Students created last month
    prisma.student.count({
      where: {
        createdAt: {
          gte: lastMonthStart,
          lte: lastMonthEnd
        }
      }
    }),

    // All active students for revenue calculation
    prisma.student.findMany({
      where: {
        status: {
          not: 'withdrawn'
        },
        subscriptionStatus: 'active'
      },
      select: {
        monthlyRate: true
      }
    })
  ])

  // Calculate monthly revenue
  const monthlyRevenue = allActiveStudents.reduce(
    (sum, student) => sum + (student.monthlyRate || 0),
    0
  )

  // Calculate growth percentages
  const studentGrowth = lastMonthStudents > 0
    ? ((currentMonthStudents - lastMonthStudents) / lastMonthStudents) * 100
    : 0

  // For revenue growth, we'd need historical data - for now, we'll simulate
  // In production, this would compare actual collected amounts
  const revenueGrowth = 12.5 // Placeholder - would calculate from StudentPayment records

  return {
    totalStudents,
    activeSubscriptions,
    monthlyRevenue,
    needsAttention: needsAttentionCount,
    studentGrowth: Math.round(studentGrowth * 10) / 10, // Round to 1 decimal
    revenueGrowth
  }
}

/**
 * Get payment trends for chart (last 90 days by default)
 */
export async function getPaymentTrends(days: number = 90): Promise<PaymentTrendDataPoint[]> {
  const endDate = new Date()
  const startDate = subDays(endDate, days)

  // Get all payments in the date range
  const payments = await prisma.studentPayment.findMany({
    where: {
      paidAt: {
        gte: startDate,
        lte: endDate
      }
    },
    select: {
      amountPaid: true,
      paidAt: true,
      month: true,
      year: true
    }
  })

  // Get expected revenue (all active subscriptions)
  const activeStudents = await prisma.student.findMany({
    where: {
      status: {
        not: 'withdrawn'
      },
      subscriptionStatus: 'active'
    },
    select: {
      monthlyRate: true
    }
  })

  const expectedDailyRevenue = activeStudents.reduce(
    (sum, s) => sum + (s.monthlyRate || 0),
    0
  ) / 30 // Average daily rate

  // Create a map to aggregate payments by day
  const paymentsByDay = new Map<string, number>()

  payments.forEach(payment => {
    const dateKey = format(payment.paidAt, 'yyyy-MM-dd')
    const current = paymentsByDay.get(dateKey) || 0
    paymentsByDay.set(dateKey, current + (payment.amountPaid / 100)) // Convert cents to dollars
  })

  // Generate data points for each day
  const dataPoints: PaymentTrendDataPoint[] = []
  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    const dateKey = format(currentDate, 'yyyy-MM-dd')
    dataPoints.push({
      date: dateKey,
      collected: paymentsByDay.get(dateKey) || 0,
      expected: expectedDailyRevenue
    })
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return dataPoints
}

/**
 * Get recent student activity for the data table
 */
export async function getRecentActivity(limit: number = 50): Promise<RecentActivity[]> {
  const students = await prisma.student.findMany({
    where: {
      status: {
        not: 'withdrawn'
      }
    },
    include: {
      Batch: {
        select: {
          name: true
        }
      }
    },
    orderBy: {
      updatedAt: 'desc'
    },
    take: limit
  })

  const now = new Date()

  return students.map(student => {
    // Calculate payment status
    let paymentStatus: RecentActivity['paymentStatus'] = 'none'
    let daysSinceLastPayment: number | null = null

    if (student.lastPaymentDate) {
      daysSinceLastPayment = Math.floor(
        (now.getTime() - student.lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (student.subscriptionStatus === 'active') {
        paymentStatus = daysSinceLastPayment <= 30 ? 'current' : 'overdue'
      } else if (student.subscriptionStatus === 'past_due') {
        paymentStatus = 'overdue'
      } else if (student.subscriptionStatus === 'incomplete') {
        paymentStatus = 'pending'
      }
    }

    return {
      id: student.id,
      name: student.name,
      email: student.email,
      batch: student.Batch?.name || null,
      subscriptionStatus: student.subscriptionStatus,
      lastPaymentDate: student.lastPaymentDate,
      monthlyRate: student.monthlyRate || 0,
      paymentStatus,
      daysSinceLastPayment
    }
  })
}

/**
 * Get subscription status distribution for pie chart
 */
export async function getSubscriptionStatusDistribution() {
  const statusCounts = await prisma.student.groupBy({
    by: ['subscriptionStatus'],
    where: {
      status: {
        not: 'withdrawn'
      }
    },
    _count: {
      id: true
    }
  })

  return statusCounts.map(item => ({
    status: item.subscriptionStatus || 'no_subscription',
    count: item._count.id
  }))
}

/**
 * Get enrollment trends by month (last 6 months)
 */
export async function getEnrollmentTrends(months: number = 6) {
  const trends = []
  const now = new Date()

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subDays(now, i * 30))
    const monthEnd = endOfMonth(monthStart)

    const count = await prisma.student.count({
      where: {
        createdAt: {
          gte: monthStart,
          lte: monthEnd
        }
      }
    })

    trends.push({
      month: format(monthStart, 'MMM yyyy'),
      enrollments: count
    })
  }

  return trends
}

/**
 * Get batch performance metrics
 */
export async function getBatchPerformance() {
  const batches = await prisma.batch.findMany({
    include: {
      _count: {
        select: {
          Student: {
            where: {
              status: {
                not: 'withdrawn'
              }
            }
          }
        }
      }
    }
  })

  const batchMetrics = await Promise.all(
    batches.map(async (batch) => {
      const students = await prisma.student.findMany({
        where: {
          batchId: batch.id,
          status: {
            not: 'withdrawn'
          }
        },
        select: {
          subscriptionStatus: true,
          monthlyRate: true
        }
      })

      const activeCount = students.filter(s => s.subscriptionStatus === 'active').length
      const totalRevenue = students.reduce((sum, s) => sum + (s.monthlyRate || 0), 0)

      return {
        id: batch.id,
        name: batch.name,
        studentCount: batch._count.Student,
        activeSubscriptions: activeCount,
        revenue: totalRevenue,
        healthScore: batch._count.Student > 0
          ? Math.round((activeCount / batch._count.Student) * 100)
          : 0
      }
    })
  )

  return batchMetrics.sort((a, b) => b.revenue - a.revenue)
}

/**
 * Get payment collection rate by month
 */
export async function getPaymentCollectionRate(months: number = 3) {
  const rates = []
  const now = new Date()

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subDays(now, i * 30))
    const monthEnd = endOfMonth(monthStart)

    // Get expected revenue for the month
    const activeStudentsInMonth = await prisma.student.count({
      where: {
        status: {
          not: 'withdrawn'
        },
        subscriptionStatus: 'active',
        createdAt: {
          lte: monthEnd
        }
      }
    })

    // Get actual payments collected
    const payments = await prisma.studentPayment.aggregate({
      where: {
        year: parseInt(format(monthStart, 'yyyy')),
        month: parseInt(format(monthStart, 'MM'))
      },
      _sum: {
        amountPaid: true
      }
    })

    const collected = (payments._sum.amountPaid || 0) / 100
    const expected = activeStudentsInMonth * 150 // Assuming base rate, adjust as needed

    rates.push({
      month: format(monthStart, 'MMM yyyy'),
      collected,
      expected,
      rate: expected > 0 ? Math.round((collected / expected) * 100) : 0
    })
  }

  return rates
}