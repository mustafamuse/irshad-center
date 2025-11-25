import Link from 'next/link'

import {
  Mail,
  Phone,
  ExternalLink,
  User,
  AlertCircle,
  CheckCircle,
  UserX,
  Clock,
  Zap,
  GraduationCap,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StudentWithDetails } from '@/types'

import { PaymentHistoryDialog } from './payment-history-dialog'

interface StudentsMobileCardsProps {
  data: StudentWithDetails[]
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'enrolled':
      return {
        variant: 'default' as const,
        className:
          'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800',
        icon: CheckCircle,
      }
    case 'past_due':
      return {
        variant: 'destructive' as const,
        className:
          'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-300 dark:border-red-800',
        icon: AlertCircle,
      }
    case 'registered':
      return {
        variant: 'secondary' as const,
        className:
          'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-800',
        icon: Clock,
      }
    case 'inactive':
      return {
        variant: 'outline' as const,
        className: 'bg-muted text-muted-foreground border-border',
        icon: UserX,
      }
    case 'withdrawn':
      return {
        variant: 'outline' as const,
        className:
          'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-300 dark:border-orange-800',
        icon: UserX,
      }
    default:
      return {
        variant: 'outline' as const,
        className: 'bg-muted text-muted-foreground border-border',
        icon: User,
      }
  }
}

function getSubscriptionConfig(status: string | null) {
  switch (status) {
    case 'active':
      return {
        variant: 'default' as const,
        className:
          'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800',
        icon: Zap,
      }
    case 'past_due':
      return {
        variant: 'destructive' as const,
        className:
          'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-300 dark:border-red-800',
        icon: AlertCircle,
      }
    case 'canceled':
      return {
        variant: 'secondary' as const,
        className:
          'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-300 dark:border-orange-800',
        icon: UserX,
      }
    default:
      return {
        variant: 'secondary' as const,
        className: 'bg-muted text-muted-foreground border-border',
        icon: AlertCircle,
      }
  }
}

export function StudentsMobileCards({ data }: StudentsMobileCardsProps) {
  if (data.length === 0) {
    return (
      <div className="px-4 py-6">
        <Card className="border border-dashed border-border bg-muted/50">
          <CardContent className="flex flex-col items-center justify-center space-y-4 py-16">
            <div className="rounded-full bg-muted p-4">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2 text-center">
              <h3 className="text-lg font-medium text-card-foreground">
                No students found
              </h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Try adjusting your search filters or add some students to get
                started.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-3 px-4 py-2">
      {data.map((student) => {
        // Extract data from new structure
        const studentName = student.person.name
        const email =
          student.person.contactPoints.find((cp) => cp.type === 'EMAIL')
            ?.value || null
        const phone =
          student.person.contactPoints.find((cp) => cp.type === 'PHONE')
            ?.value || null
        const currentBatch = student.enrollments?.[0]?.batch
        const activeAssignment = student.assignments?.[0]
        const subscriptionStatus =
          activeAssignment?.subscription?.status || null
        const stripeSubscriptionId =
          activeAssignment?.subscription?.stripeSubscriptionId || null

        // Get enrollment status from latest enrollment
        const enrollmentStatus =
          student.enrollments?.[0]?.status || 'registered'
        const statusConfig = getStatusConfig(enrollmentStatus)
        const subscriptionConfig = getSubscriptionConfig(subscriptionStatus)
        const StatusIcon = statusConfig.icon
        const SubscriptionIcon = subscriptionConfig.icon

        return (
          <Card
            key={student.id}
            className="border-border bg-card shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98]"
          >
            <CardContent className="p-4">
              {/* Header Section */}
              <div className="mb-3 flex items-start justify-between">
                <div className="flex flex-1 items-center space-x-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold leading-tight text-card-foreground">
                      {studentName}
                    </h3>
                    {currentBatch && (
                      <div className="mt-1 flex items-center">
                        <GraduationCap className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">
                          {currentBatch.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <Badge
                  className={`${statusConfig.className} flex-shrink-0 px-2.5 py-1 text-xs font-medium`}
                >
                  <StatusIcon className="mr-1 h-3 w-3" />
                  {enrollmentStatus}
                </Badge>
              </div>

              {/* Contact Section */}
              <div className="mb-4 space-y-2 rounded-lg bg-muted/50 p-3">
                {email ? (
                  <div className="flex items-center space-x-2">
                    <Mail className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium text-card-foreground">
                      {email}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Mail className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50" />
                    <span className="text-sm italic text-muted-foreground">
                      No email address
                    </span>
                  </div>
                )}
                {phone ? (
                  <div className="flex items-center space-x-2">
                    <Phone className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <span className="text-sm font-medium text-card-foreground">
                      {phone}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Phone className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50" />
                    <span className="text-sm italic text-muted-foreground">
                      No phone number
                    </span>
                  </div>
                )}
              </div>

              {/* Subscription Status and Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {stripeSubscriptionId ? (
                    <>
                      <Badge
                        className={`${subscriptionConfig.className} px-2 py-0.5 text-xs font-medium`}
                      >
                        <SubscriptionIcon className="mr-1 h-3 w-3" />
                        {subscriptionStatus}
                      </Badge>
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-accent"
                      >
                        <Link
                          href={`https://dashboard.stripe.com/subscriptions/${stripeSubscriptionId}`}
                          target="_blank"
                        >
                          <ExternalLink className="h-3 w-3 text-primary" />
                          <span className="sr-only">View in Stripe</span>
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <Badge className="border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <AlertCircle className="mr-1 h-3 w-3" />
                      No Sub
                    </Badge>
                  )}
                </div>
                <PaymentHistoryDialog
                  payments={student.payments}
                  studentId={student.id}
                  studentName={studentName}
                  subscriptionSiblings={[]}
                  trigger={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 border-border bg-background px-3 py-1 text-xs font-medium hover:bg-accent"
                    >
                      Payments ({student.payments.length})
                    </Button>
                  }
                />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
