/**
 * Family Detail Sheet Component
 *
 * Full-screen sheet displaying comprehensive family information including
 * status, contact details, children, payment information, and actions.
 *
 * Shared by both FamilyGridView and FamilyTableView.
 */

'use client'

import { useState } from 'react'

import {
  CreditCard,
  ExternalLink,
  Send,
  Mail,
  Phone,
  Copy,
  ShieldCheck,
  Edit,
  UserPlus,
  Wallet,
  Trash2,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { SHIFT_BADGES, SHIFT_COLORS } from '@/lib/constants/dugsi'

import { FamilyStatusBadge } from './family-status-badge'
import { useActionHandler } from '../../_hooks/use-action-handler'
import { Family } from '../../_types'
import { getFamilyStatus } from '../../_utils/family'
import { formatParentName, hasSecondParent } from '../../_utils/format'
import { setPrimaryPayer, updateFamilyShift } from '../../actions'
import { AddChildDialog } from '../dialogs/add-child-dialog'
import { DeleteFamilyDialog } from '../dialogs/delete-family-dialog'
import { EditChildDialog } from '../dialogs/edit-child-dialog'
import { EditParentDialog } from '../dialogs/edit-parent-dialog'
import { PaymentLinkDialog } from '../dialogs/payment-link-dialog'
import { ChildInfoCard } from '../ui/child-info-card'

interface FamilyDetailSheetProps {
  family: Family | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onFamilyUpdate?: (shift: 'MORNING' | 'AFTERNOON') => void
  onVerifyBankAccount?: (paymentIntentId: string, parentEmail: string) => void
}

export function FamilyDetailSheet({
  family,
  open,
  onOpenChange,
  onFamilyUpdate,
  onVerifyBankAccount,
}: FamilyDetailSheetProps) {
  const [editParentDialog, setEditParentDialog] = useState<{
    open: boolean
    parentNumber: 1 | 2
    isAdding: boolean
  }>({
    open: false,
    parentNumber: 1,
    isAdding: false,
  })

  const [editChildDialog, setEditChildDialog] = useState<{
    open: boolean
    studentId: string | null
  }>({
    open: false,
    studentId: null,
  })

  const [addChildDialog, setAddChildDialog] = useState(false)
  const [paymentLinkDialog, setPaymentLinkDialog] = useState(false)
  const [deleteFamilyDialog, setDeleteFamilyDialog] = useState(false)
  const [isShiftPopoverOpen, setIsShiftPopoverOpen] = useState(false)

  const { execute: executeSetPrimaryPayer, isPending: isSettingPrimaryPayer } =
    useActionHandler(setPrimaryPayer)

  const { execute: executeUpdateFamilyShift, isPending: isUpdatingShift } =
    useActionHandler(updateFamilyShift, {
      successMessage: 'Family shift updated successfully!',
    })

  if (!family) return null

  const firstMember = family.members[0]
  if (!firstMember) return null

  const handleVerifyBank = () => {
    const paymentIntentId = family.members[0]?.paymentIntentIdDugsi
    const parentEmail = family.parentEmail

    if (paymentIntentId && parentEmail && onVerifyBankAccount) {
      onVerifyBankAccount(paymentIntentId, parentEmail)
    }
  }

  const handleViewInStripe = () => {
    const customerId = family.members[0]?.stripeCustomerIdDugsi
    if (customerId) {
      const stripeUrl = `https://dashboard.stripe.com/customers/${customerId}`
      window.open(stripeUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const handleSendPaymentLink = () => {
    setPaymentLinkDialog(true)
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const copyToClipboardAsync = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied to clipboard`)
    } catch (err) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const handleEditParent1 = () => {
    setEditParentDialog({ open: true, parentNumber: 1, isAdding: false })
  }

  const handleEditParent2 = () => {
    setEditParentDialog({ open: true, parentNumber: 2, isAdding: false })
  }

  const handleAddSecondParent = () => {
    setEditParentDialog({ open: true, parentNumber: 2, isAdding: true })
  }

  const handleSetPrimaryPayer = (parentNumber: 1 | 2) => {
    executeSetPrimaryPayer({
      studentId: firstMember.id,
      parentNumber,
    })
  }

  const handleEditChild = (studentId: string) => {
    setEditChildDialog({ open: true, studentId })
  }

  const handleShiftChange = async (shift: 'MORNING' | 'AFTERNOON') => {
    if (firstMember.familyReferenceId) {
      setIsShiftPopoverOpen(false)
      await executeUpdateFamilyShift({
        familyReferenceId: firstMember.familyReferenceId,
        shift,
      })
      if (onFamilyUpdate) {
        onFamilyUpdate(shift)
      }
    }
  }

  const currentEditChild = family.members.find(
    (m) => m.id === editChildDialog.studentId
  )

  // Format sheet title with both parents if second parent exists
  const getSheetTitle = () => {
    const firstParentName = formatParentName(
      family.members[0]?.parentFirstName,
      family.members[0]?.parentLastName
    )

    if (family.members[0] && hasSecondParent(family.members[0])) {
      const secondParentName = formatParentName(
        family.members[0].parent2FirstName,
        family.members[0].parent2LastName
      )
      return `${firstParentName} & ${secondParentName}`
    }

    return firstParentName
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b pb-4">
          <SheetTitle>{getSheetTitle()}</SheetTitle>
          <SheetDescription>Family details and information</SheetDescription>
          {/* Family Status Badges */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            <FamilyStatusBadge status={getFamilyStatus(family)} />
            {family.members[0] && hasSecondParent(family.members[0]) && (
              <Badge variant="outline" className="px-1.5 text-xs">
                2 Parents
              </Badge>
            )}
            {family.members[0]?.stripeCustomerIdDugsi && (
              <Badge variant="outline" className="px-1.5 text-xs">
                <CreditCard className="mr-1 h-3 w-3" />
                Customer
              </Badge>
            )}

            {/* Shift Badge with Popover */}
            {firstMember && (
              <Popover
                open={isShiftPopoverOpen}
                onOpenChange={setIsShiftPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Badge
                    variant="outline"
                    className={`cursor-pointer ${firstMember.shift ? SHIFT_BADGES[firstMember.shift].className : 'border-dashed'} ${isUpdatingShift ? 'cursor-not-allowed opacity-50' : ''}`}
                    role="button"
                    aria-label={
                      firstMember.shift
                        ? `Change shift from ${SHIFT_BADGES[firstMember.shift].label}`
                        : 'Set family shift'
                    }
                    aria-busy={isUpdatingShift}
                    tabIndex={0}
                  >
                    {isUpdatingShift && (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    )}
                    {firstMember.shift
                      ? SHIFT_BADGES[firstMember.shift].label
                      : 'Set Shift'}
                  </Badge>
                </PopoverTrigger>
                <PopoverContent className="w-48" align="start">
                  <div className="space-y-1">
                    <p className="pb-2 text-xs font-medium text-muted-foreground">
                      Select Family Shift
                    </p>
                    <button
                      onClick={() => handleShiftChange('MORNING')}
                      disabled={isUpdatingShift}
                      className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      <div
                        className={`h-2 w-2 rounded-full ${SHIFT_COLORS.MORNING}`}
                      />
                      <span>Morning</span>
                    </button>
                    <button
                      onClick={() => handleShiftChange('AFTERNOON')}
                      disabled={isUpdatingShift}
                      className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      <div
                        className={`h-2 w-2 rounded-full ${SHIFT_COLORS.AFTERNOON}`}
                      />
                      <span>Afternoon</span>
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          {/* Contact Information */}
          {family.members[0] && (
            <div className="space-y-4 rounded-lg border bg-card p-5">
              <h3 className="text-base font-semibold">Contact Information</h3>
              <div className="space-y-4 pt-1">
                {/* Parent 1 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        1
                      </div>
                      <span className="font-medium">
                        {formatParentName(
                          firstMember.parentFirstName,
                          firstMember.parentLastName
                        )}
                      </span>
                      {firstMember.primaryPayerParentNumber === 1 && (
                        <Badge variant="outline" className="text-xs">
                          <Wallet className="mr-1 h-3 w-3" />
                          Primary Payer
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {firstMember.primaryPayerParentNumber !== 1 &&
                        hasSecondParent(firstMember) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetPrimaryPayer(1)}
                            disabled={isSettingPrimaryPayer}
                            className="h-7 px-2 text-xs"
                          >
                            Set as Payer
                          </Button>
                        )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleEditParent1}
                        className="h-7 px-2"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {firstMember.parentEmail && (
                    <div className="ml-8 flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <a
                        href={`mailto:${firstMember.parentEmail}`}
                        className="truncate hover:text-[#007078] hover:underline"
                      >
                        {firstMember.parentEmail}
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0"
                        onClick={() =>
                          firstMember.parentEmail &&
                          copyToClipboardAsync(
                            firstMember.parentEmail,
                            'Email address'
                          )
                        }
                        aria-label="Copy email address"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {firstMember.parentPhone && (
                    <div className="ml-8 flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <a
                        href={`https://wa.me/${firstMember.parentPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[#007078] hover:underline"
                      >
                        {firstMember.parentPhone}
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0"
                        onClick={() =>
                          firstMember.parentPhone &&
                          copyToClipboardAsync(
                            firstMember.parentPhone,
                            'Phone number'
                          )
                        }
                        aria-label="Copy phone number"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Parent 2 */}
                {hasSecondParent(firstMember) ? (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            2
                          </div>
                          <span className="font-medium">
                            {formatParentName(
                              firstMember.parent2FirstName,
                              firstMember.parent2LastName
                            )}
                          </span>
                          {firstMember.primaryPayerParentNumber === 2 && (
                            <Badge variant="outline" className="text-xs">
                              <Wallet className="mr-1 h-3 w-3" />
                              Primary Payer
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {firstMember.primaryPayerParentNumber !== 2 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetPrimaryPayer(2)}
                              disabled={isSettingPrimaryPayer}
                              className="h-7 px-2 text-xs"
                            >
                              Set as Payer
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleEditParent2}
                            className="h-7 px-2"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {firstMember.parent2Email && (
                        <div className="ml-8 flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <a
                            href={`mailto:${firstMember.parent2Email}`}
                            className="truncate hover:text-[#007078] hover:underline"
                          >
                            {firstMember.parent2Email}
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            onClick={() =>
                              firstMember.parent2Email &&
                              copyToClipboardAsync(
                                firstMember.parent2Email,
                                'Email address'
                              )
                            }
                            aria-label="Copy email address"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {firstMember.parent2Phone && (
                        <div className="ml-8 flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <a
                            href={`https://wa.me/${firstMember.parent2Phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-[#007078] hover:underline"
                          >
                            {firstMember.parent2Phone}
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            onClick={() =>
                              firstMember.parent2Phone &&
                              copyToClipboardAsync(
                                firstMember.parent2Phone,
                                'Phone number'
                              )
                            }
                            aria-label="Copy phone number"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <Separator />
                    <div className="flex items-center justify-center pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleAddSecondParent}
                        className="h-8 px-3"
                      >
                        <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                        Add Parent 2
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Kids Details */}
          <div className="space-y-4 rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">
                Kids ({family.members.length})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAddChildDialog(true)}
                className="h-8 px-2 sm:px-3"
              >
                <UserPlus className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Add Child</span>
              </Button>
            </div>
            <div className="space-y-2.5 pt-1">
              {family.members.map((child, index) => (
                <ChildInfoCard
                  key={child.id}
                  child={child}
                  index={index}
                  editButton={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditChild(child.id)}
                      className="h-7 px-2"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
              ))}
            </div>
          </div>

          {/* Payment Details */}
          {family.members[0]?.stripeCustomerIdDugsi && (
            <div className="space-y-4 rounded-lg border bg-card p-5">
              <h3 className="text-base font-semibold">Payment Details</h3>
              <div className="space-y-3 pt-1 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Customer ID:</span>
                  <div className="flex items-center gap-1.5">
                    <code className="rounded-md bg-muted/80 px-2.5 py-1 font-mono text-xs">
                      {family.members[0].stripeCustomerIdDugsi.slice(0, 16)}...
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() =>
                        family.members[0]?.stripeCustomerIdDugsi &&
                        copyToClipboard(
                          family.members[0].stripeCustomerIdDugsi,
                          'Customer ID'
                        )
                      }
                      aria-label="Copy customer ID"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {family.members[0]?.stripeSubscriptionIdDugsi && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Subscription:</span>
                    <div className="flex items-center gap-1.5">
                      <code className="rounded-md bg-muted/80 px-2.5 py-1 font-mono text-xs">
                        {family.members[0].stripeSubscriptionIdDugsi.slice(
                          0,
                          16
                        )}
                        ...
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() =>
                          family.members[0]?.stripeSubscriptionIdDugsi &&
                          copyToClipboard(
                            family.members[0].stripeSubscriptionIdDugsi,
                            'Subscription ID'
                          )
                        }
                        aria-label="Copy subscription ID"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
                {family.members[0]?.paidUntil && (
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="font-medium text-muted-foreground">
                      Next Billing:
                    </span>
                    <span className="text-sm font-medium">
                      {new Date(family.members[0].paidUntil).toLocaleDateString(
                        'en-US',
                        {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3 border-t pt-5">
            {/* Primary Actions */}
            {family.hasPayment &&
              (family.members[0]?.subscriptionStatus !== 'active' ||
                !family.hasSubscription) &&
              family.members[0]?.paymentIntentIdDugsi &&
              family.parentEmail && (
                <Button
                  className="w-full"
                  variant="default"
                  onClick={handleVerifyBank}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Verify Bank Account
                </Button>
              )}

            {/* Communication Actions */}
            <div className="space-y-2">
              <Button
                className="w-full"
                variant="outline"
                onClick={handleSendPaymentLink}
              >
                <Send className="mr-2 h-4 w-4" />
                Send Payment Link
              </Button>
              <Button className="w-full" variant="outline">
                <Mail className="mr-2 h-4 w-4" />
                Send Email
              </Button>
            </div>

            {/* External Actions */}
            {family.members[0]?.stripeCustomerIdDugsi && (
              <Button
                className="w-full"
                variant="outline"
                onClick={handleViewInStripe}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View in Stripe
              </Button>
            )}

            {/* Danger Zone */}
            <div className="pt-4">
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setDeleteFamilyDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                <span className="text-red-500">Delete Family</span>
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>

      {/* Edit Parent Dialog */}
      <EditParentDialog
        open={editParentDialog.open}
        onOpenChange={(open) =>
          setEditParentDialog((prev) => ({ ...prev, open }))
        }
        studentId={firstMember.id}
        parentNumber={editParentDialog.parentNumber}
        currentData={
          editParentDialog.parentNumber === 1
            ? {
                firstName: firstMember.parentFirstName,
                lastName: firstMember.parentLastName,
                email: firstMember.parentEmail,
                phone: firstMember.parentPhone,
              }
            : {
                firstName: firstMember.parent2FirstName,
                lastName: firstMember.parent2LastName,
                email: firstMember.parent2Email,
                phone: firstMember.parent2Phone,
              }
        }
        isAddingSecondParent={editParentDialog.isAdding}
      />

      {/* Edit Child Dialog */}
      {currentEditChild && (
        <EditChildDialog
          open={editChildDialog.open}
          onOpenChange={(open) =>
            setEditChildDialog((prev) => ({ ...prev, open }))
          }
          studentId={currentEditChild.id}
          currentData={{
            name: currentEditChild.name,
            gender: currentEditChild.gender || 'MALE',
            dateOfBirth: currentEditChild.dateOfBirth,
            gradeLevel: currentEditChild.gradeLevel || '',
            schoolName: currentEditChild.schoolName,
            healthInfo: currentEditChild.healthInfo,
          }}
        />
      )}

      {/* Add Child Dialog */}
      <AddChildDialog
        open={addChildDialog}
        onOpenChange={setAddChildDialog}
        existingStudentId={firstMember.id}
      />

      {/* Payment Link Dialog */}
      <PaymentLinkDialog
        family={family}
        open={paymentLinkDialog}
        onOpenChange={setPaymentLinkDialog}
      />

      {/* Delete Family Dialog */}
      {deleteFamilyDialog && (
        <DeleteFamilyDialog
          studentId={firstMember.id}
          familyName={getSheetTitle()}
          hasActiveSubscription={
            family.hasSubscription &&
            family.members[0]?.subscriptionStatus === 'active'
          }
          open={deleteFamilyDialog}
          onOpenChange={setDeleteFamilyDialog}
          onSuccess={() => onOpenChange(false)}
        />
      )}
    </Sheet>
  )
}
