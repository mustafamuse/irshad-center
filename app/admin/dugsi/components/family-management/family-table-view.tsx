'use client'

import { useState } from 'react'

import {
  AlertCircle,
  ExternalLink,
  Mail,
  Copy,
  ShieldCheck,
  Users,
  CheckCircle,
  XCircle,
  Phone,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { GenderDisplay } from '@/components/ui/gender-display'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  formatEducationLevel,
  formatGradeLevel,
} from '@/lib/utils/enum-formatters'

import { FamilyStatusBadge } from './family-status-badge'
import { Family } from '../../_types'
import { getFamilyStatus } from '../../_utils/family'
import { formatParentName, hasSecondParent } from '../../_utils/format'
import { useDugsiUIStore } from '../../store'
import { VerifyBankDialog } from '../dialogs/verify-bank-dialog'
import { ParentInfo } from '../ui/parent-info'

interface FamilyTableViewProps {
  families: Family[]
}

export function FamilyTableView({ families }: FamilyTableViewProps) {
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  // Zustand store selectors
  const isVerifyBankDialogOpen = useDugsiUIStore(
    (state) => state.isVerifyBankDialogOpen
  )
  const verifyBankDialogData = useDugsiUIStore(
    (state) => state.verifyBankDialogData
  )
  const setDialogOpen = useDugsiUIStore((state) => state.setDialogOpen)
  const setVerifyBankDialogData = useDugsiUIStore(
    (state) => state.setVerifyBankDialogData
  )

  const handleRowClick = (family: Family) => {
    setSelectedFamily(family)
    setIsSheetOpen(true)
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied to clipboard`)
    } catch (err) {
      toast.error('Failed to copy to clipboard')
    }
  }

  if (families.length === 0) {
    return (
      <EmptyState
        icon={<Users />}
        title="No families found"
        description="No families match the current filters"
      />
    )
  }

  return (
    <TooltipProvider>
      {/* Mobile Card Layout */}
      <div className="block space-y-4 lg:hidden">
        {families.map((family) => {
          const parentName = formatParentName(
            family.members[0]?.parentFirstName,
            family.members[0]?.parentLastName
          )
          const status = getFamilyStatus(family)
          const hasSecond = hasSecondParent(family.members[0])

          return (
            <div
              key={family.familyKey}
              className="cursor-pointer rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
              onClick={() => handleRowClick(family)}
            >
              {/* Parent Name and Family Info */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{parentName}</h3>
                <Badge variant="outline" className="text-xs">
                  {hasSecond ? '2 Parents' : '1 Parent'}
                </Badge>
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Users className="h-3 w-3" />
                  {family.members.length}{' '}
                  {family.members.length === 1 ? 'Student' : 'Students'}
                </Badge>
              </div>

              {/* Combined Status */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    Payment:
                  </span>
                  {family.hasPayment ? (
                    <Badge
                      variant="outline"
                      className="gap-1 border-green-600 text-green-600"
                    >
                      <CheckCircle className="h-3 w-3" />
                      Paid
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="gap-1 border-red-600 text-red-600"
                    >
                      <XCircle className="h-3 w-3" />
                      Unpaid
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  <FamilyStatusBadge status={status} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden rounded-md border lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Parent Name</TableHead>
              <TableHead># Students</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {families.map((family) => {
              const parentName = formatParentName(
                family.members[0]?.parentFirstName,
                family.members[0]?.parentLastName
              )
              const status = getFamilyStatus(family)
              const hasSecond = hasSecondParent(family.members[0])

              return (
                <TableRow
                  key={family.familyKey}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(family)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{parentName}</span>
                      {hasSecond && (
                        <Badge variant="outline" className="text-xs">
                          2 Parents
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="gap-1">
                      <Users className="h-3 w-3" />
                      {family.members.length}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="inline-flex">
                          {family.hasPayment ? (
                            <Badge
                              variant="outline"
                              className="gap-1 border-green-600 text-green-600"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="gap-1 border-red-600 text-red-600"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Badge>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {family.hasPayment
                            ? 'Payment Captured'
                            : 'No Payment'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <FamilyStatusBadge status={status} showLabel={false} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRowClick(family)
                      }}
                    >
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Family Details Sheet */}
      {selectedFamily && (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
            <SheetHeader>
              <SheetTitle>
                {formatParentName(
                  selectedFamily.members[0]?.parentFirstName,
                  selectedFamily.members[0]?.parentLastName
                )}{' '}
                Family
              </SheetTitle>
              <SheetDescription>Family details and management</SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Family Status */}
              <div className="flex items-center gap-2">
                <FamilyStatusBadge
                  status={getFamilyStatus(selectedFamily)}
                  showIcon
                />
              </div>

              {/* Verify Bank Account - High Priority Action */}
              {selectedFamily.hasPayment &&
                (selectedFamily.members[0]?.subscriptionStatus !== 'active' ||
                  !selectedFamily.hasSubscription) &&
                selectedFamily.members[0]?.paymentIntentIdDugsi &&
                selectedFamily.parentEmail && (
                  <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                      <h3 className="font-semibold text-amber-900">
                        Bank Account Verification Required
                      </h3>
                    </div>
                    <p className="mb-4 text-sm text-amber-800">
                      This family needs to verify their bank account to complete
                      the subscription setup.
                    </p>
                    <Button
                      className="w-full bg-amber-600 hover:bg-amber-700"
                      onClick={() => {
                        setVerifyBankDialogData({
                          paymentIntentId:
                            selectedFamily.members[0]?.paymentIntentIdDugsi ||
                            '',
                          parentEmail: selectedFamily.parentEmail || '',
                        })
                        setDialogOpen('verifyBank', true)
                      }}
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Verify Bank Account Now
                    </Button>
                  </div>
                )}

              {/* Contact Information */}
              {selectedFamily.members[0] && (
                <div className="space-y-4 rounded-lg border p-4">
                  <h3 className="font-semibold">Contact Information</h3>

                  {/* Parent 1 */}
                  <div>
                    {hasSecondParent(selectedFamily.members[0]) && (
                      <div className="mb-2 text-sm font-medium text-muted-foreground">
                        Parent 1
                      </div>
                    )}
                    <ParentInfo
                      registration={selectedFamily.members[0]}
                      showEmail={true}
                      showPhone={true}
                      showSecondParentBadge={false}
                    />
                  </div>

                  {/* Parent 2 */}
                  {hasSecondParent(selectedFamily.members[0]) && (
                    <div className="border-t pt-4">
                      <div className="mb-2 text-sm font-medium text-muted-foreground">
                        Parent 2
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {formatParentName(
                              selectedFamily.members[0].parent2FirstName,
                              selectedFamily.members[0].parent2LastName
                            )}
                          </span>
                        </div>

                        {selectedFamily.members[0].parent2Email && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            <a
                              href={`mailto:${selectedFamily.members[0].parent2Email}`}
                              className="truncate hover:text-[#007078] hover:underline"
                            >
                              {selectedFamily.members[0].parent2Email}
                            </a>
                          </div>
                        )}

                        {selectedFamily.members[0].parent2Phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            <a
                              href={`https://wa.me/${selectedFamily.members[0].parent2Phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-[#007078] hover:underline"
                            >
                              {selectedFamily.members[0].parent2Phone}
                            </a>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => {
                                if (selectedFamily.members[0]?.parent2Phone) {
                                  copyToClipboard(
                                    selectedFamily.members[0].parent2Phone,
                                    'Phone number'
                                  )
                                }
                              }}
                              aria-label="Copy phone number"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Children Details */}
              <div className="space-y-4 rounded-lg border p-4">
                <h3 className="font-semibold">
                  Children ({selectedFamily.members.length})
                </h3>
                <div className="space-y-3">
                  {selectedFamily.members.map((child, index) => (
                    <div
                      key={child.id}
                      className="flex items-start gap-3 rounded-lg bg-muted/30 p-3"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {index + 1}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            {child.name}
                          </span>
                          {child.gender && (
                            <GenderDisplay
                              gender={child.gender}
                              size="sm"
                              showLabel
                            />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {child.gradeLevel && (
                            <span className="font-medium">
                              {formatGradeLevel(child.gradeLevel)}
                            </span>
                          )}
                          {child.educationLevel && (
                            <>
                              <span className="text-muted-foreground/50">
                                •
                              </span>
                              <span>
                                {formatEducationLevel(child.educationLevel)}
                              </span>
                            </>
                          )}
                        </div>
                        {child.schoolName && (
                          <div className="text-xs text-muted-foreground">
                            {child.schoolName}
                          </div>
                        )}
                        {child.healthInfo &&
                          child.healthInfo.toLowerCase() !== 'none' && (
                            <div className="flex items-start gap-1.5 rounded-md bg-red-50 px-2 py-1">
                              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-600" />
                              <span className="text-xs text-red-600">
                                {child.healthInfo}
                              </span>
                            </div>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Details */}
              {selectedFamily.members[0]?.stripeCustomerIdDugsi && (
                <div className="space-y-4 rounded-lg border p-4">
                  <h3 className="font-semibold">Payment Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        Customer ID:
                      </span>
                      <div className="flex items-center gap-1">
                        <code className="rounded bg-muted px-2 py-0.5 text-xs">
                          {selectedFamily.members[0].stripeCustomerIdDugsi.slice(
                            0,
                            14
                          )}
                          ...
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            if (
                              selectedFamily.members[0]?.stripeCustomerIdDugsi
                            ) {
                              copyToClipboard(
                                selectedFamily.members[0].stripeCustomerIdDugsi,
                                'Customer ID'
                              )
                            }
                          }}
                          aria-label="Copy customer ID"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {selectedFamily.members[0]?.stripeSubscriptionIdDugsi && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          Subscription ID:
                        </span>
                        <div className="flex items-center gap-1">
                          <code className="rounded bg-muted px-2 py-0.5 text-xs">
                            {selectedFamily.members[0].stripeSubscriptionIdDugsi.slice(
                              0,
                              14
                            )}
                            ...
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              if (
                                selectedFamily.members[0]
                                  ?.stripeSubscriptionIdDugsi
                              ) {
                                copyToClipboard(
                                  selectedFamily.members[0]
                                    .stripeSubscriptionIdDugsi,
                                  'Subscription ID'
                                )
                              }
                            }}
                            aria-label="Copy subscription ID"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {selectedFamily.members[0]?.paymentIntentIdDugsi && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          Payment Intent ID:
                        </span>
                        <div className="flex items-center gap-1">
                          <code className="rounded bg-muted px-2 py-0.5 text-xs">
                            {selectedFamily.members[0].paymentIntentIdDugsi.slice(
                              0,
                              14
                            )}
                            ...
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              if (
                                selectedFamily.members[0]?.paymentIntentIdDugsi
                              ) {
                                copyToClipboard(
                                  selectedFamily.members[0]
                                    .paymentIntentIdDugsi,
                                  'Payment Intent ID'
                                )
                              }
                            }}
                            aria-label="Copy payment intent ID"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {selectedFamily.members[0]?.paymentMethodCaptured && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          Payment Method:
                        </span>
                        <Badge variant="outline" className="gap-1">
                          Captured
                        </Badge>
                      </div>
                    )}

                    {selectedFamily.members[0]?.subscriptionStatus && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          Subscription:
                        </span>
                        <Badge
                          variant={
                            selectedFamily.members[0].subscriptionStatus ===
                            'active'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {selectedFamily.members[0].subscriptionStatus}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* View in Stripe Button */}
                  {selectedFamily.members[0]?.stripeCustomerIdDugsi && (
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          const customerId =
                            selectedFamily.members[0]?.stripeCustomerIdDugsi
                          if (customerId) {
                            window.open(
                              `https://dashboard.stripe.com/customers/${customerId}`,
                              '_blank'
                            )
                          }
                        }}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View in Stripe Dashboard
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                {selectedFamily.parentEmail && (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      if (selectedFamily.parentEmail) {
                        window.location.href = `mailto:${selectedFamily.parentEmail}`
                      }
                    }}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Send Email
                  </Button>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Verify Bank Dialog */}
      {verifyBankDialogData && (
        <VerifyBankDialog
          open={isVerifyBankDialogOpen}
          onOpenChange={(open) => {
            setDialogOpen('verifyBank', open)
            if (!open) {
              setVerifyBankDialogData(null)
            }
          }}
          paymentIntentId={verifyBankDialogData.paymentIntentId}
          parentEmail={verifyBankDialogData.parentEmail}
        />
      )}
    </TooltipProvider>
  )
}
