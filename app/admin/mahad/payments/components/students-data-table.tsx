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

function EmptyState(): React.ReactElement {
  return (
    <TableRow className="bg-card">
      <TableCell colSpan={6} className="h-32 text-center">
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

function SubscriptionCell({
  subscriptionId,
  subscriptionStatus,
}: {
  subscriptionId: string | null
  subscriptionStatus: string | null
}): React.ReactElement {
  if (!subscriptionId) {
    return (
      <Badge
        variant="secondary"
        className="border-border bg-muted text-muted-foreground"
      >
        No Subscription
      </Badge>
    )
  }

  const config = getSubscriptionConfig(subscriptionStatus)
  const Icon = config.icon

  return (
    <div className="space-y-1">
      <Badge className={config.className}>
        <Icon className="mr-1 h-3 w-3" />
        {subscriptionStatus || 'Unknown'}
      </Badge>
      <div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-6 p-0 text-xs text-primary hover:bg-accent"
        >
          <Link
            href={`https://dashboard.stripe.com/subscriptions/${subscriptionId}`}
            target="_blank"
            className="flex items-center space-x-1"
          >
            <ExternalLink className="h-3 w-3" />
            <span>Stripe</span>
          </Link>
        </Button>
      </div>
    </div>
  )
}

function StudentRow({
  student,
}: {
  student: StudentWithDetails
}): React.ReactElement {
  const statusConfig = getStatusConfig(student.status)
  const StatusIcon = statusConfig.icon

  return (
    <TableRow className="bg-card transition-colors hover:bg-muted/50">
      <TableCell className="font-medium">
        <div className="flex items-center space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
            <User className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium text-card-foreground">
            {student.name}
          </span>
        </div>
      </TableCell>

      <TableCell>
        <div className="space-y-1">
          <div className="text-sm text-card-foreground">
            {student.email || 'No email'}
          </div>
          <div className="text-xs text-muted-foreground">
            {student.phone || 'No phone'}
          </div>
        </div>
      </TableCell>

      <TableCell>
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

      <TableCell>
        <Badge className={statusConfig.className}>
          <StatusIcon className="mr-1 h-3 w-3" />
          {student.status}
        </Badge>
      </TableCell>

      <TableCell>
        <SubscriptionCell
          subscriptionId={student.stripeSubscriptionId}
          subscriptionStatus={student.subscriptionStatus}
        />
      </TableCell>

      <TableCell>
        <PaymentHistoryDialog
          payments={student.StudentPayment}
          studentId={student.id}
          studentName={student.name}
          subscriptionSiblings={student.subscriptionMembers}
        />
      </TableCell>
    </TableRow>
  )
}

export function StudentsDataTable({
  data,
}: StudentsDataTableProps): React.ReactElement {
  if (data.length === 0) {
    return <EmptyState />
  }

  return (
    <>
      {data.map((student) => (
        <StudentRow key={student.id} student={student} />
      ))}
    </>
  )
}
