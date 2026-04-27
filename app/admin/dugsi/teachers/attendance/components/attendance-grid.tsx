'use client'

import { Fragment, useMemo, useState } from 'react'

import { Shift, TeacherAttendanceStatus } from '@prisma/client'
import { formatInTimeZone } from 'date-fns-tz'

import {
  AttendanceRecordGridWithRelations,
  TeacherShift,
} from '@/lib/db/queries/teacher-attendance'
import { cn } from '@/lib/utils'
import { formatWeekendDate } from '@/lib/utils/format-date'

import { AttendanceStatusBadge } from './status-badge'
import { StatusOverrideDialog } from './status-override-dialog'

interface Props {
  records: AttendanceRecordGridWithRelations[]
  weekendDates: string[] // YYYY-MM-DD, descending
  closureDates: Set<string>
  allTeachers: TeacherShift[] // full active roster — ensures teachers with no records in window still appear
  truncated?: boolean // true when results were capped at 1000 rows; empty cells may be missing data
}

type CellKey = `${string}|${string}|${Shift}`

type OverrideCell = {
  recordId: string
  teacherName: string
  date: string
  shift: Shift
  currentStatus: TeacherAttendanceStatus
}

const SHIFTS: Shift[] = ['MORNING', 'AFTERNOON']

function rowBg(idx: number) {
  return idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'
}

export function AttendanceGrid({
  records,
  weekendDates,
  closureDates,
  allTeachers,
  truncated = false,
}: Props) {
  const [overrideCell, setOverrideCell] = useState<OverrideCell | null>(null)

  function openOverride(
    record: AttendanceRecordGridWithRelations,
    teacherName: string,
    date: string,
    shift: Shift
  ) {
    setOverrideCell({
      recordId: record.id,
      teacherName,
      date,
      shift,
      currentStatus: record.status,
    })
  }

  // Build lookup: "teacherId|date|shift" → record
  const { recordMap, teachers } = useMemo(() => {
    const recordMap = new Map<CellKey, AttendanceRecordGridWithRelations>()
    // shifts is omitted — the render loop always iterates ['MORNING','AFTERNOON'] directly.
    const teacherMap = new Map<string, { id: string; name: string }>()

    // Seed from active roster first — teachers with no records in this window
    // still get a row with '—' cells, making them visible rather than silently absent.
    for (const t of allTeachers) {
      teacherMap.set(t.teacherId, { id: t.teacherId, name: t.name })
    }

    for (const r of records) {
      const dateStr = formatInTimeZone(r.date, 'UTC', 'yyyy-MM-dd')
      const key: CellKey = `${r.teacherId}|${dateStr}|${r.shift}`
      recordMap.set(key, r)
      if (!teacherMap.has(r.teacherId)) {
        // Inactive teacher with historical records — not in allTeachers but still shown.
        teacherMap.set(r.teacherId, {
          id: r.teacherId,
          name: r.teacher.person.name,
        })
      }
    }

    const teachers = Array.from(teacherMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    )

    return { recordMap, teachers }
  }, [records, allTeachers])

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left font-medium text-muted-foreground">
                Teacher
              </th>
              {weekendDates.map((date) => {
                const isClosed = closureDates.has(date)
                return (
                  <th
                    key={date}
                    className={cn(
                      'min-w-[110px] px-2 py-2 text-center font-medium',
                      isClosed
                        ? 'text-muted-foreground/40 line-through'
                        : 'text-muted-foreground'
                    )}
                    colSpan={2}
                    title={isClosed ? 'School closed' : undefined}
                  >
                    {formatWeekendDate(date)}
                  </th>
                )
              })}
            </tr>
            <tr className="border-b bg-muted/30">
              <th className="sticky left-0 bg-muted/30 px-3 py-1" />
              {weekendDates.map((date) => (
                <Fragment key={date}>
                  <th className="px-1 py-1 text-center text-xs font-normal text-muted-foreground">
                    AM
                  </th>
                  <th className="px-1 py-1 text-center text-xs font-normal text-muted-foreground">
                    PM
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher, idx) => (
              <tr key={teacher.id} className={cn('border-b', rowBg(idx))}>
                <td
                  className={cn(
                    'sticky left-0 px-3 py-2 font-medium',
                    rowBg(idx)
                  )}
                >
                  {teacher.name}
                </td>
                {weekendDates.map((date) => (
                  <Fragment key={date}>
                    {SHIFTS.map((shift) => {
                      const key: CellKey = `${teacher.id}|${date}|${shift}`
                      const record = recordMap.get(key)

                      if (!record) {
                        return (
                          <td key={key} className="px-1 py-2 text-center">
                            <span
                              className={cn(
                                'text-xs',
                                truncated
                                  ? 'cursor-help italic text-muted-foreground/30'
                                  : 'text-muted-foreground/40'
                              )}
                              title={
                                truncated
                                  ? 'Data may be incomplete — narrow the date range'
                                  : undefined
                              }
                            >
                              {truncated ? '?' : '—'}
                            </span>
                          </td>
                        )
                      }

                      return (
                        <td key={key} className="px-1 py-2 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              openOverride(record, teacher.name, date, shift)
                            }
                            className="rounded-sm transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                            title="Click to override"
                            aria-label={`Override ${teacher.name} ${date} ${shift === 'MORNING' ? 'Morning' : 'Afternoon'}`}
                          >
                            <AttendanceStatusBadge
                              status={record.status}
                              source={record.source}
                              minutesLate={record.minutesLate}
                            />
                          </button>
                        </td>
                      )
                    })}
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {overrideCell && (
        <StatusOverrideDialog
          open
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
