'use client'

import { useState } from 'react'

import { Shift } from '@prisma/client'
import { CheckCircle2, Circle, Clock, Sun, Sunset } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { SHIFT_BADGES } from '@/lib/constants/dugsi'
import { cn } from '@/lib/utils'
import { formatPhoneNumber } from '@/lib/utils/formatters'

import { CheckinStatus, TeacherWithDetails } from '../actions'
import { ManageTeacherDialog } from './manage-teacher-dialog'

function formatTime(date: Date | null): string {
  if (!date) return ''
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function ShiftCheckinStatus({
  shift,
  checkin,
  isAssigned,
}: {
  shift: Shift
  checkin: CheckinStatus | null
  isAssigned: boolean
}) {
  if (!isAssigned) return null

  const Icon = shift === 'MORNING' ? Sun : Sunset
  const shiftColor = shift === 'MORNING' ? 'text-[#deb43e]' : 'text-[#007078]'

  if (!checkin) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              <Icon className={cn('h-3.5 w-3.5', shiftColor)} />
              <Circle className="h-3 w-3 text-gray-300" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {shift === 'MORNING' ? 'Morning' : 'Afternoon'}: Not checked in
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (checkin.clockOutTime) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              <Icon className={cn('h-3.5 w-3.5', shiftColor)} />
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {shift === 'MORNING' ? 'Morning' : 'Afternoon'}: Completed
              {checkin.isLate && ' (Late)'}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatTime(checkin.clockInTime)} -{' '}
              {formatTime(checkin.clockOutTime)}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            <Icon className={cn('h-3.5 w-3.5', shiftColor)} />
            <Clock
              className={cn(
                'h-3.5 w-3.5',
                checkin.isLate ? 'text-orange-500' : 'text-green-500'
              )}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {shift === 'MORNING' ? 'Morning' : 'Afternoon'}: Checked in
            {checkin.isLate && ' (Late)'}
          </p>
          <p className="text-xs text-muted-foreground">
            In: {formatTime(checkin.clockInTime)}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface Props {
  teachers: TeacherWithDetails[]
  onTeacherUpdated?: () => void
}

export function TeacherList({ teachers, onTeacherUpdated }: Props) {
  const [selectedTeacher, setSelectedTeacher] =
    useState<TeacherWithDetails | null>(null)

  if (teachers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">
          No teachers found. Create a teacher to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      {/* Desktop table */}
      <Table className="hidden sm:table">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Shifts</TableHead>
            <TableHead>Today</TableHead>
            <TableHead>Classes</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teachers.map((teacher) => (
            <TableRow key={teacher.id}>
              <TableCell className="font-medium">{teacher.name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatPhoneNumber(teacher.phone)}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {teacher.shifts.length > 0 ? (
                    teacher.shifts.map((shift) => (
                      <Badge
                        key={shift}
                        variant="outline"
                        className={cn('text-xs', SHIFT_BADGES[shift].className)}
                      >
                        {SHIFT_BADGES[shift].label}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <ShiftCheckinStatus
                    shift="MORNING"
                    checkin={teacher.morningCheckin}
                    isAssigned={teacher.shifts.includes('MORNING')}
                  />
                  <ShiftCheckinStatus
                    shift="AFTERNOON"
                    checkin={teacher.afternoonCheckin}
                    isAssigned={teacher.shifts.includes('AFTERNOON')}
                  />
                  {teacher.shifts.length === 0 && (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm">{teacher.classCount}</span>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedTeacher(teacher)}
                >
                  Manage
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Mobile cards */}
      <div className="divide-y sm:hidden">
        {teachers.map((teacher) => (
          <div
            key={teacher.id}
            className="cursor-pointer space-y-2 p-4 active:bg-muted/50"
            onClick={() => setSelectedTeacher(teacher)}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{teacher.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatPhoneNumber(teacher.phone)}
                </p>
              </div>
              <div className="flex gap-1">
                {teacher.shifts.map((shift) => (
                  <Badge
                    key={shift}
                    variant="outline"
                    className={cn('text-xs', SHIFT_BADGES[shift].className)}
                  >
                    {SHIFT_BADGES[shift].label}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShiftCheckinStatus
                  shift="MORNING"
                  checkin={teacher.morningCheckin}
                  isAssigned={teacher.shifts.includes('MORNING')}
                />
                <ShiftCheckinStatus
                  shift="AFTERNOON"
                  checkin={teacher.afternoonCheckin}
                  isAssigned={teacher.shifts.includes('AFTERNOON')}
                />
                {teacher.shifts.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    No shifts
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {teacher.classCount}{' '}
                {teacher.classCount === 1 ? 'class' : 'classes'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {selectedTeacher && (
        <ManageTeacherDialog
          open={!!selectedTeacher}
          onOpenChange={(open) => !open && setSelectedTeacher(null)}
          teacher={selectedTeacher}
          onSuccess={() => {
            setSelectedTeacher(null)
            onTeacherUpdated?.()
          }}
        />
      )}
    </div>
  )
}
