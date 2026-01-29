'use client'

import Link from 'next/link'

import { format } from 'date-fns'
import { ArrowLeft } from 'lucide-react'

import {
  MarkAttendanceForm,
  type SessionInfo,
  type Student,
} from '@/components/attendance/mark-attendance-form'
import { Badge } from '@/components/ui/badge'
import type { AttendanceRecordForMarking } from '@/lib/mappers/attendance-mapper'

import { markAttendance } from '../actions'

interface Props {
  session: SessionInfo
  students: Student[]
  attendance: AttendanceRecordForMarking[]
}

export function MarkAttendancePage({ session, students, attendance }: Props) {
  return (
    <MarkAttendanceForm
      session={session}
      students={students}
      attendance={attendance}
      backHref="/admin/dugsi/attendance"
      isClosed={session.isClosed}
      saveAction={markAttendance}
      redirectTo="/admin/dugsi/attendance"
      header={
        <div className="flex items-start gap-3">
          <Link
            href="/admin/dugsi/attendance"
            aria-label="Back to attendance"
            className="mt-1 rounded-md p-1 hover:bg-muted"
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
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
      }
    />
  )
}
