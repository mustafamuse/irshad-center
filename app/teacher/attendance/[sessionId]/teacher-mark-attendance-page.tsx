'use client'

import Link from 'next/link'

import { format } from 'date-fns'
import { ArrowLeft } from 'lucide-react'

import {
  MarkAttendanceForm,
  type SessionInfo,
  type Student,
} from '@/components/attendance/mark-attendance-form'
import type { AttendanceRecordForMarking } from '@/lib/mappers/attendance-mapper'

import { teacherMarkAttendance } from '../actions'

interface Props {
  session: SessionInfo
  students: Student[]
  attendance: AttendanceRecordForMarking[]
  isEffectivelyClosed: boolean
}

export function TeacherMarkAttendancePage({
  session,
  students,
  attendance,
  isEffectivelyClosed,
}: Props) {
  return (
    <MarkAttendanceForm
      session={session}
      students={students}
      attendance={attendance}
      backHref="/teacher/attendance"
      isClosed={isEffectivelyClosed}
      saveAction={teacherMarkAttendance}
      redirectTo="/teacher/attendance"
      hasExistingRecords={attendance.length > 0}
      renderStudentName={(student) => (
        <Link
          href={`/teacher/attendance/student/${student.programProfileId}`}
          className="truncate font-medium hover:underline"
        >
          {student.name}
        </Link>
      )}
      header={
        <div className="flex items-start gap-3">
          <Link
            href="/teacher/attendance"
            aria-label="Back to attendance"
            className="mt-1 rounded-md p-1 hover:bg-muted"
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">
              {session.shift === 'MORNING' ? 'AM' : 'PM'} Session
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {format(new Date(session.date), 'EEE, MM/dd')} · {students.length}{' '}
              students
            </p>
          </div>
        </div>
      }
    />
  )
}
