import Link from 'next/link'

import { ExternalLink, User } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { StudentWithDetails } from '@/types'

import { PaymentHistoryDialog } from './payment-history-dialog'
import { getStatusConfig, getSubscriptionConfig } from '../utils/status-config'

interface StudentsDataTableProps {
  data: StudentWithDetails[]
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
