'use client'

import {
  CreditCard,
  ExternalLink,
  Send,
  Mail,
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
import { formatParentName, hasSecondParent } from '../../_utils/format'
import { updateFamilyShift } from '../../actions'
import { AddChildDialog } from '../dialogs/add-child-dialog'
import { ConsolidateSubscriptionDialog } from '../dialogs/consolidate-subscription-dialog'
import { DeleteFamilyDialog } from '../dialogs/delete-family-dialog'
import { EditChildDialog } from '../dialogs/edit-child-dialog'
import { EditParentDialog } from '../dialogs/edit-parent-dialog'
import { PaymentLinkDialog } from '../dialogs/payment-link-dialog'

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
  const { state, actions } = useSheetState()

  const { execute: executeUpdateFamilyShift, isPending: isUpdatingShift } =
    useActionHandler(updateFamilyShift, {
      successMessage: 'Family shift updated successfully!',
      onSuccess: () => {
        actions.setShiftPopover(false)
        actions.setPendingShift(null)
      },
      onError: () => {
        if (state.pendingShift?.previousShift) {
          onFamilyUpdate?.(state.pendingShift.previousShift)
        }
        actions.setPendingShift(null)
      },
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
    actions.setPaymentLinkDialog(true)
  }

  const handleEditParent = (parentNumber: 1 | 2, isAdding: boolean) => {
    actions.openEditParent(parentNumber, isAdding)
  }

  const handleEditChild = (studentId: string) => {
    actions.openEditChild(studentId)
  }

  const handleShiftChange = async (shift: 'MORNING' | 'AFTERNOON') => {
    if (isUpdatingShift) {
      toast.warning('Please wait for the current shift update to complete')
      return
    }

    if (!firstMember?.familyReferenceId) {
      toast.error('Cannot update shift: Family reference not found')
      return
    }

    const previousShift = firstMember.shift
    actions.setPendingShift({ newShift: shift, previousShift })
    onFamilyUpdate?.(shift)

    await executeUpdateFamilyShift({
      familyReferenceId: firstMember.familyReferenceId,
      shift,
    })
  }

  const currentEditChild = family.members.find(
    (m) => m.id === state.editChildDialog.studentId
  )

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
                onEditParent={handleEditParent}
                onEditChild={handleEditChild}
                onAddChild={() => actions.setAddChildDialog(true)}
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
            (family.members[0]?.subscriptionStatus !== 'active' ||
              !family.hasSubscription) &&
            family.members[0]?.paymentIntentIdDugsi &&
            family.parentEmail && (
              <Button className="flex-1" onClick={handleVerifyBank}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Verify Bank
              </Button>
            )}

          <Button
            className="flex-1"
            variant="outline"
            onClick={handleSendPaymentLink}
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
              {family.members[0]?.stripeCustomerIdDugsi && (
                <DropdownMenuItem onClick={handleViewInStripe}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View in Stripe
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={() => actions.setDeleteFamilyDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Family
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
    </Sheet>
  )
}
