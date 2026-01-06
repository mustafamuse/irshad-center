'use client'

import { useState } from 'react'

import { StudentPayment } from '@prisma/client'
import { format } from 'date-fns'
import {
  CreditCard,
  Check,
  DollarSign,
  Calendar,
  X,
  Minus,
  Clock,
  Users,
  ExternalLink,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface PaymentHistoryDialogProps {
  payments: StudentPayment[]
  studentId: string
  studentName: string
  trigger?: React.ReactNode
  subscriptionSiblings?: Array<{
    id: string
    name: string
  }>
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export function PaymentHistoryDialog({
  payments,
  studentId,
  studentName,
  trigger,
  subscriptionSiblings,
}: PaymentHistoryDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [showManualPayment, setShowManualPayment] = useState(false)
  const [manualPaymentMonth, setManualPaymentMonth] = useState<number | null>(
    null
  )
  const [manualPaymentAmount, setManualPaymentAmount] = useState('')
  const [applyToSubscriptionMembers, setApplyToSubscriptionMembers] =
    useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const totalPayments = payments.length
  const totalAmount =
    payments.reduce((sum, payment) => sum + Number(payment.amountPaid), 0) / 100

  // Get current year or most recent payment year
  const currentYear = new Date().getFullYear()
  const displayYear =
    payments.length > 0 ? Math.max(...payments.map((p) => p.year)) : currentYear

  // Group payments by month for the display year
  const paymentsByMonth = payments
    .filter((payment) => payment.year === displayYear)
    .reduce(
      (acc, payment) => {
        const monthIndex = payment.month - 1 // Convert to 0-based index
        if (!acc[monthIndex]) {
          acc[monthIndex] = []
        }
        acc[monthIndex].push(payment)
        return acc
      },
      {} as Record<number, StudentPayment[]>
    )

  const getMonthStatus = (monthIndex: number) => {
    const payments = paymentsByMonth[monthIndex]
    if (!payments || payments.length === 0) return 'unpaid'
    return 'paid' // All StudentPayments are successful payments
  }

  const handleMarkAsPaid = (monthIndex: number) => {
    setManualPaymentMonth(monthIndex)
    setManualPaymentAmount('150') // Default amount, user can edit
    setApplyToSubscriptionMembers(false)
    setShowManualPayment(true)
  }

  const handleMonthClick = (monthIndex: number) => {
    const status = getMonthStatus(monthIndex)
    if (status === 'unpaid') {
      handleMarkAsPaid(monthIndex)
    } else {
      setSelectedMonth(selectedMonth === monthIndex ? null : monthIndex)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <Check className="h-3 w-3" />
      case 'pending':
        return <Clock className="h-3 w-3" />
      case 'failed':
        return <X className="h-3 w-3" />
      default:
        return <Minus className="h-3 w-3" />
    }
  }

  const getMonthStyles = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-50 border-green-200 text-green-700 shadow-green-100 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
      case 'pending':
        return 'bg-amber-50 border-amber-200 text-amber-700 shadow-amber-100 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300'
      case 'failed':
        return 'bg-red-50 border-red-200 text-red-700 shadow-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
      default:
        return 'bg-muted border-border text-muted-foreground'
    }
  }

  const defaultTrigger = (
    <Button
      variant="outline"
      size="sm"
      className="border-border bg-card text-card-foreground hover:bg-accent"
    >
      <CreditCard className="mr-2 h-4 w-4" />
      Payments ({totalPayments})
    </Button>
  )

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="border-border bg-card text-card-foreground sm:max-w-xl">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-lg font-semibold text-card-foreground">
            Payment History - {studentName}
          </DialogTitle>
          {subscriptionSiblings && subscriptionSiblings.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>
                Shares subscription with:{' '}
                {subscriptionSiblings.map((member, index) => (
                  <span key={member.id}>
                    {member.name}
                    {index < subscriptionSiblings.length - 1 && ', '}
                  </span>
                ))}
              </span>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Compact Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Total Payments
              </div>
              <div className="text-2xl font-bold text-card-foreground">
                {totalPayments}
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Total Amount
              </div>
              <div className="text-2xl font-bold text-card-foreground">
                ${totalAmount.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Calendar Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-card-foreground">
                {displayYear}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-green-400"></div>
                <span>Paid</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-muted-foreground"></div>
                <span>No Payment</span>
              </div>
            </div>
          </div>

          {/* Compact Month Grid */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {MONTHS.map((month, index) => {
              const status = getMonthStatus(index)
              const monthPayments = paymentsByMonth[index] || []
              const isSelected = selectedMonth === index
              const totalMonthAmount = monthPayments.reduce(
                (sum, payment) => sum + Number(payment.amountPaid) / 100,
                0
              )

              return (
                <button
                  key={month}
                  className={`relative rounded-xl border p-3 transition-all duration-200 active:scale-95 ${getMonthStyles(status)} ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''} ${status === 'unpaid' ? 'hover:border-blue-300 hover:ring-2 hover:ring-blue-300' : ''} hover:shadow-md active:shadow-sm`}
                  onClick={() => handleMonthClick(index)}
                  title={
                    status === 'unpaid'
                      ? 'Click to mark as paid'
                      : 'View payment details'
                  }
                >
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-xs font-medium">{month}</div>
                    <div className="flex items-center justify-center">
                      {getStatusIcon(status)}
                    </div>
                    {monthPayments.length > 0 && (
                      <div className="text-[10px] opacity-75">
                        ${totalMonthAmount.toFixed(0)}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Selected Month Details */}
          {selectedMonth !== null && paymentsByMonth[selectedMonth] && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 duration-200 animate-in slide-in-from-top-2">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-card-foreground">
                  {MONTHS[selectedMonth]} {displayYear}
                </h3>
                <button
                  onClick={() => setSelectedMonth(null)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-card-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {paymentsByMonth[selectedMonth].map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-card-foreground">
                          {format(new Date(payment.paidAt), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(payment.paidAt), 'h:mm a')} •
                          {payment.stripeInvoiceId
                            ? 'Stripe payment'
                            : 'Zelle payment'}{' '}
                          for {MONTHS[payment.month - 1]} {payment.year}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-card-foreground">
                        ${(Number(payment.amountPaid) / 100).toLocaleString()}
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <div className="text-xs text-green-600 dark:text-green-400">
                          Paid
                        </div>
                        {payment.stripeInvoiceId && (
                          <a
                            href={`https://dashboard.stripe.com/invoices/${payment.stripeInvoiceId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Stripe
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Payments State */}
          {payments.length === 0 && (
            <Card className="border border-dashed border-border bg-muted/50">
              <CardContent className="flex flex-col items-center justify-center space-y-4 py-8">
                <div className="rounded-full bg-muted p-3">
                  <CreditCard className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="space-y-2 text-center">
                  <h3 className="text-sm font-medium text-card-foreground">
                    No payment history
                  </h3>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    This student hasn't made any payments yet. Once they do,
                    their payment history will appear here.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>

      {/* Manual Payment Dialog */}
      <Dialog open={showManualPayment} onOpenChange={setShowManualPayment}>
        <DialogContent className="border-border bg-card text-card-foreground sm:max-w-md">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="text-lg font-semibold text-card-foreground">
              Record Zelle Payment -{' '}
              {manualPaymentMonth !== null ? MONTHS[manualPaymentMonth] : ''}{' '}
              {displayYear}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label
                htmlFor="amount"
                className="text-sm font-medium text-card-foreground"
              >
                Amount Paid ($)
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={manualPaymentAmount}
                onChange={(e) => setManualPaymentAmount(e.target.value)}
                placeholder="150.00"
                className="border-border bg-background text-card-foreground"
              />
            </div>

            {subscriptionSiblings && subscriptionSiblings.length > 0 && (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-sm font-medium text-card-foreground">
                  Subscription Members
                </div>
                <div className="text-sm text-muted-foreground">
                  {studentName} shares a subscription with:{' '}
                  {subscriptionSiblings.map((m) => m.name).join(', ')}
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="apply-to-members"
                    checked={applyToSubscriptionMembers}
                    onCheckedChange={(checked) =>
                      setApplyToSubscriptionMembers(checked === true)
                    }
                  />
                  <Label
                    htmlFor="apply-to-members"
                    className="text-sm text-card-foreground"
                  >
                    Apply this payment to all subscription members
                  </Label>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowManualPayment(false)}
                className="border-border text-card-foreground hover:bg-accent"
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (
                    manualPaymentMonth === null ||
                    !manualPaymentAmount ||
                    isSubmitting
                  )
                    return

                  setIsSubmitting(true)
                  try {
                    const response = await fetch(
                      `/api/admin/students/${studentId}/manual-payment`,
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          month: manualPaymentMonth + 1, // Convert from 0-based to 1-based
                          year: displayYear,
                          amount: manualPaymentAmount,
                          applyToSubscriptionMembers,
                        }),
                      }
                    )

                    if (response.ok) {
                      setShowManualPayment(false)
                      // Refresh the page to show the new payment
                      window.location.reload()
                    } else {
                      const error = await response.json()
                      console.error('Payment creation failed:', error.error)
                    }
                  } catch (error) {
                    console.error('Failed to create Zelle payment:', error)
                  } finally {
                    setIsSubmitting(false)
                  }
                }}
                disabled={isSubmitting || !manualPaymentAmount}
                className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting ? 'Recording...' : 'Record Payment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
