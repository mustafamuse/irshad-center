'use client'

import { useState } from 'react'

import { format } from 'date-fns'
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
import { SHIFT_BADGES } from '@/lib/constants/dugsi'
import { cn } from '@/lib/utils'

import { formatCheckinDate } from './date-utils'
import { CheckinRecord } from '../actions'
import { DeleteCheckinDialog } from './delete-checkin-dialog'
import { EditCheckinDialog } from './edit-checkin-dialog'

interface Props {
  checkin: CheckinRecord
  onUpdated?: () => void
  onDeleted?: () => void
}

function formatTime(date: Date): string {
  return format(new Date(date), 'h:mm a')
}

export function CheckinCard({ checkin, onUpdated, onDeleted }: Props) {
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  return (
    <>
      <div className="space-y-2 rounded-lg border p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium">{checkin.teacherName}</p>
            <p className="text-sm text-muted-foreground">
              {formatCheckinDate(checkin.date)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn('text-xs', SHIFT_BADGES[checkin.shift].className)}
            >
              {SHIFT_BADGES[checkin.shift].label}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowEdit(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowDelete(true)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5">
            {checkin.clockInValid ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-red-500" />
            )}
            <span>{formatTime(checkin.clockInTime)}</span>
            <span className="text-muted-foreground">-</span>
            <span>
              {checkin.clockOutTime ? formatTime(checkin.clockOutTime) : '-'}
            </span>
          </div>
          {checkin.isLate ? (
            <Badge
              variant="outline"
              className="border-orange-200 bg-orange-100 text-xs text-orange-800"
            >
              Late
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-green-200 bg-green-100 text-xs text-green-800"
            >
              On Time
            </Badge>
          )}
        </div>
      </div>

      {showEdit && (
        <EditCheckinDialog
          open={showEdit}
          onOpenChange={(open) => !open && setShowEdit(false)}
          checkin={checkin}
          onSuccess={() => {
            setShowEdit(false)
            onUpdated?.()
          }}
        />
      )}

      {showDelete && (
        <DeleteCheckinDialog
          open={showDelete}
          onOpenChange={(open) => !open && setShowDelete(false)}
          checkin={checkin}
          onSuccess={() => {
            setShowDelete(false)
            onDeleted?.()
          }}
        />
      )}
    </>
  )
}
