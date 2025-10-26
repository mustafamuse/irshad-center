'use client'

import { useState } from 'react'

import {
  ChevronDown,
  ChevronRight,
  Users,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Mail,
  Phone,
  ExternalLink,
  MoreVertical,
  Send,
  Link,
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
import { GenderDisplay } from '@/components/ui/gender-display'
import {
  formatEducationLevel,
  formatGradeLevel,
} from '@/lib/utils/enum-formatters'

interface Family {
  familyKey: string
  members: Array<{
    id: string
    name: string
    gender: 'MALE' | 'FEMALE' | null
    dateOfBirth: Date | string | null
    educationLevel: string | null
    gradeLevel: string | null
    schoolName: string | null
    healthInfo: string | null
    createdAt: Date | string
    parentFirstName: string | null
    parentLastName: string | null
    parentEmail: string | null
    parentPhone: string | null
    parent2FirstName: string | null
    parent2LastName: string | null
    parent2Email: string | null
    parent2Phone: string | null
    stripeCustomerIdDugsi: string | null
    stripeSubscriptionIdDugsi: string | null
    paidUntil: Date | string | null
  }>
  hasPayment: boolean
  hasSubscription: boolean
  parentEmail: string | null
  parentPhone: string | null
}

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

  const getStatusBadge = (family: Family) => {
    if (family.hasSubscription) {
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Active
        </Badge>
      )
    } else if (family.hasPayment) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          <AlertCircle className="mr-1 h-3 w-3" />
          Pending Setup
        </Badge>
      )
    } else {
      return (
        <Badge variant="secondary">
          <XCircle className="mr-1 h-3 w-3" />
          No Payment
        </Badge>
      )
    }
  }

  const getPrimaryParent = (family: Family) => {
    const firstMember = family.members[0]
    if (!firstMember) return null

    return {
      name: [firstMember.parentFirstName, firstMember.parentLastName]
        .filter(Boolean)
        .join(' '),
      email: firstMember.parentEmail,
      phone: firstMember.parentPhone,
      hasSecondParent: !!(
        firstMember.parent2FirstName || firstMember.parent2LastName
      ),
    }
  }

  if (families.length === 0) {
    return (
      <div className="py-10 text-center">
        <Users className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">No families found</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {families.map((family) => {
        const isExpanded = expandedFamilies.has(family.familyKey)
        const isSelected = selectedFamilies.has(family.familyKey)
        const parent = getPrimaryParent(family)

        return (
          <Card
            key={family.familyKey}
            className={`transition-all ${
              isSelected ? 'border-primary ring-2 ring-primary/20' : ''
            } ${isExpanded ? 'md:col-span-2 lg:col-span-3' : ''}`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelection(family.familyKey)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                        onClick={() => toggleFamily(family.familyKey)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="mr-1 h-4 w-4" />
                        ) : (
                          <ChevronRight className="mr-1 h-4 w-4" />
                        )}
                        {parent?.name || 'Family'}
                      </Button>
                      {parent?.hasSecondParent && (
                        <Badge variant="outline" className="text-xs">
                          2 Parents
                        </Badge>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {getStatusBadge(family)}
                      <Badge variant="secondary">
                        {family.members.length}{' '}
                        {family.members.length === 1 ? 'Child' : 'Children'}
                      </Badge>
                      {family.members[0]?.stripeCustomerIdDugsi && (
                        <Badge variant="outline" className="text-xs">
                          <CreditCard className="mr-1 h-3 w-3" />
                          Customer
                        </Badge>
                      )}
                    </div>

                    {viewMode === 'full' && (
                      <div className="mt-3 space-y-1">
                        {parent?.email && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            <span className="truncate">{parent.email}</span>
                          </div>
                        )}
                        {parent?.phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{parent.phone}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
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
                      <DropdownMenuItem>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View in Stripe
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="border-t pt-3">
                    <h4 className="mb-3 text-sm font-medium">
                      Children Details
                    </h4>
                    <div className="space-y-2">
                      {family.members.map((child, index) => (
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
                                <span>
                                  {formatGradeLevel(child.gradeLevel)}
                                </span>
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

                  {/* Payment Details Section */}
                  {family.members[0]?.stripeCustomerIdDugsi && (
                    <div className="border-t pt-3">
                      <h4 className="mb-2 text-sm font-medium">
                        Payment Details
                      </h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Customer ID:
                          </span>
                          <code className="rounded bg-muted px-2 py-0.5 text-xs">
                            {family.members[0].stripeCustomerIdDugsi.slice(
                              0,
                              14
                            )}
                            ...
                          </code>
                        </div>
                        {family.members[0]?.stripeSubscriptionIdDugsi && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Subscription:
                            </span>
                            <code className="rounded bg-muted px-2 py-0.5 text-xs">
                              {family.members[0].stripeSubscriptionIdDugsi.slice(
                                0,
                                14
                              )}
                              ...
                            </code>
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
        )
      })}
    </div>
  )
}
