'use client'

import { useState } from 'react'

import { Users, CheckCircle, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

import { FamilyDetailSheet } from './family-detail-sheet'
import { FamilyStatusBadge } from './family-status-badge'
import { Family } from '../../_types'
import { getFamilyStatus } from '../../_utils/family'
import { formatParentName, hasSecondParent } from '../../_utils/format'
import { useDugsiUIStore } from '../../store'
import { VerifyBankDialog } from '../dialogs/verify-bank-dialog'

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
              <TableHead>Bank Info</TableHead>
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
                            ? 'Bank info on file'
                            : 'Bank info needed'}
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
      <FamilyDetailSheet
        family={selectedFamily}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
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
    </TooltipProvider>
  )
}
