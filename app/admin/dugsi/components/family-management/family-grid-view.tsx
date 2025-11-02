'use client'

import { useState } from 'react'

import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Users,
  CreditCard,
  ExternalLink,
  MoreVertical,
  Send,
  Link,
  Mail,
  Copy,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

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
import { GenderDisplay } from '@/components/ui/gender-display'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  formatEducationLevel,
  formatGradeLevel,
} from '@/lib/utils/enum-formatters'

import { FamilyStatusBadge } from './family-status-badge'
import { Family } from '../../_types'
import { getFamilyStatus } from '../../_utils/family'
import { formatParentName, hasSecondParent } from '../../_utils/format'
import { ParentInfo } from '../ui/parent-info'
import { SwipeableCard, SwipeAction } from '../ui/swipeable-card'

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

  const toggleFamily = (familyKey: string) => {
    const newExpanded = new Set(expandedFamilies)
    if (newExpanded.has(familyKey)) {
      newExpanded.delete(familyKey)
    } else {
      newExpanded.add(familyKey)
    }
    setExpandedFamilies(newExpanded)
  }

  const toggleSelection = (familyKey: string) => {
    const newSelection = new Set(selectedFamilies)
    if (newSelection.has(familyKey)) {
      newSelection.delete(familyKey)
    } else {
      newSelection.add(familyKey)
    }
    onSelectionChange(newSelection)
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
          const status = getFamilyStatus(family)

          // Define swipe actions for mobile
          const swipeActions: SwipeAction[] = [
            {
              icon: Mail,
              label: 'Email',
              color: 'blue',
              onAction: () => {
                toast.info(
                  `Email action for ${formatParentName(firstMember?.parentFirstName, firstMember?.parentLastName)}`
                )
                // TODO: Implement email functionality
              },
            },
            {
              icon: Trash2,
              label: 'Delete',
              color: 'red',
              onAction: () => {
                toast.info(
                  `Delete action for ${formatParentName(firstMember?.parentFirstName, firstMember?.parentLastName)}`
                )
                // TODO: Implement delete with confirmation
              },
            },
          ]

          return (
            <SwipeableCard key={family.familyKey} rightActions={swipeActions}>
              <Card
                className={`transition-all ${
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
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 font-semibold hover:bg-transparent"
                            onClick={() => toggleFamily(family.familyKey)}
                            aria-expanded={isExpanded}
                            aria-controls={`family-details-${family.familyKey}`}
                            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} family details`}
                          >
                            {isExpanded ? (
                              <ChevronDown className="mr-1 h-4 w-4" />
                            ) : (
                              <ChevronRight className="mr-1 h-4 w-4" />
                            )}
                            {firstMember
                              ? formatParentName(
                                  firstMember.parentFirstName,
                                  firstMember.parentLastName
                                )
                              : 'Family'}
                          </Button>
                          {firstMember && hasSecondParent(firstMember) && (
                            <Badge variant="outline" className="text-xs">
                              2 Parents
                            </Badge>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <FamilyStatusBadge status={status} />
                          <Badge variant="secondary">
                            {family.members.length}{' '}
                            {family.members.length === 1 ? 'Child' : 'Children'}
                          </Badge>
                          {firstMember?.stripeCustomerIdDugsi && (
                            <Badge variant="outline" className="text-xs">
                              <CreditCard className="mr-1 h-3 w-3" />
                              Customer
                            </Badge>
                          )}
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
                          onClick={() => {
                            setSelectedFamily(family)
                            setIsSheetOpen(true)
                          }}
                        >
                          <Users className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {family.hasPayment && !family.hasSubscription && (
                          <DropdownMenuItem>
                            <Link className="mr-2 h-4 w-4" />
                            Link Subscription
                          </DropdownMenuItem>
                        )}
                        {!family.hasPayment && (
                          <DropdownMenuItem>
                            <Send className="mr-2 h-4 w-4" />
                            Send Payment Link
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem>
                          <Mail className="mr-2 h-4 w-4" />
                          Send Email
                        </DropdownMenuItem>
                        {family.members[0]?.stripeCustomerIdDugsi && (
                          <DropdownMenuItem
                            onClick={() => {
                              const customerId =
                                family.members[0].stripeCustomerIdDugsi
                              const stripeUrl = `https://dashboard.stripe.com/customers/${customerId}`
                              window.open(
                                stripeUrl,
                                '_blank',
                                'noopener,noreferrer'
                              )
                            }}
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
                            <div
                              key={child.id}
                              className="flex items-start gap-3 rounded-lg bg-muted/30 p-3"
                              role="listitem"
                              aria-label={`Child ${index + 1}: ${child.name}`}
                            >
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                {index + 1}
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
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
                                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                  {child.gradeLevel && (
                                    <span>
                                      {formatGradeLevel(child.gradeLevel)}
                                    </span>
                                  )}
                                  {child.educationLevel && (
                                    <span>
                                      {formatEducationLevel(
                                        child.educationLevel
                                      )}
                                    </span>
                                  )}
                                  {child.schoolName && (
                                    <span className="truncate">
                                      {child.schoolName}
                                    </span>
                                  )}
                                </div>
                                {child.healthInfo &&
                                  child.healthInfo.toLowerCase() !== 'none' && (
                                    <div className="mt-1 flex items-start gap-1">
                                      <AlertCircle className="h-3 w-3 text-red-600" />
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

                      {/* Payment Details Section */}
                      {family.members[0]?.stripeCustomerIdDugsi && (
                        <div className="border-t pt-3">
                          <h4 className="mb-2 text-sm font-medium">
                            Payment Details
                          </h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground">
                                Customer ID:
                              </span>
                              <div className="flex items-center gap-1">
                                <code className="rounded bg-muted px-2 py-0.5 text-xs">
                                  {family.members[0].stripeCustomerIdDugsi.slice(
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
                                <span className="text-muted-foreground">
                                  Subscription:
                                </span>
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
                                      copyToClipboard(
                                        family.members[0]
                                          .stripeSubscriptionIdDugsi,
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
                                <span className="text-muted-foreground">
                                  Next Billing:
                                </span>
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
                    </div>
                  </CardContent>
                )}
              </Card>
            </SwipeableCard>
          )
        })}
      </div>

      {/* Family Details Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selectedFamily && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {formatParentName(
                    selectedFamily.members[0]?.parentFirstName,
                    selectedFamily.members[0]?.parentLastName
                  )}
                </SheetTitle>
                <SheetDescription>
                  Family details and information
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Family Status */}
                <div className="flex items-center gap-2">
                  <FamilyStatusBadge status={getFamilyStatus(selectedFamily)} />
                  {selectedFamily.members[0] &&
                    hasSecondParent(selectedFamily.members[0]) && (
                      <Badge variant="outline" className="text-xs">
                        2 Parents
                      </Badge>
                    )}
                  {selectedFamily.members[0]?.stripeCustomerIdDugsi && (
                    <Badge variant="outline" className="text-xs">
                      <CreditCard className="mr-1 h-3 w-3" />
                      Customer
                    </Badge>
                  )}
                </div>

                {/* Contact Information */}
                {selectedFamily.members[0] && (
                  <div className="space-y-4 rounded-lg border p-4">
                    <h3 className="font-semibold">Contact Information</h3>
                    <ParentInfo
                      registration={selectedFamily.members[0]}
                      showEmail={true}
                      showPhone={true}
                      showSecondParentBadge={true}
                    />
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
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{child.name}</span>
                            {child.gender && (
                              <GenderDisplay
                                gender={child.gender}
                                size="sm"
                                showLabel
                              />
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            {child.gradeLevel && (
                              <span>{formatGradeLevel(child.gradeLevel)}</span>
                            )}
                            {child.educationLevel && (
                              <span>
                                {formatEducationLevel(child.educationLevel)}
                              </span>
                            )}
                            {child.schoolName && (
                              <span className="truncate">
                                {child.schoolName}
                              </span>
                            )}
                          </div>
                          {child.healthInfo &&
                            child.healthInfo.toLowerCase() !== 'none' && (
                              <div className="mt-1 flex items-start gap-1">
                                <AlertCircle className="h-3 w-3 text-red-600" />
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
                                navigator.clipboard.writeText(
                                  selectedFamily.members[0]
                                    .stripeCustomerIdDugsi
                                )
                                toast.success('Customer ID copied to clipboard')
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
                            Subscription:
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
                                  navigator.clipboard.writeText(
                                    selectedFamily.members[0]
                                      .stripeSubscriptionIdDugsi
                                  )
                                  toast.success(
                                    'Subscription ID copied to clipboard'
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
                      {selectedFamily.members[0]?.paidUntil && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Next Billing:
                          </span>
                          <span className="text-xs">
                            {new Date(
                              selectedFamily.members[0].paidUntil
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2">
                  <Button className="w-full" variant="outline">
                    <Send className="mr-2 h-4 w-4" />
                    Send Payment Link
                  </Button>
                  <Button className="w-full" variant="outline">
                    <Mail className="mr-2 h-4 w-4" />
                    Send Email
                  </Button>
                  {selectedFamily.members[0]?.stripeCustomerIdDugsi && (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => {
                        const customerId =
                          selectedFamily.members[0]?.stripeCustomerIdDugsi
                        if (customerId) {
                          const stripeUrl = `https://dashboard.stripe.com/customers/${customerId}`
                          window.open(
                            stripeUrl,
                            '_blank',
                            'noopener,noreferrer'
                          )
                        }
                      }}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View in Stripe
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
