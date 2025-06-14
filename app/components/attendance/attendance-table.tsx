'use client'

import * as React from 'react'

import { format } from 'date-fns'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'


interface Student {
  id: string
  name: string
  email: string
}

interface AttendanceRecord {
  studentId: string
  isPresent: boolean
  note?: string
}

interface AttendanceTableProps {
  students: Student[]
  sessionDate: Date
  initialAttendance?: AttendanceRecord[]
  onSave: (attendance: AttendanceRecord[]) => Promise<void>
}

export function AttendanceTable({
  students,
  sessionDate,
  initialAttendance = [],
  onSave,
}: AttendanceTableProps) {
  const [attendance, setAttendance] = React.useState<AttendanceRecord[]>(() =>
    students.map((student) => ({
      studentId: student.id,
      isPresent:
        initialAttendance.find((a) => a.studentId === student.id)?.isPresent ??
        false,
      note: initialAttendance.find((a) => a.studentId === student.id)?.note,
    }))
  )

  const [isSaving, setIsSaving] = React.useState(false)

  const handleToggleAttendance = (studentId: string) => {
    setAttendance((current) =>
      current.map((record) =>
        record.studentId === studentId
          ? { ...record, isPresent: !record.isPresent }
          : record
      )
    )
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      await onSave(attendance)
      toast.success('Attendance saved successfully')
    } catch (error) {
      console.error('Failed to save attendance:', error)
      toast.error('Failed to save attendance')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          Attendance for {format(sessionDate, 'MMMM d, yyyy')}
        </h3>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Attendance'}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="w-[100px]">Present</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student) => (
            <TableRow key={student.id}>
              <TableCell>{student.name}</TableCell>
              <TableCell>{student.email}</TableCell>
              <TableCell>
                <Checkbox
                  checked={
                    attendance.find((a) => a.studentId === student.id)
                      ?.isPresent ?? false
                  }
                  onCheckedChange={() => handleToggleAttendance(student.id)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
