'use client'

import { format } from 'date-fns'
import { Clock, MapPin, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  CHECKIN_STATUS_BADGES,
  LOCATION_STATUS_BADGES,
} from '@/lib/constants/teacher-checkin'

import type { TeacherCheckinWithRelations } from '../_types'

interface CheckinCardProps {
  checkin: TeacherCheckinWithRelations
  onEdit?: (checkin: TeacherCheckinWithRelations) => void
  onDelete?: (checkin: TeacherCheckinWithRelations) => void
  showDate?: boolean
}

export function CheckinCard({
  checkin,
  onEdit,
  onDelete,
  showDate = false,
}: CheckinCardProps) {
  const formatTime = (date: Date) => format(new Date(date), 'h:mm a')

  const statusBadge = checkin.clockOutTime
    ? CHECKIN_STATUS_BADGES.CLOCKED_OUT
    : checkin.isLate
      ? CHECKIN_STATUS_BADGES.LATE
      : CHECKIN_STATUS_BADGES.ON_TIME

  const locationBadge = checkin.clockInValid
    ? LOCATION_STATUS_BADGES.VALID
    : LOCATION_STATUS_BADGES.INVALID

  return (
    <Card className="block lg:hidden">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <h3 className="font-semibold">{checkin.teacher.person.name}</h3>
          {showDate && (
            <p className="text-xs text-muted-foreground">
              {format(new Date(checkin.date), 'MMM d, yyyy')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={statusBadge.className}>
            {statusBadge.label}
          </Badge>
          {(onEdit || onDelete) && (
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
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Shift</span>
          <Badge variant="secondary">{checkin.shift}</Badge>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            Clock In
          </span>
          <span>{formatTime(checkin.clockInTime)}</span>
        </div>

        {checkin.clockOutTime && (
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              Clock Out
            </span>
            <span>{formatTime(checkin.clockOutTime)}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3 w-3" />
            Location
          </span>
          <Badge variant="outline" className={locationBadge.className}>
            {locationBadge.label}
          </Badge>
        </div>

        {checkin.notes && (
          <p className="border-t pt-2 text-xs text-muted-foreground">
            {checkin.notes}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
