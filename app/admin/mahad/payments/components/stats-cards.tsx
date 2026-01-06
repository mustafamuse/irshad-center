import {
  Users,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  DollarSign,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MAHAD_PROGRAM } from '@/lib/constants/mahad'
import { prisma } from '@/lib/db'

/**
 * Get payment stats from ProgramProfile/Enrollment model
 * TODO: Add revenue stats when StudentPayment migration is complete
 */
async function getStats() {
  // Count Mahad program profiles (excluding Test batch)
  const [
    totalStudents,
    enrolledStudents,
    registeredStudents,
    activeSubscriptions,
    totalRevenue,
  ] = await Promise.all([
    // Total non-withdrawn students
    prisma.enrollment.count({
      where: {
        status: { not: 'WITHDRAWN' },
        programProfile: {
          program: MAHAD_PROGRAM,
        },
        batch: {
          name: { not: 'Test' },
        },
      },
    }),
    // Enrolled students
    prisma.enrollment.count({
      where: {
        status: 'ENROLLED',
        programProfile: {
          program: MAHAD_PROGRAM,
        },
        batch: {
          name: { not: 'Test' },
        },
      },
    }),
    // Registered students
    prisma.enrollment.count({
      where: {
        status: 'REGISTERED',
        programProfile: {
          program: MAHAD_PROGRAM,
        },
        batch: {
          name: { not: 'Test' },
        },
      },
    }),
    // Active subscriptions
    prisma.billingAssignment.count({
      where: {
        isActive: true,
        subscription: {
          status: 'active',
        },
        programProfile: {
          program: MAHAD_PROGRAM,
        },
      },
    }),
    // Total revenue from StudentPayment (still uses old model structure)
    prisma.studentPayment.aggregate({
      _sum: { amountPaid: true },
      where: {
        ProgramProfile: {
          program: MAHAD_PROGRAM,
        },
      },
    }),
  ])

  return {
    totalStudents,
    activeSubscriptions,
    registeredStudents,
    totalRevenue: totalRevenue._sum.amountPaid || 0,
    enrolledStudents,
  }
}

export async function StatsCards() {
  const {
    totalStudents,
    activeSubscriptions,
    registeredStudents,
    totalRevenue,
    enrolledStudents,
  } = await getStats()

  const enrollmentRate =
    totalStudents > 0 ? (enrolledStudents / totalStudents) * 100 : 0
  const activeRate =
    totalStudents > 0 ? (activeSubscriptions / totalStudents) * 100 : 0

  const stats = [
    {
      title: 'Total Students',
      value: totalStudents,
      icon: Users,
      description: `${enrolledStudents} enrolled`,
      change: `${enrollmentRate.toFixed(1)}% enrollment rate`,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      bottomBorder: 'bg-blue-500/20 dark:bg-blue-400/20',
    },
    {
      title: 'Active Subscriptions',
      value: activeSubscriptions,
      icon: CreditCard,
      description: `${activeRate.toFixed(1)}% of students`,
      change: 'Billing status: Active',
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
      bottomBorder: 'bg-green-500/20 dark:bg-green-400/20',
    },
    {
      title: 'Registered Students',
      value: registeredStudents,
      icon: AlertTriangle,
      description: 'Awaiting enrollment',
      change: 'Need to start classes',
      iconBg: 'bg-orange-100 dark:bg-orange-900/30',
      iconColor: 'text-orange-600 dark:text-orange-400',
      bottomBorder: 'bg-orange-500/20 dark:bg-orange-400/20',
    },
    {
      title: 'Total Revenue',
      value: `$${(totalRevenue / 100).toLocaleString()}`,
      icon: DollarSign,
      description: 'All-time earnings',
      change: 'Cumulative payments',
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
      bottomBorder: 'bg-purple-500/20 dark:bg-purple-400/20',
    },
  ]

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card
          key={index}
          className="relative overflow-hidden border-border bg-card"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={`rounded-md p-2 ${stat.iconBg}`}>
              <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">
              {stat.value}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {stat.description}
            </p>
            <div className="mt-2 flex items-center">
              <TrendingUp className="mr-1 h-3 w-3 text-green-600 dark:text-green-400" />
              <span className="text-xs text-green-600 dark:text-green-400">
                {stat.change}
              </span>
            </div>
          </CardContent>
          <div
            className={`absolute bottom-0 left-0 right-0 h-1 ${stat.bottomBorder}`}
          />
        </Card>
      ))}
    </div>
  )
}
