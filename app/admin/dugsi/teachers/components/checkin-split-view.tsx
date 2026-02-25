'use client'

import { memo, useMemo, useState } from 'react'

import dynamic from 'next/dynamic'

import { Shift } from '@prisma/client'
import { AlertTriangle, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getCheckinWindowTimes } from '@/lib/constants/teacher-checkin'
import { isShiftPastCutoff } from '@/lib/constants/teacher-checkin-tz'
import { cn } from '@/lib/utils'

import { CheckinRecord, TeacherCheckinStatusForClient } from '../actions'
import { formatCheckinTime } from './date-utils'

const AdminCheckinDialog = dynamic(() =>
  import('./admin-checkin-dialog').then((m) => ({
    default: m.AdminCheckinDialog,
  }))
)
const MarkLateDialog = dynamic(() =>
  import('./mark-late-dialog').then((m) => ({ default: m.MarkLateDialog }))
)
const EditCheckinDialog = dynamic(() =>
  import('./edit-checkin-dialog').then((m) => ({
    default: m.EditCheckinDialog,
  }))
)
const DeleteCheckinDialog = dynamic(() =>
  import('./delete-checkin-dialog').then((m) => ({
    default: m.DeleteCheckinDialog,
  }))
)

interface Props {
  teachers: TeacherCheckinStatusForClient[]
  shift: Shift | null
  date: Date
  onRefresh: () => void
  teacherFilter?: string
}

type DialogState =
  | { type: 'none' }
  | { type: 'checkin'; teacherId: string; teacherName: string; shift: Shift }
  | { type: 'mark-late'; teacherId: string; teacherName: string; shift: Shift }
  | { type: 'edit'; checkin: CheckinRecord }
  | { type: 'delete'; checkin: CheckinRecord }

interface ShiftData {
  shift: Shift
  notCheckedIn: { id: string; name: string }[]
  absent: { id: string; name: string }[]
  checkedInRecords: CheckinRecord[]
}

function computeShiftData(
  teachers: TeacherCheckinStatusForClient[],
  shiftValue: Shift,
  date: Date,
  teacherFilter?: string
): ShiftData {
  const notCheckedIn: { id: string; name: string }[] = []
  const absent: { id: string; name: string }[] = []
  const checkedInRecords: CheckinRecord[] = []

  const pastCutoff = isShiftPastCutoff(shiftValue, date)

  for (const teacher of teachers) {
    if (teacherFilter && teacher.id !== teacherFilter) continue
    if (!teacher.shifts.includes(shiftValue)) continue

    const checkin =
      shiftValue === 'MORNING'
        ? teacher.morningCheckin
        : teacher.afternoonCheckin

    if (checkin) {
      checkedInRecords.push(checkin)
    } else if (pastCutoff) {
      absent.push({ id: teacher.id, name: teacher.name })
    } else {
      notCheckedIn.push({ id: teacher.id, name: teacher.name })
    }
  }

  notCheckedIn.sort((a, b) => a.name.localeCompare(b.name))
  absent.sort((a, b) => a.name.localeCompare(b.name))
  return { shift: shiftValue, notCheckedIn, absent, checkedInRecords }
}

interface ShiftSectionProps {
  data: ShiftData
  onCheckin: (teacherId: string, teacherName: string, shift: Shift) => void
  onMarkLate: (teacherId: string, teacherName: string, shift: Shift) => void
  onEdit: (checkin: CheckinRecord) => void
  onDelete: (checkin: CheckinRecord) => void
}

const ShiftSection = memo(function ShiftSection({
  data,
  onCheckin,
  onMarkLate,
  onEdit,
  onDelete,
}: ShiftSectionProps) {
  const total =
    data.notCheckedIn.length + data.absent.length + data.checkedInRecords.length
  const checkedInCount = data.checkedInRecords.length
  const absentCount = data.absent.length
  const shiftLabel = data.shift === 'MORNING' ? 'Morning' : 'Afternoon'
  const hasRows = total > 0
  const windowTimes = getCheckinWindowTimes(data.shift)

  const headingParts = [`${checkedInCount} of ${total} checked in`]
  if (absentCount > 0) {
    headingParts.push(`${absentCount} absent`)
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">
        {shiftLabel} &mdash; {headingParts.join(', ')}
      </h3>

      {absentCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {absentCount} teacher{absentCount !== 1 ? 's' : ''} absent —{' '}
            {shiftLabel} shift window closed at {windowTimes.close}
          </span>
        </div>
      )}

      {!hasRows ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No teachers assigned to this shift
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {data.absent.map((teacher) => (
            <div
              key={teacher.id}
              className="flex items-center justify-between bg-red-50 px-4 py-2.5"
            >
              <div className="flex items-center gap-2">
                <X className="h-3.5 w-3.5 text-red-500" />
                <span className="text-sm font-medium">{teacher.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-orange-200 text-orange-700 hover:bg-orange-50"
                  onClick={() =>
                    onMarkLate(teacher.id, teacher.name, data.shift)
                  }
                >
                  Mark Late
                </Button>
                <Badge
                  variant="outline"
                  className="border-red-200 bg-red-100 text-xs text-red-800"
                >
                  Absent
                </Badge>
              </div>
            </div>
          ))}

          {data.notCheckedIn.map((teacher) => (
            <div
              key={teacher.id}
              className="flex items-center justify-between bg-muted/30 px-4 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                <span className="text-sm font-medium">{teacher.name}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCheckin(teacher.id, teacher.name, data.shift)}
              >
                Check In
              </Button>
            </div>
          ))}

          {data.checkedInRecords.map((checkin) => (
            <div
              key={checkin.id}
              className="flex items-center justify-between px-4 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium">
                  {checkin.teacherName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {formatCheckinTime(checkin.clockInTime)}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    checkin.isLate
                      ? 'border-orange-200 bg-orange-100 text-orange-800'
                      : 'border-green-200 bg-green-100 text-green-800'
                  )}
                >
                  {checkin.isLate ? 'Late' : 'On Time'}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(checkin)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(checkin)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

export function CheckinSplitView({
  teachers,
  shift,
  date,
  onRefresh,
  teacherFilter,
}: Props) {
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' })

  const shiftSections = useMemo(() => {
    const shifts = shift ? [shift] : [Shift.MORNING, Shift.AFTERNOON]
    return shifts.map((s) => computeShiftData(teachers, s, date, teacherFilter))
  }, [teachers, shift, date, teacherFilter])

  function handleDialogClose() {
    setDialog({ type: 'none' })
  }

  function handleDialogSuccess() {
    setDialog({ type: 'none' })
    onRefresh()
  }

  return (
    <>
      <div className="space-y-6">
        {shiftSections.map((data) => (
          <ShiftSection
            key={data.shift}
            data={data}
            onCheckin={(id, name, s) =>
              setDialog({
                type: 'checkin',
                teacherId: id,
                teacherName: name,
                shift: s,
              })
            }
            onMarkLate={(id, name, s) =>
              setDialog({
                type: 'mark-late',
                teacherId: id,
                teacherName: name,
                shift: s,
              })
            }
            onEdit={(checkin) => setDialog({ type: 'edit', checkin })}
            onDelete={(checkin) => setDialog({ type: 'delete', checkin })}
          />
        ))}
      </div>

      {dialog.type === 'checkin' && (
        <AdminCheckinDialog
          open
          onOpenChange={(open) => !open && handleDialogClose()}
          teacherId={dialog.teacherId}
          teacherName={dialog.teacherName}
          shift={dialog.shift}
          date={date}
          onSuccess={handleDialogSuccess}
        />
      )}

      {dialog.type === 'mark-late' && (
        <MarkLateDialog
          open
          onOpenChange={(open) => !open && handleDialogClose()}
          teacherId={dialog.teacherId}
          teacherName={dialog.teacherName}
          shift={dialog.shift}
          date={date}
          onSuccess={handleDialogSuccess}
        />
      )}

      {dialog.type === 'edit' && (
        <EditCheckinDialog
          open
          onOpenChange={(open) => !open && handleDialogClose()}
          checkin={dialog.checkin}
          onSuccess={handleDialogSuccess}
        />
      )}

      {dialog.type === 'delete' && (
        <DeleteCheckinDialog
          open
          onOpenChange={(open) => !open && handleDialogClose()}
          checkin={dialog.checkin}
          onSuccess={handleDialogSuccess}
        />
      )}
    </>
  )
}
