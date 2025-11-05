'use client'

import { useState, useCallback } from 'react'

import {
  ChevronDown,
  ChevronRight,
  Users,
  ExternalLink,
  MoreVertical,
  Send,
  Link,
  Mail,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'

import { FamilyDetailSheet } from './family-detail-sheet'
import { useFamilyActions } from '../../_hooks/use-family-actions'
import { Family } from '../../_types'
import { formatParentName } from '../../_utils/format'
import { useDugsiUIStore } from '../../store'
import { VerifyBankDialog } from '../dialogs/verify-bank-dialog'
import { ChildInfoCard } from '../ui/child-info-card'
import { ParentInfo } from '../ui/parent-info'
import { SwipeableCard } from '../ui/swipeable-card'

interface FamilyGridViewProps {
  families: Family[]
  selectedFamilies: Set<string>
  onSelectionChange: (families: Set<string>) => void
  viewMode?: 'full' | 'compact'
}

export function FamilyGridView({
  families,
  selectedFamilies,
  onSelectionChange,
  viewMode = 'full',
}: FamilyGridViewProps) {
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(
    new Set()
  )
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

  // Family actions hook
  const familyActions = useFamilyActions({
    onViewDetails: (family) => {
      setSelectedFamily(family)
      setIsSheetOpen(true)
    },
  })

  const toggleFamily = useCallback(
    (familyKey: string) => {
      const newExpanded = new Set(expandedFamilies)
      if (newExpanded.has(familyKey)) {
        newExpanded.delete(familyKey)
      } else {
        newExpanded.add(familyKey)
      }
      setExpandedFamilies(newExpanded)
    },
    [expandedFamilies]
  )

  const toggleSelection = useCallback(
    (familyKey: string) => {
      const newSelection = new Set(selectedFamilies)
      if (newSelection.has(familyKey)) {
        newSelection.delete(familyKey)
      } else {
        newSelection.add(familyKey)
      }
      onSelectionChange(newSelection)
    },
    [selectedFamilies, onSelectionChange]
  )

  const handleVerifyBankAccount = useCallback(
    (paymentIntentId: string, parentEmail: string) => {
      setVerifyBankDialogData({ paymentIntentId, parentEmail })
      setDialogOpen('verifyBank', true)
    },
    [setVerifyBankDialogData, setDialogOpen]
  )

  const handleVerifyBankDialogChange = useCallback(
    (open: boolean) => {
      setDialogOpen('verifyBank', open)
    },
    [setDialogOpen]
  )

  if (families.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-8 w-8" />}
        title="No families found"
        description="No families match your current filters. Try adjusting your search or filter criteria."
      />
    )
  }

  return (
    <>
      <div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        role="list"
        aria-label="Family list"
      >
        {families.map((family) => {
          const isExpanded = expandedFamilies.has(family.familyKey)
          const isSelected = selectedFamilies.has(family.familyKey)
          const firstMember = family.members[0]

          return (
            <SwipeableCard
              key={family.familyKey}
              rightActions={familyActions.getSwipeActions(family)}
            >
              <Card
                className={`flex h-full flex-col transition-all ${
                  isSelected ? 'border-primary ring-2 ring-primary/20' : ''
                } ${isExpanded ? 'md:col-span-2 lg:col-span-3' : ''}`}
                role="listitem"
                aria-label={`Family: ${firstMember ? formatParentName(firstMember.parentFirstName, firstMember.parentLastName) : 'Unknown'}, ${family.members.length} ${family.members.length === 1 ? 'child' : 'children'}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() =>
                          toggleSelection(family.familyKey)
                        }
                        className="mt-1"
                        aria-label={`Select family ${firstMember ? formatParentName(firstMember.parentFirstName, firstMember.parentLastName) : family.familyKey}`}
                      />
                      <div className="flex-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 text-base font-semibold hover:bg-transparent"
                          onClick={() => toggleFamily(family.familyKey)}
                          aria-expanded={isExpanded}
                          aria-controls={`family-details-${family.familyKey}`}
                          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} family details`}
                        >
                          {isExpanded ? (
                            <ChevronDown className="mr-1.5 h-4 w-4" />
                          ) : (
                            <ChevronRight className="mr-1.5 h-4 w-4" />
                          )}
                          {firstMember
                            ? formatParentName(
                                firstMember.parentFirstName,
                                firstMember.parentLastName
                              )
                            : 'Family'}
                        </Button>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {family.members.length}{' '}
                            {family.members.length === 1 ? 'Child' : 'Children'}
                          </Badge>
                        </div>

                        {viewMode === 'full' && firstMember && (
                          <div className="mt-3">
                            <ParentInfo
                              registration={firstMember}
                              showEmail={true}
                              showPhone={true}
                              showSecondParentBadge={false}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          aria-label={`Actions for family ${firstMember ? formatParentName(firstMember.parentFirstName, firstMember.parentLastName) : family.familyKey}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">More actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            familyActions.handleViewDetails(family)
                          }
                        >
                          <Users className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {family.hasPayment && !family.hasSubscription && (
                          <DropdownMenuItem
                            onClick={() =>
                              familyActions.handleLinkSubscription(family)
                            }
                          >
                            <Link className="mr-2 h-4 w-4" />
                            Link Subscription
                          </DropdownMenuItem>
                        )}
                        {!family.hasPayment && (
                          <DropdownMenuItem
                            onClick={() =>
                              familyActions.handleSendPaymentLink(family)
                            }
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Send Payment Link
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => familyActions.handleSendEmail(family)}
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Send Email
                        </DropdownMenuItem>
                        {family.members[0]?.stripeCustomerIdDugsi && (
                          <DropdownMenuItem
                            onClick={() =>
                              familyActions.handleViewInStripe(
                                family.members[0].stripeCustomerIdDugsi!
                              )
                            }
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View in Stripe
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent
                    className="pt-0"
                    id={`family-details-${family.familyKey}`}
                  >
                    <div className="space-y-3">
                      <div className="border-t pt-3">
                        <h4 className="mb-3 text-sm font-medium">
                          Children Details
                        </h4>
                        <div
                          className="space-y-2"
                          role="list"
                          aria-label="Children list"
                        >
                          {family.members.map((child, index) => (
                            <ChildInfoCard
                              key={child.id}
                              child={child}
                              index={index}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            </SwipeableCard>
          )
        })}
      </div>

      {/* Family Details Sheet */}
      <FamilyDetailSheet
        family={selectedFamily}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onVerifyBankAccount={handleVerifyBankAccount}
      />

      {/* Verify Bank Dialog */}
      {verifyBankDialogData && (
        <VerifyBankDialog
          open={isVerifyBankDialogOpen}
          onOpenChange={handleVerifyBankDialogChange}
          paymentIntentId={verifyBankDialogData.paymentIntentId}
          parentEmail={verifyBankDialogData.parentEmail}
        />
      )}
    </>
  )
}
