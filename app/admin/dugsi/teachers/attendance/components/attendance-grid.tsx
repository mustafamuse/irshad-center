'use client'

import { Fragment, useMemo, useState } from 'react'

import { Shift, TeacherAttendanceStatus } from '@prisma/client'
import { formatInTimeZone } from 'date-fns-tz'

import { AttendanceRecordGridWithRelations } from '@/lib/db/queries/teacher-attendance'
import { cn } from '@/lib/utils'

import { StatusOverrideDialog } from './status-override-dialog'
import { AttendanceStatusBadge } from './status-badge'

interface Props {
  records: AttendanceRecordGridWithRelations[]
  weekendDates: string[] // YYYY-MM-DD, descending
}

type CellKey = `${string}|${string}|${Shift}`

export function AttendanceGrid({ records, weekendDates }: Props) {
  const [overrideCell, setOverrideCell] = useState<{
    recordId: string
    teacherName: string
    date: string
    shift: Shift
    currentStatus: TeacherAttendanceStatus
  } | null>(null)

  // Build lookup: "teacherId|date|shift" → record
  const { recordMap, teachers } = useMemo(() => {
    const recordMap = new Map<CellKey, AttendanceRecordGridWithRelations>()
    const teacherMap = new Map<string, { id: string; name: string; shifts: Shift[] }>()

    for (const r of records) {
      const dateStr = formatInTimeZone(r.date, 'UTC', 'yyyy-MM-dd')
      const key: CellKey = `${r.teacherId}|${dateStr}|${r.shift}`
      recordMap.set(key, r)
      if (!teacherMap.has(r.teacherId)) {
        teacherMap.set(r.teacherId, {
          id: r.teacherId,
          name: r.teacher.person.name,
          shifts: [],
        })
      }
      const t = teacherMap.get(r.teacherId)!
      if (!t.shifts.includes(r.shift)) t.shifts.push(r.shift)
    }

    const teachers = Array.from(teacherMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    )

    return { recordMap, teachers }
  }, [records])

  function formatDateHeader(dateStr: string) {
    const d = new Date(`${dateStr}T12:00:00Z`)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left font-medium text-muted-foreground">
                Teacher
              </th>
              {weekendDates.map((date) => (
                <th
                  key={date}
                  className="min-w-[110px] px-2 py-2 text-center font-medium text-muted-foreground"
                  colSpan={2}
                >
                  {formatDateHeader(date)}
                </th>
              ))}
            </tr>
            <tr className="border-b bg-muted/30">
              <th className="sticky left-0 bg-muted/30 px-3 py-1" />
              {weekendDates.map((date) => (
                <Fragment key={date}>
                  <th className="px-1 py-1 text-center text-xs text-muted-foreground font-normal">
                    AM
                  </th>
                  <th className="px-1 py-1 text-center text-xs text-muted-foreground font-normal">
                    PM
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher, idx) => (
              <tr
                key={teacher.id}
                className={cn('border-b', idx % 2 === 0 ? 'bg-white' : 'bg-muted/20')}
              >
                <td className={cn('sticky left-0 px-3 py-2 font-medium', idx % 2 === 0 ? 'bg-white' : 'bg-muted/20')}>
                  {teacher.name}
                </td>
                {weekendDates.map((date) =>
                  (['MORNING', 'AFTERNOON'] as Shift[]).map((shift) => {
                    const key: CellKey = `${teacher.id}|${date}|${shift}`
                    const record = recordMap.get(key)

                    if (!record) {
                      return (
                        <td key={key} className="px-1 py-2 text-center">
                          <span className="text-xs text-muted-foreground/40">—</span>
                        </td>
                      )
                    }

                    return (
                      <td key={key} className="px-1 py-2 text-center">
                        <button
                          onClick={() =>
                            setOverrideCell({
                              recordId: record.id,
                              teacherName: teacher.name,
                              date,
                              shift,
                              currentStatus: record.status,
                            })
                          }
                          className="transition-opacity hover:opacity-70"
                          title="Click to override"
                        >
                          <AttendanceStatusBadge
                            status={record.status}
                            minutesLate={record.minutesLate}
                          />
                        </button>
                      </td>
                    )
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {overrideCell && (
        <StatusOverrideDialog
          open={!!overrideCell}
          onOpenChange={(open) => !open && setOverrideCell(null)}
          recordId={overrideCell.recordId}
          teacherName={overrideCell.teacherName}
          date={overrideCell.date}
          shift={overrideCell.shift}
          currentStatus={overrideCell.currentStatus}
        />
      )}
    </>
  )
}
