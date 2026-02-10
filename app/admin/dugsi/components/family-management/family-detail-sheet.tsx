'use client'

import { useRef } from 'react'

import { Shift } from '@prisma/client'
import {
  CreditCard,
  ExternalLink,
  Send,
  Mail,
  Pause,
  Play,
  ShieldCheck,
  Loader2,
  Link,
  Trash2,
  User,
  Receipt,
  Clock,
  MoreHorizontal,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SHIFT_BADGES, SHIFT_COLORS } from '@/lib/constants/dugsi'

import { OverviewTab, BillingTab, HistoryTab } from './detail-tabs'
import { FamilyStatusBadge } from './family-status-badge'
import { useActionHandler } from '../../_hooks/use-action-handler'
import { useSheetState, SheetTab } from '../../_hooks/use-sheet-state'
import { Family } from '../../_types'
import { getFamilyStatus } from '../../_utils/family'
import { getOrderedParentNames, hasSecondParent } from '../../_utils/format'
import {
  pauseFamilyBillingAction,
  resumeFamilyBillingAction,
  updateFamilyShift,
} from '../../actions'
import { AddChildDialog } from '../dialogs/add-child-dialog'
import { ConsolidateSubscriptionDialog } from '../dialogs/consolidate-subscription-dialog'
import { DeleteFamilyDialog } from '../dialogs/delete-family-dialog'
import { EditChildDialog } from '../dialogs/edit-child-dialog'
import { EditParentDialog } from '../dialogs/edit-parent-dialog'
import { PaymentLinkDialog } from '../dialogs/payment-link-dialog'
import { ReEnrollChildDialog } from '../dialogs/re-enroll-child-dialog'
import { WithdrawChildDialog } from '../dialogs/withdraw-child-dialog'

interface FamilyDetailSheetProps {
  family: Family | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onVerifyBankAccount?: (paymentIntentId: string, parentEmail: string) => void
}

export function FamilyDetailSheet({
  family,
  open,
  onOpenChange,
  onVerifyBankAccount,
}: FamilyDetailSheetProps) {
  const { state, actions } = useSheetState()
  const pendingShiftRef = useRef<{
    newShift: Shift
    previousShift: Shift | null
  } | null>(null)

  const { execute: executeUpdateFamilyShift, isPending: isUpdatingShift } =
    useActionHandler(updateFamilyShift, {
      successMessage: 'Family shift updated successfully!',
      onSuccess: () => {
        actions.setShiftPopover(false)
        actions.setPendingShift(null)
        pendingShiftRef.current = null
      },
      onError: () => {
        actions.setPendingShift(null)
        pendingShiftRef.current = null
      },
    })

  const { execute: executePauseBilling, isPending: isPausingBilling } =
    useActionHandler(pauseFamilyBillingAction)

  const { execute: executeResumeBilling, isPending: isResumingBilling } =
    useActionHandler(resumeFamilyBillingAction)

  if (!family) return null

  const firstMember = family.members[0]
  if (!firstMember) return null

  const handleViewInStripe = () => {
    const customerId = firstMember.stripeCustomerIdDugsi
    if (customerId) {
      window.open(
        `https://dashboard.stripe.com/customers/${customerId}`,
        '_blank',
        'noopener,noreferrer'
      )
    }
  }

  const handleShiftChange = async (shift: Shift) => {
    if (isUpdatingShift) {
      toast.warning('Please wait for the current shift update to complete')
      return
    }

    if (!firstMember?.familyReferenceId) {
      toast.error('Cannot update shift: Family reference not found')
      return
    }

    const previousShift = firstMember.shift
    const shiftData = { newShift: shift, previousShift }
    pendingShiftRef.current = shiftData
    actions.setPendingShift(shiftData)

    await executeUpdateFamilyShift({
      familyReferenceId: firstMember.familyReferenceId,
      shift,
    })
  }

  const currentEditChild = family.members.find(
    (m) => m.id === state.editChildDialog.studentId
  )

  const getSheetTitle = () => {
    const { payer, other } = getOrderedParentNames(family.members[0])
    if (family.members[0] && hasSecondParent(family.members[0])) {
      return `${payer} & ${other}`
    }
    return payer
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-xl">
        <SheetHeader className="border-b pb-4">
          <SheetTitle>{getSheetTitle()}</SheetTitle>
          <SheetDescription>Family details and information</SheetDescription>
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

            {firstMember && (
              <Popover
                open={state.shiftPopover}
                onOpenChange={actions.setShiftPopover}
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        actions.setShiftPopover(true)
                      }
                    }}
                  >
                    {isUpdatingShift && (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    )}
                    {firstMember.shift
                      ? SHIFT_BADGES[firstMember.shift].label
                      : 'Set Shift'}
                  </Badge>
                </PopoverTrigger>
                <PopoverContent
                  className={`w-48 ${isUpdatingShift ? 'pointer-events-none opacity-50' : ''}`}
                  align="start"
                >
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

        <Tabs
          value={state.activeTab}
          onValueChange={(value) => actions.setActiveTab(value as SheetTab)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="gap-1.5">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-1.5">
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Billing</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pt-4">
            <TabsContent value="overview" className="mt-0 h-full">
              <OverviewTab
                family={family}
                firstMember={firstMember}
                onEditParent={actions.openEditParent}
                onEditChild={actions.openEditChild}
                onAddChild={() => actions.setAddChildDialog(true)}
                onWithdraw={actions.openWithdrawChild}
                onReEnroll={actions.openReEnrollChild}
              />
            </TabsContent>

            <TabsContent value="billing" className="mt-0 h-full">
              <BillingTab family={family} />
            </TabsContent>

            <TabsContent value="history" className="mt-0 h-full">
              <HistoryTab family={family} />
            </TabsContent>
          </div>
        </Tabs>

        {/* Actions Footer */}
        <div className="flex items-center gap-2 border-t pt-4">
          {family.hasPayment &&
            (firstMember.subscriptionStatus !== 'active' ||
              !family.hasSubscription) &&
            firstMember.paymentIntentIdDugsi &&
            family.parentEmail && (
              <Button
                className="flex-1"
                onClick={() =>
                  onVerifyBankAccount?.(
                    firstMember.paymentIntentIdDugsi!,
                    family.parentEmail!
                  )
                }
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Verify Bank
              </Button>
            )}

          <Button
            className="flex-1"
            variant="outline"
            onClick={() => actions.setPaymentLinkDialog(true)}
          >
            <Send className="mr-2 h-4 w-4" />
            Payment Link
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Mail className="mr-2 h-4 w-4" />
                Send Email
              </DropdownMenuItem>
              {firstMember.familyReferenceId && (
                <DropdownMenuItem
                  onClick={() => actions.setConsolidateSubscriptionDialog(true)}
                >
                  <Link className="mr-2 h-4 w-4" />
                  Link Subscription
                </DropdownMenuItem>
              )}
              {firstMember.stripeCustomerIdDugsi && (
                <DropdownMenuItem onClick={handleViewInStripe}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View in Stripe
                </DropdownMenuItem>
              )}
              {firstMember.subscriptionStatus === 'active' &&
                firstMember.familyReferenceId && (
                  <DropdownMenuItem
                    onClick={() =>
                      executePauseBilling({
                        familyReferenceId: firstMember.familyReferenceId!,
                      })
                    }
                    disabled={isPausingBilling}
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    Pause Billing
                  </DropdownMenuItem>
                )}
              {firstMember.subscriptionStatus === 'paused' &&
                firstMember.familyReferenceId && (
                  <DropdownMenuItem
                    onClick={() =>
                      executeResumeBilling({
                        familyReferenceId: firstMember.familyReferenceId!,
                      })
                    }
                    disabled={isResumingBilling}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Resume Billing
                  </DropdownMenuItem>
                )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={() => actions.setDeleteFamilyDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Withdraw All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SheetContent>

      <EditParentDialog
        open={state.editParentDialog.open}
        onOpenChange={(open) => {
          if (!open) actions.closeEditParent()
        }}
        studentId={firstMember.id}
        parentNumber={state.editParentDialog.parentNumber}
        currentData={
          state.editParentDialog.parentNumber === 1
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
        isAddingSecondParent={state.editParentDialog.isAdding}
      />

      {currentEditChild && (
        <EditChildDialog
          open={state.editChildDialog.open}
          onOpenChange={(open) => {
            if (!open) actions.closeEditChild()
          }}
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

      <AddChildDialog
        open={state.addChildDialog}
        onOpenChange={actions.setAddChildDialog}
        existingStudentId={firstMember.id}
      />

      <PaymentLinkDialog
        family={family}
        open={state.paymentLinkDialog}
        onOpenChange={actions.setPaymentLinkDialog}
      />

      {state.deleteFamilyDialog && (
        <DeleteFamilyDialog
          studentId={firstMember.id}
          familyName={getSheetTitle()}
          hasActiveSubscription={
            family.hasSubscription &&
            family.members[0]?.subscriptionStatus === 'active'
          }
          open={state.deleteFamilyDialog}
          onOpenChange={actions.setDeleteFamilyDialog}
          onSuccess={() => onOpenChange(false)}
        />
      )}

      {state.consolidateSubscriptionDialog && firstMember.familyReferenceId && (
        <ConsolidateSubscriptionDialog
          open={state.consolidateSubscriptionDialog}
          onOpenChange={actions.setConsolidateSubscriptionDialog}
          familyId={firstMember.familyReferenceId}
          familyName={getSheetTitle()}
        />
      )}

      {state.withdrawChildDialog.open &&
        state.withdrawChildDialog.studentId && (
          <WithdrawChildDialog
            studentId={state.withdrawChildDialog.studentId}
            open={state.withdrawChildDialog.open}
            onOpenChange={(open) => {
              if (!open) actions.closeWithdrawChild()
            }}
          />
        )}

      {state.reEnrollChildDialog.open &&
        state.reEnrollChildDialog.studentId && (
          <ReEnrollChildDialog
            studentId={state.reEnrollChildDialog.studentId}
            childName={state.reEnrollChildDialog.childName || ''}
            open={state.reEnrollChildDialog.open}
            onOpenChange={(open) => {
              if (!open) actions.closeReEnrollChild()
            }}
          />
        )}
    </Sheet>
  )
}
