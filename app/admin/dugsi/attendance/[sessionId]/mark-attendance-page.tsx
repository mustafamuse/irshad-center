'use client'

import { memo, useCallback, useState, useTransition } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { format } from 'date-fns'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import type { AttendanceRecordForMarking } from '@/lib/mappers/attendance-mapper'

import { DugsiAttendanceStatus } from '../_types'
import { markAttendance } from '../actions'

interface SessionInfo {
  id: string
  date: string
  isClosed: boolean
  className: string
  shift: string
  teacherName: string
}

interface Student {
  programProfileId: string
  name: string
}

interface Props {
  session: SessionInfo
  students: Student[]
  attendance: AttendanceRecordForMarking[]
}

interface RecordState {
  programProfileId: string
  status: DugsiAttendanceStatus | null
  lessonCompleted: boolean
  surahName: string
  ayatFrom: string
  ayatTo: string
  lessonNotes: string
  notes: string
}

const statusConfig = [
  {
    value: DugsiAttendanceStatus.PRESENT,
    label: 'Present',
    short: 'P',
    activeClass: 'bg-green-600 text-white border-green-600',
    cardAccent: 'border-l-green-600',
  },
  {
    value: DugsiAttendanceStatus.ABSENT,
    label: 'Absent',
    short: 'A',
    activeClass: 'bg-red-600 text-white border-red-600',
    cardAccent: 'border-l-red-600',
  },
  {
    value: DugsiAttendanceStatus.LATE,
    label: 'Late',
    short: 'L',
    activeClass: 'bg-yellow-500 text-white border-yellow-500',
    cardAccent: 'border-l-yellow-500',
  },
  {
    value: DugsiAttendanceStatus.EXCUSED,
    label: 'Excused',
    short: 'E',
    activeClass: 'bg-blue-600 text-white border-blue-600',
    cardAccent: 'border-l-blue-600',
  },
] as const

function initRecords(
  students: Student[],
  attendance: AttendanceRecordForMarking[]
): RecordState[] {
  return students.map((student) => {
    const existing = attendance.find(
      (a) => a.programProfileId === student.programProfileId
    )
    return {
      programProfileId: student.programProfileId,
      status: existing?.status ?? null,
      lessonCompleted: existing?.lessonCompleted ?? false,
      surahName: existing?.surahName ?? '',
      ayatFrom: existing?.ayatFrom?.toString() ?? '',
      ayatTo: existing?.ayatTo?.toString() ?? '',
      lessonNotes: existing?.lessonNotes ?? '',
      notes: existing?.notes ?? '',
    }
  })
}

interface StudentRowProps {
  student: Student
  record: RecordState
  isClosed: boolean
  updateRecord: (profileId: string, updates: Partial<RecordState>) => void
}

const StudentRow = memo(function StudentRow({
  student,
  record,
  isClosed,
  updateRecord,
}: StudentRowProps) {
  return (
    <Collapsible
      className={`rounded-lg border border-l-4 bg-card ${
        record.status === null
          ? 'border-l-muted-foreground/30'
          : (statusConfig.find((s) => s.value === record.status)?.cardAccent ??
            '')
      }`}
    >
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium">{student.name}</span>
          <CollapsibleTrigger className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <span>Lesson</span>
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
          </CollapsibleTrigger>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {statusConfig.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={isClosed}
              className={`min-h-[48px] rounded-full border text-sm font-medium transition-colors ${
                record.status === opt.value
                  ? opt.activeClass
                  : 'border-border bg-muted/50 text-foreground'
              } ${isClosed ? 'opacity-60' : ''}`}
              onClick={() =>
                updateRecord(student.programProfileId, { status: opt.value })
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <CollapsibleContent>
        <div className="space-y-3 border-t px-3 pb-3 pt-3">
          <div className="flex items-center gap-2">
            <Checkbox
              disabled={isClosed}
              checked={record.lessonCompleted}
              onCheckedChange={(checked) =>
                updateRecord(student.programProfileId, {
                  lessonCompleted: checked === true,
                })
              }
            />
            <label className="text-sm">Lesson completed</label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input
              disabled={isClosed}
              placeholder="Surah"
              value={record.surahName}
              onChange={(e) =>
                updateRecord(student.programProfileId, {
                  surahName: e.target.value,
                })
              }
            />
            <Input
              disabled={isClosed}
              placeholder="From"
              type="number"
              value={record.ayatFrom}
              onChange={(e) =>
                updateRecord(student.programProfileId, {
                  ayatFrom: e.target.value,
                })
              }
            />
            <Input
              disabled={isClosed}
              placeholder="To"
              type="number"
              value={record.ayatTo}
              onChange={(e) =>
                updateRecord(student.programProfileId, {
                  ayatTo: e.target.value,
                })
              }
            />
          </div>
          <Input
            disabled={isClosed}
            placeholder="Notes..."
            value={record.notes}
            onChange={(e) =>
              updateRecord(student.programProfileId, {
                notes: e.target.value,
              })
            }
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
})

export function MarkAttendancePage({ session, students, attendance }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [records, setRecords] = useState<RecordState[]>(() =>
    initRecords(students, attendance)
  )

  const updateRecord = useCallback(
    (profileId: string, updates: Partial<RecordState>) => {
      setRecords((prev) =>
        prev.map((r) =>
          r.programProfileId === profileId ? { ...r, ...updates } : r
        )
      )
    },
    []
  )

  function handleBulkAction(status: DugsiAttendanceStatus) {
    setRecords((prev) => prev.map((r) => ({ ...r, status })))
  }

  function handleSave() {
    if (records.some((r) => r.status === null)) {
      toast.error('Please mark attendance for all students')
      return
    }
    startTransition(async () => {
      const result = await markAttendance({
        sessionId: session.id,
        records: records.map((r) => ({
          programProfileId: r.programProfileId,
          status: r.status as DugsiAttendanceStatus,
          lessonCompleted: r.lessonCompleted,
          surahName: r.surahName || undefined,
          ayatFrom: r.ayatFrom ? parseInt(r.ayatFrom) : undefined,
          ayatTo: r.ayatTo ? parseInt(r.ayatTo) : undefined,
          lessonNotes: r.lessonNotes || undefined,
          notes: r.notes || undefined,
        })),
      })
      if (result.success) {
        toast.success('Attendance saved')
        router.push('/admin/dugsi/attendance')
      } else {
        toast.error(result.error || 'Failed to save attendance')
      }
    })
  }

  const unmarkedCount = records.filter((r) => r.status === null).length
  const presentCount = records.filter(
    (r) =>
      r.status === DugsiAttendanceStatus.PRESENT ||
      r.status === DugsiAttendanceStatus.LATE
  ).length

  return (
    <div className="container mx-auto pb-32">
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/dugsi/attendance"
            className="mt-1 rounded-md p-1 hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">
                {session.teacherName.split(' ')[0]} -{' '}
                {session.shift === 'MORNING' ? 'AM' : 'PM'}
              </h1>
              {session.isClosed && <Badge variant="secondary">Closed</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {format(new Date(session.date), 'EEE, MM/dd')} · {students.length}{' '}
              students
            </p>
          </div>
        </div>

        {students.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No enrolled students found for this class.
          </p>
        ) : (
          <>
            {!session.isClosed && (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted"
                  onClick={() =>
                    handleBulkAction(DugsiAttendanceStatus.PRESENT)
                  }
                >
                  All Present
                </button>
                <button
                  type="button"
                  className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted"
                  onClick={() => handleBulkAction(DugsiAttendanceStatus.ABSENT)}
                >
                  All Absent
                </button>
              </div>
            )}

            <div className="space-y-2">
              {students.map((student) => {
                const record = records.find(
                  (r) => r.programProfileId === student.programProfileId
                )
                if (!record) return null
                return (
                  <StudentRow
                    key={student.programProfileId}
                    student={student}
                    record={record}
                    isClosed={session.isClosed}
                    updateRecord={updateRecord}
                  />
                )
              })}
            </div>
          </>
        )}
      </div>

      {!session.isClosed && students.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-background p-4">
          <div className="container mx-auto flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              {unmarkedCount > 0
                ? `${unmarkedCount} unmarked`
                : `${presentCount}/${students.length} present`}
            </span>
            <Button
              className="flex-1 sm:flex-none"
              disabled={isPending || unmarkedCount > 0}
              onClick={handleSave}
            >
              {isPending
                ? 'Saving...'
                : unmarkedCount > 0
                  ? `Mark all students (${unmarkedCount} remaining)`
                  : 'Save Attendance'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
