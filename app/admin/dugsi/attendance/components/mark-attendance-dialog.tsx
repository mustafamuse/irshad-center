'use client'

import { memo, useCallback, useState } from 'react'

import { DugsiAttendanceStatus } from '@prisma/client'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AttendanceRecordForMarking } from '@/lib/mappers/attendance-mapper'

import { markAttendance } from '../actions'

interface Student {
  programProfileId: string
  name: string
}

interface Props {
  sessionId: string
  students: Student[]
  attendance: AttendanceRecordForMarking[]
  triggerLabel?: string
}

const statusOptions = [
  { value: DugsiAttendanceStatus.PRESENT, label: 'Present' },
  { value: DugsiAttendanceStatus.ABSENT, label: 'Absent' },
  { value: DugsiAttendanceStatus.LATE, label: 'Late' },
  { value: DugsiAttendanceStatus.EXCUSED, label: 'Excused' },
]

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

interface StudentRowProps {
  student: Student
  record: RecordState
  updateRecord: (profileId: string, updates: Partial<RecordState>) => void
}

const StudentRow = memo(function StudentRow({
  student,
  record,
  updateRecord,
}: StudentRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium">{student.name}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {statusOptions.map((option) => (
            <Button
              key={option.value}
              className="px-2 py-1 text-xs"
              size="sm"
              variant={record.status === option.value ? 'default' : 'outline'}
              onClick={() =>
                updateRecord(student.programProfileId, {
                  status: option.value,
                })
              }
            >
              {option.label}
            </Button>
          ))}
        </div>
      </TableCell>
      <TableCell>
        <Checkbox
          checked={record.lessonCompleted}
          onCheckedChange={(checked) =>
            updateRecord(student.programProfileId, {
              lessonCompleted: checked === true,
            })
          }
        />
      </TableCell>
      <TableCell>
        <Input
          className="w-24"
          placeholder="Surah"
          value={record.surahName}
          onChange={(e) =>
            updateRecord(student.programProfileId, {
              surahName: e.target.value,
            })
          }
        />
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Input
            className="w-16"
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
            className="w-16"
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
      </TableCell>
      <TableCell>
        <Input
          placeholder="Notes..."
          value={record.notes}
          onChange={(e) =>
            updateRecord(student.programProfileId, {
              notes: e.target.value,
            })
          }
        />
      </TableCell>
    </TableRow>
  )
})

export function MarkAttendanceDialog({
  sessionId,
  students,
  attendance,
  triggerLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  const [records, setRecords] = useState<RecordState[]>(() =>
    students.map((student) => {
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
  )

  async function handleSubmit() {
    if (records.some((r) => r.status === null)) {
      toast.error('Please mark attendance for all students')
      return
    }
    const result = await markAttendance({
      sessionId,
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
      setOpen(false)
      toast.success('Attendance marked successfully')
    } else {
      toast.error(result.error || 'Failed to mark attendance')
    }
  }

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full md:w-auto" variant="outline">
          {triggerLabel ?? 'Mark Attendance'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[95vh] max-w-[95vw] overflow-hidden md:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Mark Attendance</DialogTitle>
          <DialogDescription>
            Record attendance and lesson progress for each student.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 py-2">
          {statusOptions.map((option) => (
            <Button
              key={option.value}
              className="px-2 py-1 text-xs"
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction(option.value)}
            >
              All {option.label}
            </Button>
          ))}
        </div>

        <div className="max-h-[500px] overflow-y-auto">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Lesson Done</TableHead>
                  <TableHead>Surah</TableHead>
                  <TableHead>Ayat Range</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
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
                      updateRecord={updateRecord}
                    />
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-4 md:hidden">
            {students.map((student) => {
              const record = records.find(
                (r) => r.programProfileId === student.programProfileId
              )
              if (!record) return null

              return (
                <div
                  key={student.programProfileId}
                  className="space-y-3 rounded-lg border p-4"
                >
                  <div className="text-base font-medium">{student.name}</div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Status
                    </label>
                    <Select
                      value={record.status ?? ''}
                      onValueChange={(value) =>
                        updateRecord(student.programProfileId, {
                          status: value as DugsiAttendanceStatus,
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
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
                      placeholder="Surah"
                      value={record.surahName}
                      onChange={(e) =>
                        updateRecord(student.programProfileId, {
                          surahName: e.target.value,
                        })
                      }
                    />
                    <Input
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
                    placeholder="Notes..."
                    value={record.notes}
                    onChange={(e) =>
                      updateRecord(student.programProfileId, {
                        notes: e.target.value,
                      })
                    }
                  />
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
          <Button
            className="w-full sm:w-auto"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            className="w-full sm:w-auto"
            disabled={records.some((r) => r.status === null)}
            onClick={handleSubmit}
          >
            Save Attendance
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
