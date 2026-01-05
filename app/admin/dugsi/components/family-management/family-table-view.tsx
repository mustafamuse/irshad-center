'use client'

import { useState, useCallback } from 'react'

import {
  Users,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  Eye,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
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
import { cn } from '@/lib/utils'
import { calculateDugsiRate } from '@/lib/utils/dugsi-tuition'

import { FamilyDetailSheet } from './family-detail-sheet'
import { FamilyStatusBadge } from './family-status-badge'
import { DugsiRegistration, Family } from '../../_types'
import { getFamilyStatus } from '../../_utils/family'
import { formatParentName } from '../../_utils/format'
import { useDugsiUIStore } from '../../store'
import { DeleteFamilyDialog } from '../dialogs/delete-family-dialog'
import { VerifyBankDialog } from '../dialogs/verify-bank-dialog'
import { ShiftBadge } from '../shared/shift-badge'

function getOrderedParents(member: DugsiRegistration | undefined) {
  if (!member) return { payer: '', other: '' }
  const parent1 = formatParentName(
    member.parentFirstName,
    member.parentLastName
  )
  const parent2 = formatParentName(
    member.parent2FirstName,
    member.parent2LastName
  )
  if (member.primaryPayerParentNumber === 2 && parent2) {
    return { payer: parent2, other: parent1 }
  }
  return { payer: parent1, other: parent2 }
}

function BillingCell({ family }: { family: Family }) {
  const member = family.members[0]
  if (!member) return null

  const subscriptionAmount = member.subscriptionAmount
  const familyChildCount = member.familyChildCount || family.members.length
  const expected = calculateDugsiRate(familyChildCount)

  const formatNoCents = (cents: number) => `$${Math.round(cents / 100)}`

  if (!subscriptionAmount) {
    return (
      <span className="text-xs text-muted-foreground">
        Expected: {formatNoCents(expected)}
      </span>
    )
  }

  const isMismatch = subscriptionAmount !== expected

  return (
    <span className="text-xs">
      <span className={cn(isMismatch ? 'text-amber-600' : 'text-foreground')}>
        {formatNoCents(subscriptionAmount)}
      </span>
      <span className="text-muted-foreground">
        {' '}
        / {formatNoCents(expected)}
      </span>
    </span>
  )
}

interface FamilyTableViewProps {
  families: Family[]
}

export function FamilyTableView({ families }: FamilyTableViewProps) {
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [deleteDialogFamily, setDeleteDialogFamily] = useState<Family | null>(
    null
  )

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

  const handleFamilyUpdate = useCallback(
    (shift: 'MORNING' | 'AFTERNOON') => {
      if (selectedFamily) {
        setSelectedFamily({
          ...selectedFamily,
          members: selectedFamily.members.map((member) => ({
            ...member,
            shift,
          })),
        })
      }
    },
    [selectedFamily]
  )

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
          const { payer, other } = getOrderedParents(family.members[0])
          const status = getFamilyStatus(family)

          return (
            <div
              key={family.familyKey}
              className="cursor-pointer rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
              onClick={() => handleRowClick(family)}
            >
              {/* Parent Names and Family Info */}
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <h3 className="font-semibold">{payer}</h3>
                {other && <span>/ {other}</span>}
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge
                    variant="secondary"
                    className="gap-1 whitespace-nowrap px-1.5 text-xs"
                  >
                    <Users className="h-3 w-3 shrink-0" />
                    {family.members.length}{' '}
                    {family.members.length === 1 ? 'Kid' : 'Kids'}
                  </Badge>
                  <ShiftBadge shift={family.members[0]?.shift ?? null} />
                </div>
              </div>

              {/* Combined Status */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    Bank Info:
                  </span>
                  {family.hasPayment ? (
                    <Badge
                      variant="outline"
                      className="gap-1 border-green-600 text-green-600"
                    >
                      <CheckCircle className="h-3 w-3" />
                      On File
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="gap-1 border-red-600 text-red-600"
                    >
                      <XCircle className="h-3 w-3" />
                      Needed
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  <FamilyStatusBadge status={status} />
                </div>
                {family.hasSubscription && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">
                      Billing:
                    </span>
                    <BillingCell family={family} />
                  </div>
                )}
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
              <TableHead>Parent 1</TableHead>
              <TableHead>Parent 2</TableHead>
              <TableHead># Kids</TableHead>
              <TableHead>Bank Info</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {families.map((family) => {
              const { payer, other } = getOrderedParents(family.members[0])
              const status = getFamilyStatus(family)

              return (
                <TableRow
                  key={family.familyKey}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(family)}
                >
                  <TableCell className="font-medium">{payer}</TableCell>
                  <TableCell className="font-medium">{other || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <Users className="h-3 w-3" />
                        {family.members.length}
                      </Badge>
                      <ShiftBadge shift={family.members[0]?.shift ?? null} />
                    </div>
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
                            ? 'Bank info on file'
                            : 'Bank info needed'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <FamilyStatusBadge status={status} showLabel={false} />
                      {family.hasSubscription && (
                        <BillingCell family={family} />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRowClick(family)
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteDialogFamily(family)
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Family
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Family Details Sheet */}
      <FamilyDetailSheet
        family={selectedFamily}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onFamilyUpdate={handleFamilyUpdate}
        onVerifyBankAccount={(paymentIntentId, parentEmail) => {
          setVerifyBankDialogData({ paymentIntentId, parentEmail })
          setDialogOpen('verifyBank', true)
        }}
      />

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

      {/* Delete Family Dialog */}
      {deleteDialogFamily && (
        <DeleteFamilyDialog
          studentId={deleteDialogFamily.members[0]?.id || ''}
          familyName={formatParentName(
            deleteDialogFamily.members[0]?.parentFirstName,
            deleteDialogFamily.members[0]?.parentLastName
          )}
          hasActiveSubscription={
            deleteDialogFamily.hasSubscription &&
            deleteDialogFamily.members[0]?.subscriptionStatus === 'active'
          }
          open={!!deleteDialogFamily}
          onOpenChange={(open) => {
            if (!open) setDeleteDialogFamily(null)
          }}
        />
      )}
    </TooltipProvider>
  )
}
