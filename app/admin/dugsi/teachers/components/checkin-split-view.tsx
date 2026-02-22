'use client'

import { useMemo, useState } from 'react'

import { Shift } from '@prisma/client'
import { UserCheck, UserX } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { CheckinRecord, TeacherCheckinStatusForClient } from '../actions'
import { AdminCheckinDialog } from './admin-checkin-dialog'
import { CheckinCard } from './checkin-card'
import { CheckinTable } from './checkin-table'

interface Props {
  teachers: TeacherCheckinStatusForClient[]
  shift: Shift
  date: Date
  onRefresh: () => void
}

interface PendingCheckin {
  teacherId: string
  teacherName: string
}

export function CheckinSplitView({ teachers, shift, date, onRefresh }: Props) {
  const [pendingCheckin, setPendingCheckin] = useState<PendingCheckin | null>(
    null
  )

  const { notCheckedIn, checkedInRecords } = useMemo(() => {
    const notChecked: { id: string; name: string }[] = []
    const records: CheckinRecord[] = []

    for (const teacher of teachers) {
      if (!teacher.shifts.includes(shift)) continue

      const checkin =
        shift === 'MORNING' ? teacher.morningCheckin : teacher.afternoonCheckin

      if (checkin) {
        records.push(checkin)
      } else {
        notChecked.push({ id: teacher.id, name: teacher.name })
      }
    }

    notChecked.sort((a, b) => a.name.localeCompare(b.name))
    return { notCheckedIn: notChecked, checkedInRecords: records }
  }, [teachers, shift])

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <UserX className="h-4 w-4" />
            Not Checked In ({notCheckedIn.length})
          </div>

          {notCheckedIn.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              All teachers checked in
            </div>
          ) : (
            <div className="space-y-1">
              {notCheckedIn.map((teacher) => (
                <div
                  key={teacher.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <span className="text-sm font-medium">{teacher.name}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPendingCheckin({
                        teacherId: teacher.id,
                        teacherName: teacher.name,
                      })
                    }
                  >
                    Check In
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <UserCheck className="h-4 w-4" />
            Checked In ({checkedInRecords.length})
          </div>

          {checkedInRecords.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No check-ins yet
            </div>
          ) : (
            <>
              <div className="hidden sm:block">
                <CheckinTable
                  checkins={checkedInRecords}
                  onUpdated={onRefresh}
                  onDeleted={onRefresh}
                />
              </div>
              <div className="space-y-2 sm:hidden">
                {checkedInRecords.map((checkin) => (
                  <CheckinCard
                    key={checkin.id}
                    checkin={checkin}
                    onUpdated={onRefresh}
                    onDeleted={onRefresh}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {pendingCheckin && (
        <AdminCheckinDialog
          open={!!pendingCheckin}
          onOpenChange={(open) => !open && setPendingCheckin(null)}
          teacherId={pendingCheckin.teacherId}
          teacherName={pendingCheckin.teacherName}
          shift={shift}
          date={date}
          onSuccess={() => {
            setPendingCheckin(null)
            onRefresh()
          }}
        />
      )}
    </>
  )
}
