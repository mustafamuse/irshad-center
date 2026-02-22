'use client'

import { useState, useMemo, useCallback, useRef } from 'react'

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  flexRender,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Users } from 'lucide-react'

import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TooltipProvider } from '@/components/ui/tooltip'

import { BulkActionsBar } from './bulk-actions-bar'
import { createColumns } from './columns'
import { MobileFamilyCard } from './mobile-family-card'
import { Family } from '../../_types'
import { formatParentName } from '../../_utils/format'
import { useDugsiUIStore } from '../../store'
import { VerifyBankDialog } from '../dialogs/verify-bank-dialog'
import { WithdrawFamilyDialog } from '../dialogs/withdraw-family-dialog'
import { FamilyDetailSheet } from '../family-management/family-detail-sheet'

interface FamilyDataTableProps {
  families: Family[]
}

export function FamilyDataTable({ families }: FamilyDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [selectedFamilyKey, setSelectedFamilyKey] = useState<string | null>(
    null
  )
  const selectedFamily = useMemo(
    () => families.find((f) => f.familyKey === selectedFamilyKey) ?? null,
    [families, selectedFamilyKey]
  )
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [withdrawDialogFamily, setWithdrawDialogFamily] =
    useState<Family | null>(null)

  const selectedFamilyIds = useDugsiUIStore((state) => state.selectedFamilyIds)
  const setSelectedFamilyIds = useDugsiUIStore(
    (state) => state.setSelectedFamilyIds
  )
  const toggleFamilySelection = useDugsiUIStore(
    (state) => state.toggleFamilySelection
  )

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

  const handleViewDetails = useCallback((family: Family) => {
    setSelectedFamilyKey(family.familyKey)
    setIsSheetOpen(true)
  }, [])

  const handleDelete = useCallback((family: Family) => {
    setWithdrawDialogFamily(family)
  }, [])

  const columns = useMemo(
    () =>
      createColumns({
        onViewDetails: handleViewDetails,
        onDelete: handleDelete,
      }),
    [handleViewDetails, handleDelete]
  )

  const rowSelection = useMemo(() => {
    const selection: Record<string, boolean> = {}
    selectedFamilyIds.forEach((id) => {
      selection[id] = true
    })
    return selection
  }, [selectedFamilyIds])

  const table = useReactTable({
    data: families,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    enableRowSelection: true,
    getRowId: (row) => row.familyKey,
    onRowSelectionChange: (updater) => {
      const newSelection =
        typeof updater === 'function' ? updater(rowSelection) : updater
      const selectedIds = new Set(
        Object.keys(newSelection).filter((k) => newSelection[k])
      )
      setSelectedFamilyIds(selectedIds)
    },
    state: {
      sorting,
      rowSelection,
    },
  })

  const selectedFamilies = useMemo(
    () => table.getSelectedRowModel().rows.map((row) => row.original),
    [table]
  )

  const rows = table.getRowModel().rows

  const mobileParentRef = useRef<HTMLDivElement>(null)

  const mobileVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => mobileParentRef.current,
    estimateSize: () => 80,
    overscan: 3,
  })

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
      {/* Mobile Card Layout (below md breakpoint) */}
      <div
        ref={mobileParentRef}
        className="block max-h-[calc(100vh-300px)] min-h-[400px] overflow-auto md:hidden"
      >
        <div
          className="relative w-full"
          style={{ height: `${mobileVirtualizer.getTotalSize()}px` }}
        >
          {mobileVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]
            return (
              <div
                key={row.id}
                className="absolute left-0 top-0 w-full pb-3"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  height: `${virtualRow.size}px`,
                }}
              >
                <MobileFamilyCard
                  family={row.original}
                  isSelected={row.getIsSelected()}
                  onSelect={() => toggleFamilySelection(row.original.familyKey)}
                  onClick={() => handleViewDetails(row.original)}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Desktop Table Layout (md and above) */}
      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleViewDetails(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Bulk Actions Bar */}
      <BulkActionsBar selectedFamilies={selectedFamilies} />

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

      {/* Withdraw Family Dialog */}
      {withdrawDialogFamily && (
        <WithdrawFamilyDialog
          familyReferenceId={
            withdrawDialogFamily.members[0]?.familyReferenceId || ''
          }
          familyName={formatParentName(
            withdrawDialogFamily.members[0]?.parentFirstName,
            withdrawDialogFamily.members[0]?.parentLastName
          )}
          hasActiveSubscription={
            withdrawDialogFamily.hasSubscription &&
            withdrawDialogFamily.members[0]?.subscriptionStatus === 'active'
          }
          open={!!withdrawDialogFamily}
          onOpenChange={(open) => {
            if (!open) setWithdrawDialogFamily(null)
          }}
        />
      )}
    </TooltipProvider>
  )
}
