'use client'

import { format } from 'date-fns'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'

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
import {
  CHECKIN_STATUS_BADGES,
  LOCATION_STATUS_BADGES,
} from '@/lib/constants/teacher-checkin'

import type { TeacherCheckinWithRelations } from '../_types'

interface CheckinTableProps {
  checkins: TeacherCheckinWithRelations[]
  onEdit?: (checkin: TeacherCheckinWithRelations) => void
  onDelete?: (checkin: TeacherCheckinWithRelations) => void
  showDate?: boolean
}

export function CheckinTable({
  checkins,
  onEdit,
  onDelete,
  showDate = false,
}: CheckinTableProps) {
  const formatTime = (date: Date) => format(new Date(date), 'h:mm a')

  if (checkins.length === 0) {
    return (
      <div className="hidden flex-col items-center justify-center py-12 text-muted-foreground lg:flex">
        <p>No check-in records found</p>
      </div>
    )
  }

  return (
    <div className="hidden lg:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Teacher</TableHead>
            {showDate && <TableHead>Date</TableHead>}
            <TableHead>Shift</TableHead>
            <TableHead>Clock In</TableHead>
            <TableHead>Clock Out</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Location</TableHead>
            {(onEdit || onDelete) && (
              <TableHead className="w-[50px]"></TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {checkins.map((checkin) => {
            const statusBadge = checkin.clockOutTime
              ? CHECKIN_STATUS_BADGES.CLOCKED_OUT
              : checkin.isLate
                ? CHECKIN_STATUS_BADGES.LATE
                : CHECKIN_STATUS_BADGES.ON_TIME

            const locationBadge = checkin.clockInValid
              ? LOCATION_STATUS_BADGES.VALID
              : LOCATION_STATUS_BADGES.INVALID

            return (
              <TableRow key={checkin.id}>
                <TableCell className="font-medium">
                  {checkin.teacher.person.name}
                </TableCell>
                {showDate && (
                  <TableCell>
                    {format(new Date(checkin.date), 'MMM d, yyyy')}
                  </TableCell>
                )}
                <TableCell>
                  <Badge variant="secondary">{checkin.shift}</Badge>
                </TableCell>
                <TableCell>{formatTime(checkin.clockInTime)}</TableCell>
                <TableCell>
                  {checkin.clockOutTime
                    ? formatTime(checkin.clockOutTime)
                    : '-'}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusBadge.className}>
                    {statusBadge.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={locationBadge.className}>
                    {locationBadge.label}
                  </Badge>
                </TableCell>
                {(onEdit || onDelete) && (
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(checkin)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <DropdownMenuItem
                            onClick={() => onDelete(checkin)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
