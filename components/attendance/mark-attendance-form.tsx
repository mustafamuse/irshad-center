'use client'

import {
  memo,
  ReactNode,
  useCallback,
  useMemo,
  useState,
  useTransition,
} from 'react'

import { useRouter } from 'next/navigation'

import { DugsiAttendanceStatus } from '@prisma/client'
import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import type { AttendanceRecordForMarking } from '@/lib/mappers/attendance-mapper'
import { ActionResult } from '@/lib/utils/action-helpers'

export interface SessionInfo {
  id: string
  date: string
  isClosed: boolean
  className: string
  shift: string
  teacherName: string
}

export interface Student {
  programProfileId: string
  name: string
}

export interface RecordState {
  programProfileId: string
  status: DugsiAttendanceStatus | null
  lessonCompleted: boolean
  surahName: string
  ayatFrom: string
  ayatTo: string
  lessonNotes: string
  notes: string
}

interface MarkAttendanceFormProps {
  session: SessionInfo
  students: Student[]
  attendance: AttendanceRecordForMarking[]
  header: ReactNode
  isClosed: boolean
  saveAction: (input: unknown) => Promise<ActionResult<{ recordCount: number }>>
  redirectTo: string
  renderStudentName?: (student: Student) => ReactNode
  hasExistingRecords?: boolean
}

const statusConfig = [
  {
    value: DugsiAttendanceStatus.PRESENT,
    label: 'Present',
    activeClass: 'bg-green-600 text-white border-green-600',
    cardAccent: 'border-l-green-600',
  },
  {
    value: DugsiAttendanceStatus.ABSENT,
    label: 'Absent',
    activeClass: 'bg-red-600 text-white border-red-600',
    cardAccent: 'border-l-red-600',
  },
  {
    value: DugsiAttendanceStatus.LATE,
    label: 'Late',
    activeClass: 'bg-yellow-500 text-white border-yellow-500',
    cardAccent: 'border-l-yellow-500',
  },
  {
    value: DugsiAttendanceStatus.EXCUSED,
    label: 'Excused',
    activeClass: 'bg-blue-600 text-white border-blue-600',
    cardAccent: 'border-l-blue-600',
  },
] as const

const statusConfigMap = new Map(statusConfig.map((s) => [s.value, s]))

function initRecords(
  students: Student[],
  attendance: AttendanceRecordForMarking[]
): RecordState[] {
  const attendanceMap = new Map(attendance.map((a) => [a.programProfileId, a]))
  return students.map((student) => {
    const existing = attendanceMap.get(student.programProfileId)
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
  renderName?: (student: Student) => ReactNode
}

const StudentRow = memo(function StudentRow({
  student,
  record,
  isClosed,
  updateRecord,
  renderName,
}: StudentRowProps) {
  return (
    <Collapsible
      className={`rounded-lg border border-l-4 bg-card ${
        record.status === null
          ? 'border-l-muted-foreground/30'
          : (statusConfigMap.get(record.status!)?.cardAccent ?? '')
      }`}
    >
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          {renderName ? (
            renderName(student)
          ) : (
            <span className="truncate font-medium">{student.name}</span>
          )}
          <CollapsibleTrigger className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <span>Lesson</span>
            <ChevronDown
              aria-hidden="true"
              className="h-4 w-4 shrink-0 transition-transform duration-200 [[data-state=open]_&]:rotate-180"
            />
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
              id={`lesson-${student.programProfileId}`}
              disabled={isClosed}
              checked={record.lessonCompleted}
              onCheckedChange={(checked) =>
                updateRecord(student.programProfileId, {
                  lessonCompleted: checked === true,
                })
              }
            />
            <label
              htmlFor={`lesson-${student.programProfileId}`}
              className="text-sm"
            >
              Lesson completed
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input
              disabled={isClosed}
              aria-label="Surah name"
              placeholder="Surah…"
              value={record.surahName}
              onChange={(e) =>
                updateRecord(student.programProfileId, {
                  surahName: e.target.value,
                })
              }
            />
            <Input
              disabled={isClosed}
              aria-label="Ayat from"
              placeholder="From…"
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
              aria-label="Ayat to"
              placeholder="To…"
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
            aria-label="Notes"
            placeholder="Notes…"
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

export function MarkAttendanceForm({
  session,
  students,
  attendance,
  header,
  isClosed,
  saveAction,
  redirectTo,
  renderStudentName,
  hasExistingRecords,
}: MarkAttendanceFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [records, setRecords] = useState<RecordState[]>(() =>
    initRecords(students, attendance)
  )

  const recordMap = useMemo(
    () => new Map(records.map((r) => [r.programProfileId, r])),
    [records]
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
      const result = await saveAction({
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
        router.push(redirectTo)
      } else {
        toast.error(result.error || 'Failed to save attendance')
      }
    })
  }

  const { unmarkedCount, presentCount } = records.reduce(
    (acc, r) => {
      if (r.status === null) acc.unmarkedCount++
      else if (
        r.status === DugsiAttendanceStatus.PRESENT ||
        r.status === DugsiAttendanceStatus.LATE
      )
        acc.presentCount++
      return acc
    },
    { unmarkedCount: 0, presentCount: 0 }
  )

  return (
    <div className="container mx-auto pb-32">
      <div className="space-y-4 p-4 sm:p-6">
        {header}

        {students.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No enrolled students found for this class.
          </p>
        ) : (
          <>
            {!isClosed && (
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
                const record = recordMap.get(student.programProfileId)
                if (!record) return null
                return (
                  <StudentRow
                    key={student.programProfileId}
                    student={student}
                    record={record}
                    isClosed={isClosed}
                    updateRecord={updateRecord}
                    renderName={renderStudentName}
                  />
                )
              })}
            </div>
          </>
        )}
      </div>

      {!isClosed && students.length > 0 && (
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
                ? 'Saving\u2026'
                : unmarkedCount > 0
                  ? `Mark all students (${unmarkedCount} remaining)`
                  : hasExistingRecords
                    ? 'Save Changes'
                    : 'Save Attendance'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
