import { Metadata } from 'next'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import {
  Users,
  GraduationCap,
  DollarSign,
  Calendar,
  FileText,
  CreditCard,
  Calculator,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Admin Dashboard | Irshad Center',
  description: 'Administrative dashboard for managing students, payments, and programs',
}

export default function AdminDashboard() {
  const hubs = [
    {
      title: 'Student Management',
      description: 'Manage student profiles, enrollment, and records',
      icon: Users,
      color: 'blue',
      links: [
        { title: 'MAHAD Students', href: '/admin/students/mahad', count: null },
        { title: 'Dugsi Families', href: '/admin/dugsi', count: null },
        { title: 'Duplicate Detection', href: '/admin/students/duplicates', count: null },
      ],
    },
    {
      title: 'Cohort Organization',
      description: 'Organize students into batches and manage assignments',
      icon: GraduationCap,
      color: 'purple',
      links: [
        { title: 'View All Cohorts', href: '/admin/cohorts', count: null },
        { title: 'Legacy Cohorts Page', href: '/admin/mahad/cohorts', count: null },
      ],
    },
    {
      title: 'Billing & Finance',
      description: 'Track payments, subscriptions, and financial health',
      icon: DollarSign,
      color: 'green',
      links: [
        { title: 'Payment Overview', href: '/admin/billing/overview', count: null },
        { title: 'Invoices', href: '/admin/billing/invoices', count: null },
        { title: 'Subscriptions', href: '/admin/billing/subscriptions', count: null },
        { title: 'Profit Sharing', href: '/admin/billing/profit-share', count: null },
      ],
    },
    {
      title: 'Attendance Tracking',
      description: 'Monitor student attendance and participation',
      icon: Calendar,
      color: 'amber',
      links: [
        { title: 'Attendance Records', href: '/admin/attendance', count: null },
      ],
    },
  ]

  const colorMap = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400',
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome to the Irshad Center administrative dashboard
        </p>
      </div>

      {/* Quick Stats (placeholder for future implementation) */}
      <div className="grid gap-4 mb-8 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">--</p>
              <p className="text-sm text-muted-foreground">Total Students</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">--</p>
              <p className="text-sm text-muted-foreground">Active Subscriptions</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">--</p>
              <p className="text-sm text-muted-foreground">Active Cohorts</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">--</p>
              <p className="text-sm text-muted-foreground">Needs Attention</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Hub Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {hubs.map((hub) => {
          const colorClasses = colorMap[hub.color as keyof typeof colorMap]
          return (
            <Card key={hub.title} className="p-6">
              <div className="mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold mb-1">{hub.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {hub.description}
                    </p>
                  </div>
                  <div className={`rounded-lg p-2 ${colorClasses}`}>
                    <hub.icon className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {hub.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors group"
                  >
                    <span className="text-sm font-medium">{link.title}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </Link>
                ))}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Recent Activity (placeholder for future) */}
      <Card className="mt-8 p-6">
        <h2 className="text-lg font-bold mb-4">Recent Activity</h2>
        <p className="text-sm text-muted-foreground">
          Activity feed will be displayed here in future updates
        </p>
      </Card>
    </div>
  )
}