'use client'

import { useState } from 'react'

import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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

import { AttendanceStatus } from '../_types'
import { markAttendance } from '../actions'

interface Student {
  id: string
  name: string
}

interface AttendanceRecord {
  id: string
  status: AttendanceStatus
  Student: { id: string; name: string }
}

interface Props {
  sessionId: string
  students: Student[]
  attendance: AttendanceRecord[]
}

const statusOptions = [
  { value: AttendanceStatus.PRESENT, label: 'Present' },
  { value: AttendanceStatus.ABSENT, label: 'Absent' },
  { value: AttendanceStatus.UNEXCUSED, label: 'Unexcused' },
  { value: AttendanceStatus.LATE, label: 'Late' },
  { value: AttendanceStatus.EXCUSED, label: 'Excused' },
]

export function MarkAttendanceDialog({
  sessionId,
  students,
  attendance,
}: Props) {
  const [open, setOpen] = useState(false)
  const [records, setRecords] = useState(() =>
    students.map((student) => {
      const record = attendance.find((a) => a.Student.id === student.id)
      return {
        studentId: student.id,
        status: record?.status || AttendanceStatus.ABSENT,
        notes: '',
      }
    })
  )

  async function handleSubmit() {
    try {
      await markAttendance({ sessionId, records })
      setOpen(false)
      toast.success('Attendance marked successfully')
    } catch {
      toast.error('Failed to mark attendance')
    }
  }

  function handleStatusChange(studentId: string, status: AttendanceStatus) {
    setRecords((prev) =>
      prev.map((record) =>
        record.studentId === studentId ? { ...record, status } : record
      )
    )
  }

  function handleNotesChange(studentId: string, notes: string) {
    setRecords((prev) =>
      prev.map((record) =>
        record.studentId === studentId ? { ...record, notes } : record
      )
    )
  }

  function handleBulkAction(status: AttendanceStatus) {
    setRecords((prev) => prev.map((record) => ({ ...record, status })))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full md:w-auto" variant="outline">
          Mark Attendance
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[95vh] max-w-[95vw] overflow-hidden md:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Mark Attendance</DialogTitle>
          <DialogDescription>
            Record attendance for each student in the session.
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
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => {
                  const record = records.find((r) => r.studentId === student.id)
                  if (!record) return null

                  return (
                    <TableRow key={student.id}>
                      <TableCell>{student.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {statusOptions.map((option) => (
                            <Button
                              key={option.value}
                              className="px-2 py-1 text-xs"
                              size="sm"
                              variant={
                                record.status === option.value
                                  ? 'default'
                                  : 'outline'
                              }
                              onClick={() =>
                                handleStatusChange(student.id, option.value)
                              }
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Optional notes..."
                          value={record.notes || ''}
                          onChange={(e) =>
                            handleNotesChange(student.id, e.target.value)
                          }
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card Layout */}
          <div className="space-y-4 md:hidden">
            {students.map((student) => {
              const record = records.find((r) => r.studentId === student.id)
              if (!record) return null

              return (
                <div
                  key={student.id}
                  className="space-y-3 rounded-lg border p-4"
                >
                  <div className="text-base font-medium">{student.name}</div>

                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium text-muted-foreground"
                      htmlFor={`status-${student.id}`}
                    >
                      Status
                    </label>
                    <Select
                      value={record.status}
                      onValueChange={(value) =>
                        handleStatusChange(
                          student.id,
                          value as AttendanceStatus
                        )
                      }
                    >
                      <SelectTrigger
                        className="w-full"
                        id={`status-${student.id}`}
                      >
                        <SelectValue />
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

                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium text-muted-foreground"
                      htmlFor={`notes-${student.id}`}
                    >
                      Notes (optional)
                    </label>
                    <Input
                      id={`notes-${student.id}`}
                      placeholder="Add notes..."
                      value={record.notes || ''}
                      onChange={(e) =>
                        handleNotesChange(student.id, e.target.value)
                      }
                    />
                  </div>
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
          <Button className="w-full sm:w-auto" onClick={handleSubmit}>
            Save Attendance
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
