import Link from 'next/link'

import {
  ExternalLink,
  User,
  AlertCircle,
  CheckCircle,
  UserX,
  Clock,
  Zap,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { StudentWithDetails } from '@/types'

import { PaymentHistoryDialog } from './payment-history-dialog'

interface StudentsDataTableProps {
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

export function StudentsDataTable({ data }: StudentsDataTableProps) {
  if (data.length === 0) {
    return (
      <TableRow className="bg-card">
        <TableCell colSpan={6} className="h-32 bg-card text-center">
          <div className="flex flex-col items-center justify-center space-y-3">
            <User className="h-12 w-12 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-card-foreground">
                No students found
              </p>
              <p className="text-xs text-muted-foreground">
                Try adjusting your search filters
              </p>
            </div>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <>
      {data.map((student) => {
        const statusConfig = getStatusConfig(student.status)
        const subscriptionConfig = getSubscriptionConfig(
          student.subscriptionStatus
        )
        const StatusIcon = statusConfig.icon
        const SubscriptionIcon = subscriptionConfig.icon

        return (
          <TableRow
            key={student.id}
            className="bg-card transition-colors hover:bg-muted/50"
          >
            <TableCell className="bg-card font-medium">
              <div className="flex items-center space-x-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="font-medium text-card-foreground">
                    {student.name}
                  </div>
                </div>
              </div>
            </TableCell>

            <TableCell className="bg-card">
              <div className="space-y-1">
                <div className="text-sm text-card-foreground">
                  {student.email || 'No email'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {student.phone || 'No phone'}
                </div>
              </div>
            </TableCell>

            <TableCell className="bg-card">
              {student.Batch ? (
                <Badge
                  variant="outline"
                  className="border-border bg-muted/50 text-muted-foreground"
                >
                  {student.Batch.name}
                </Badge>
              ) : (
                <span className="text-sm text-muted-foreground">No batch</span>
              )}
            </TableCell>

            <TableCell className="bg-card">
              <Badge className={statusConfig.className}>
                <StatusIcon className="mr-1 h-3 w-3" />
                {student.status}
              </Badge>
            </TableCell>

            <TableCell className="bg-card">
              {student.stripeSubscriptionId ? (
                <div className="space-y-1">
                  <Badge className={subscriptionConfig.className}>
                    <SubscriptionIcon className="mr-1 h-3 w-3" />
                    {student.subscriptionStatus || 'Unknown'}
                  </Badge>
                  <div>
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-6 p-0 text-xs text-primary hover:bg-accent"
                    >
                      <Link
                        href={`https://dashboard.stripe.com/subscriptions/${student.stripeSubscriptionId}`}
                        target="_blank"
                        className="flex items-center space-x-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>Stripe</span>
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <Badge
                  variant="secondary"
                  className="border-border bg-muted text-muted-foreground"
                >
                  No Subscription
                </Badge>
              )}
            </TableCell>

            <TableCell className="bg-card">
              <PaymentHistoryDialog
                payments={student.StudentPayment}
                studentId={student.id}
                studentName={student.name}
                subscriptionSiblings={student.subscriptionMembers}
              />
            </TableCell>
          </TableRow>
        )
      })}
    </>
  )
}
