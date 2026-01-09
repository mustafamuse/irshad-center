'use client'

import { useState } from 'react'

import {
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  Trash2,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SHIFT_BADGES } from '@/lib/constants/dugsi'
import { cn } from '@/lib/utils'

import { CheckinRecord } from '../actions'
import { formatCheckinDate, formatCheckinTime } from './date-utils'
import { DeleteCheckinDialog } from './delete-checkin-dialog'
import { EditCheckinDialog } from './edit-checkin-dialog'

interface Props {
  checkins: CheckinRecord[]
  onUpdated?: () => void
  onDeleted?: () => void
}

export function CheckinTable({ checkins, onUpdated, onDeleted }: Props) {
  const [editingCheckin, setEditingCheckin] = useState<CheckinRecord | null>(
    null
  )
  const [deletingCheckin, setDeletingCheckin] = useState<CheckinRecord | null>(
    null
  )

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Teacher</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead>Clock In</TableHead>
              <TableHead>Clock Out</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {checkins.map((checkin) => (
              <TableRow key={checkin.id}>
                <TableCell className="font-medium">
                  {checkin.teacherName}
                </TableCell>
                <TableCell>{formatCheckinDate(checkin.date)}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      SHIFT_BADGES[checkin.shift].className
                    )}
                  >
                    {SHIFT_BADGES[checkin.shift].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {checkin.clockInValid ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                    )}
                    <span className="text-sm">
                      {formatCheckinTime(checkin.clockInTime)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {checkin.clockOutTime ? (
                    <span className="text-sm">
                      {formatCheckinTime(checkin.clockOutTime)}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      checkin.isLate
                        ? 'border-orange-200 bg-orange-100 text-orange-800'
                        : 'border-green-200 bg-green-100 text-green-800'
                    )}
                  >
                    {checkin.isLate ? 'Late' : 'On Time'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setEditingCheckin(checkin)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeletingCheckin(checkin)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editingCheckin && (
        <EditCheckinDialog
          open={!!editingCheckin}
          onOpenChange={(open) => !open && setEditingCheckin(null)}
          checkin={editingCheckin}
          onSuccess={() => {
            setEditingCheckin(null)
            onUpdated?.()
          }}
        />
      )}

      {deletingCheckin && (
        <DeleteCheckinDialog
          open={!!deletingCheckin}
          onOpenChange={(open) => !open && setDeletingCheckin(null)}
          checkin={deletingCheckin}
          onSuccess={() => {
            setDeletingCheckin(null)
            onDeleted?.()
          }}
        />
      )}
    </>
  )
}
