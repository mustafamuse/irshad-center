'use client'

import { useMemo } from 'react'

import { Shift } from '@prisma/client'
import { format } from 'date-fns'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { AttendanceGridData } from '../actions'

interface Props {
  data: AttendanceGridData
  shiftFilter: Shift | 'all'
  teacherFilter?: string
}

type CellStatus = 'present' | 'late' | 'absent' | 'not-assigned'

interface GridRow {
  teacherId: string
  teacherName: string
  shift: Shift
  cells: { date: string; status: CellStatus; clockInTime?: Date }[]
  absenceCount: number
}

function getCellColor(status: CellStatus): string {
  switch (status) {
    case 'present':
      return 'bg-green-500'
    case 'late':
      return 'bg-yellow-400'
    case 'absent':
      return 'bg-red-500'
    case 'not-assigned':
      return 'bg-muted'
  }
}

function getCellLabel(status: CellStatus): string {
  switch (status) {
    case 'present':
      return 'On time'
    case 'late':
      return 'Late'
    case 'absent':
      return 'Absent'
    case 'not-assigned':
      return 'Not assigned'
  }
}

function formatColumnDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return format(d, 'EEE M/d')
}

function formatTooltipDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return format(new Date(year, month - 1, day), 'EEEE, MMM d, yyyy')
}

export function AttendanceGrid({ data, shiftFilter, teacherFilter }: Props) {
  const rows = useMemo(() => {
    const recordMap = new Map<string, { isLate: boolean; clockInTime: Date }>()
    for (const r of data.records) {
      recordMap.set(`${r.teacherId}-${r.date}-${r.shift}`, {
        isLate: r.isLate,
        clockInTime: r.clockInTime,
      })
    }

    const gridRows: GridRow[] = []

    for (const teacher of data.teachers) {
      if (teacherFilter && teacher.id !== teacherFilter) continue

      const shifts =
        shiftFilter !== 'all'
          ? teacher.shifts.filter((s) => s === shiftFilter)
          : teacher.shifts

      if (shifts.length === 0) continue

      for (const shift of shifts) {
        const cells = data.dates.map((dateStr) => {
          if (!teacher.shifts.includes(shift)) {
            return { date: dateStr, status: 'not-assigned' as CellStatus }
          }

          const record = recordMap.get(`${teacher.id}-${dateStr}-${shift}`)

          if (record) {
            return {
              date: dateStr,
              status: (record.isLate ? 'late' : 'present') as CellStatus,
              clockInTime: record.clockInTime,
            }
          }

          return { date: dateStr, status: 'absent' as CellStatus }
        })

        const absenceCount = cells.filter((c) => c.status === 'absent').length

        gridRows.push({
          teacherId: teacher.id,
          teacherName: teacher.name,
          shift,
          cells,
          absenceCount,
        })
      }
    }

    return gridRows
  }, [data, shiftFilter, teacherFilter])

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">
          No attendance data for the selected filters
        </p>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
            On time
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-yellow-400" />
            Late
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
            Absent
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-muted" />
            N/A
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-medium">
                  Teacher
                </th>
                <th className="px-2 py-2 text-center font-medium">Shift</th>
                {data.dates.map((dateStr) => (
                  <th
                    key={dateStr}
                    className="whitespace-nowrap px-1 py-2 text-center text-xs font-medium"
                  >
                    {formatColumnDate(dateStr)}
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-medium">Absent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.teacherId}-${row.shift}`}
                  className="border-b last:border-b-0"
                >
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-background px-3 py-2 font-medium">
                    {row.teacherName}
                  </td>
                  <td className="px-2 py-2 text-center text-xs text-muted-foreground">
                    {row.shift === 'MORNING' ? 'AM' : 'PM'}
                  </td>
                  {row.cells.map((cell) => (
                    <td key={cell.date} className="px-1 py-2 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              'mx-auto block h-4 w-4 rounded-full',
                              getCellColor(cell.status),
                              cell.status === 'not-assigned' &&
                                'h-1 w-4 rounded-sm'
                            )}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">
                            {formatTooltipDate(cell.date)}
                          </p>
                          <p>
                            {getCellLabel(cell.status)}
                            {cell.clockInTime &&
                              ` - ${format(new Date(cell.clockInTime), 'h:mm a')}`}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center">
                    <span
                      className={cn(
                        'inline-flex min-w-[24px] items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-medium',
                        row.absenceCount > 0
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      )}
                    >
                      {row.absenceCount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  )
}
