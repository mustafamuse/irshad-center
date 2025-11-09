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
  Copy,
  ShieldCheck,
  Edit,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import { FamilyStatusBadge } from './family-status-badge'
import { Family } from '../../_types'
import { getFamilyStatus } from '../../_utils/family'
import { formatParentName, hasSecondParent } from '../../_utils/format'
import { AddChildDialog } from '../dialogs/add-child-dialog'
import { EditChildDialog } from '../dialogs/edit-child-dialog'
import { EditParentDialog } from '../dialogs/edit-parent-dialog'
import { ChildInfoCard } from '../ui/child-info-card'
import { ParentInfo } from '../ui/parent-info'

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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
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

  const handleEditChild = (studentId: string) => {
    setEditChildDialog({ open: true, studentId })
  }

  const currentEditChild = family.members.find(
    (m) => m.id === editChildDialog.studentId
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {formatParentName(
              family.members[0]?.parentFirstName,
              family.members[0]?.parentLastName
            )}
          </SheetTitle>
          <SheetDescription>Family details and information</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Family Status */}
          <div className="flex items-center gap-2">
            <FamilyStatusBadge status={getFamilyStatus(family)} />
            {family.members[0] && hasSecondParent(family.members[0]) && (
              <Badge variant="outline" className="text-xs">
                2 Parents
              </Badge>
            )}
            {family.members[0]?.stripeCustomerIdDugsi && (
              <Badge variant="outline" className="text-xs">
                <CreditCard className="mr-1 h-3 w-3" />
                Customer
              </Badge>
            )}
          </div>

          {/* Contact Information */}
          {family.members[0] && (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Contact Information</h3>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEditParent1}
                    className="h-8 px-2"
                  >
                    <Edit className="mr-1 h-3 w-3" />
                    Edit Parent 1
                  </Button>
                  {hasSecondParent(firstMember) ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleEditParent2}
                      className="h-8 px-2"
                    >
                      <Edit className="mr-1 h-3 w-3" />
                      Edit Parent 2
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleAddSecondParent}
                      className="h-8 px-2"
                    >
                      <UserPlus className="mr-1 h-3 w-3" />
                      Add Parent 2
                    </Button>
                  )}
                </div>
              </div>
              <ParentInfo
                registration={family.members[0]}
                showEmail={true}
                showPhone={true}
                showSecondParentBadge={true}
              />
            </div>
          )}

          {/* Children Details */}
          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                Children ({family.members.length})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAddChildDialog(true)}
                className="h-8 px-2"
              >
                <UserPlus className="mr-1 h-3 w-3" />
                Add Child
              </Button>
            </div>
            <div className="space-y-3">
              {family.members.map((child, index) => (
                <div key={child.id} className="group relative">
                  <ChildInfoCard child={child} index={index} />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditChild(child.id)}
                    className="absolute right-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Details */}
          {family.members[0]?.stripeCustomerIdDugsi && (
            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="font-semibold">Payment Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Customer ID:</span>
                  <div className="flex items-center gap-1">
                    <code className="rounded bg-muted px-2 py-0.5 text-xs">
                      {family.members[0].stripeCustomerIdDugsi.slice(0, 14)}...
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() =>
                        family.members[0]?.stripeCustomerIdDugsi &&
                        copyToClipboard(
                          family.members[0].stripeCustomerIdDugsi,
                          'Customer ID'
                        )
                      }
                      aria-label="Copy customer ID"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {family.members[0]?.stripeSubscriptionIdDugsi && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Subscription:</span>
                    <div className="flex items-center gap-1">
                      <code className="rounded bg-muted px-2 py-0.5 text-xs">
                        {family.members[0].stripeSubscriptionIdDugsi.slice(
                          0,
                          14
                        )}
                        ...
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() =>
                          family.members[0]?.stripeSubscriptionIdDugsi &&
                          copyToClipboard(
                            family.members[0].stripeSubscriptionIdDugsi,
                            'Subscription ID'
                          )
                        }
                        aria-label="Copy subscription ID"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {family.members[0]?.paidUntil && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Next Billing:</span>
                    <span className="text-xs">
                      {new Date(
                        family.members[0].paidUntil
                      ).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {/* Verify Bank Account - Show for families needing bank verification */}
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

            <Button className="w-full" variant="outline">
              <Send className="mr-2 h-4 w-4" />
              Send Payment Link
            </Button>
            <Button className="w-full" variant="outline">
              <Mail className="mr-2 h-4 w-4" />
              Send Email
            </Button>
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
            gender: currentEditChild.gender,
            dateOfBirth: currentEditChild.dateOfBirth,
            educationLevel: currentEditChild.educationLevel,
            gradeLevel: currentEditChild.gradeLevel,
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
    </Sheet>
  )
}
