'use client'

import { useState, useMemo, useRef } from 'react'

import dynamic from 'next/dynamic'

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { User } from 'lucide-react'

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
import { MobileStudentCard } from './mobile-student-card'
import { StudentDetailSheet } from './student-detail-sheet'
import { MahadBatch, MahadStudent } from '../../_types'
import { useMahadUIStore } from '../../store'

const DeleteStudentDialog = dynamic(
  () =>
    import('../dialogs/delete-student-dialog').then(
      (mod) => mod.DeleteStudentDialog
    ),
  { ssr: false }
)
const PaymentLinkDialog = dynamic(
  () =>
    import('../dialogs/payment-link-dialog').then(
      (mod) => mod.PaymentLinkDialog
    ),
  { ssr: false }
)

interface StudentsTableProps {
  students: MahadStudent[]
  batches: MahadBatch[]
}

function findStudentById(
  students: MahadStudent[],
  id: string | null
): MahadStudent | null {
  if (!id) return null
  return students.find((s) => s.id === id) ?? null
}

export function StudentsTable({ students, batches }: StudentsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null
  )
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [paymentLinkStudentId, setPaymentLinkStudentId] = useState<
    string | null
  >(null)
  const [deleteStudentId, setDeleteStudentId] = useState<string | null>(null)
  const mobileParentRef = useRef<HTMLDivElement>(null)
  const desktopParentRef = useRef<HTMLDivElement>(null)

  const selectedStudentIds = useMahadUIStore(
    (state) => state.selectedStudentIds
  )
  const { setSelectedStudentIds, toggleStudent: toggleStudentSelection } =
    useMahadUIStore.getState()

  function handleViewDetails(student: MahadStudent): void {
    setSelectedStudentId(student.id)
    setIsSheetOpen(true)
  }

  function handleDelete(student: MahadStudent): void {
    setDeleteStudentId(student.id)
  }

  function handleGeneratePaymentLink(student: MahadStudent): void {
    setPaymentLinkStudentId(student.id)
  }

  const columns = useMemo(
    () =>
      createColumns({
        onViewDetails: handleViewDetails,
        onDelete: handleDelete,
        onGeneratePaymentLink: handleGeneratePaymentLink,
      }),
    []
  )

  const rowSelection = useMemo(
    () =>
      Object.fromEntries(
        Array.from(selectedStudentIds).map((id) => [id, true])
      ),
    [selectedStudentIds]
  )

  const table = useReactTable({
    data: students,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    enableRowSelection: true,
    getRowId: (row) => row.id,
    onRowSelectionChange: (updater) => {
      const newSelection =
        typeof updater === 'function' ? updater(rowSelection) : updater
      const selectedIds = new Set(
        Object.keys(newSelection).filter((k) => newSelection[k])
      )
      setSelectedStudentIds(selectedIds)
    },
    state: {
      sorting,
      rowSelection,
    },
  })

  const rows = table.getRowModel().rows
  const selectedStudents = table
    .getSelectedRowModel()
    .rows.map((r) => r.original)

  const mobileVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => mobileParentRef.current,
    estimateSize: () => 160,
    overscan: 3,
  })

  const desktopVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => desktopParentRef.current,
    estimateSize: () => 53,
    overscan: 5,
  })

  const selectedStudent = findStudentById(students, selectedStudentId)
  const paymentLinkStudent = findStudentById(students, paymentLinkStudentId)
  const deleteStudent = findStudentById(students, deleteStudentId)

  if (students.length === 0) {
    return (
      <EmptyState
        icon={<User />}
        title="No students found"
        description="Try adjusting your filters or add new students"
      />
    )
  }

  return (
    <TooltipProvider>
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
                <MobileStudentCard
                  student={row.original}
                  isSelected={row.getIsSelected()}
                  onSelect={() => toggleStudentSelection(row.original.id)}
                  onClick={() => handleViewDetails(row.original)}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div
        ref={desktopParentRef}
        className="hidden max-h-[calc(100vh-300px)] min-h-[400px] overflow-auto rounded-md border md:block"
      >
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
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
            {desktopVirtualizer.getVirtualItems().length > 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="p-0"
                  style={{
                    height: `${desktopVirtualizer.getVirtualItems()[0]?.start ?? 0}px`,
                  }}
                />
              </TableRow>
            )}
            {desktopVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index]
              return (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleViewDetails(row.original)}
                  style={{ height: `${virtualRow.size}px` }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
            {desktopVirtualizer.getVirtualItems().length > 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="p-0"
                  style={{
                    height: `${desktopVirtualizer.getTotalSize() - (desktopVirtualizer.getVirtualItems().at(-1)?.end ?? 0)}px`,
                  }}
                />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <BulkActionsBar selectedStudents={selectedStudents} batches={batches} />

      <StudentDetailSheet
        student={selectedStudent}
        batches={batches}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
      />

      <PaymentLinkDialog
        profileId={paymentLinkStudent?.id ?? ''}
        studentName={paymentLinkStudent?.name ?? ''}
        open={!!paymentLinkStudent}
        onOpenChange={(open) => !open && setPaymentLinkStudentId(null)}
      />

      {deleteStudent && (
        <DeleteStudentDialog
          studentId={deleteStudent.id}
          studentName={deleteStudent.name}
          open={!!deleteStudent}
          onOpenChange={(open) => {
            if (!open) setDeleteStudentId(null)
          }}
          onDeleted={() => setDeleteStudentId(null)}
        />
      )}
    </TooltipProvider>
  )
}
