'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AttendanceSession, AttendanceStatus } from '@/lib/types/attendance'
import { CheckCircle2, XCircle, Clock, AlertTriangle, UserCheck } from 'lucide-react'
import { toast } from 'sonner'

interface AttendanceDialogProps {
  session: AttendanceSession
  open: boolean
  onOpenChange: (open: boolean) => void
  onAttendanceMarked: () => void
}

export function AttendanceDialog({
  session,
  open,
  onOpenChange,
  onAttendanceMarked,
}: AttendanceDialogProps) {
  const [attendanceData, setAttendanceData] = useState<
    Record<string, { status: AttendanceStatus; notes: string }>
  >({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (session) {
      // Initialize attendance data with existing records
      const initialData: Record<string, { status: AttendanceStatus; notes: string }> = {}
      
      session.schedule.batch.students.forEach((student) => {
        const existingRecord = session.attendance.find((a) => a.studentId === student.id)
        initialData[student.id] = {
          status: existingRecord?.status || AttendanceStatus.ABSENT,
          notes: existingRecord?.notes || '',
        }
      })
      
      setAttendanceData(initialData)
    }
  }, [session])

  function getStatusIcon(status: AttendanceStatus) {
    switch (status) {
      case AttendanceStatus.PRESENT:
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case AttendanceStatus.ABSENT:
        return <XCircle className="h-4 w-4 text-red-600" />
      case AttendanceStatus.UNEXCUSED_ABSENT:
        return <AlertTriangle className="h-4 w-4 text-orange-600" />
      case AttendanceStatus.LATE:
        return <Clock className="h-4 w-4 text-yellow-600" />
      case AttendanceStatus.EXCUSED:
        return <UserCheck className="h-4 w-4 text-blue-600" />
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />
    }
  }

  function getStatusColor(status: AttendanceStatus) {
    switch (status) {
      case AttendanceStatus.PRESENT:
        return 'bg-green-100 text-green-800 hover:bg-green-200'
      case AttendanceStatus.ABSENT:
        return 'bg-red-100 text-red-800 hover:bg-red-200'
      case AttendanceStatus.UNEXCUSED_ABSENT:
        return 'bg-orange-100 text-orange-800 hover:bg-orange-200'
      case AttendanceStatus.LATE:
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
      case AttendanceStatus.EXCUSED:
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200'
    }
  }

  function updateStudentAttendance(studentId: string, status: AttendanceStatus) {
    setAttendanceData((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
      },
    }))
  }

  function updateStudentNotes(studentId: string, notes: string) {
    setAttendanceData((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        notes,
      },
    }))
  }

  async function saveAttendance() {
    setSaving(true)
    try {
      const attendanceRecords = Object.entries(attendanceData).map(([studentId, data]) => ({
        studentId,
        status: data.status,
        notes: data.notes || undefined,
      }))

      const response = await fetch('/api/admin/attendance/mark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.id,
          attendanceRecords,
        }),
      })

      if (response.ok) {
        toast.success('Attendance saved successfully')
        onAttendanceMarked()
        onOpenChange(false)
      } else {
        throw new Error('Failed to save attendance')
      }
    } catch (error) {
      console.error('Error saving attendance:', error)
      toast.error('Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  function markAllAs(status: AttendanceStatus) {
    const updatedData = { ...attendanceData }
    session.schedule.batch.students.forEach((student) => {
      updatedData[student.id] = {
        ...updatedData[student.id],
        status,
      }
    })
    setAttendanceData(updatedData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Mark Attendance - {session.schedule.subject.name}
          </DialogTitle>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Batch: {session.schedule.batch.name}</div>
            <div>Date: {format(new Date(session.date), 'PPP')}</div>
            <div>
              Time: {format(new Date(session.startTime), 'p')} - {format(new Date(session.endTime), 'p')}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAs(AttendanceStatus.PRESENT)}
            >
              Mark All Present
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAs(AttendanceStatus.ABSENT)}
            >
              Mark All Absent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAs(AttendanceStatus.UNEXCUSED_ABSENT)}
            >
              Mark All Unexcused
            </Button>
          </div>

          {/* Students List */}
          <div className="space-y-4">
            {session.schedule.batch.students.map((student) => {
              const studentData = attendanceData[student.id]
              if (!studentData) return null

              return (
                <div key={student.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{student.name}</h4>
                      {student.email && (
                        <p className="text-sm text-muted-foreground">{student.email}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(studentData.status)}
                      <span className="text-sm font-medium">
                        {studentData.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Status Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {Object.values(AttendanceStatus).map((status) => (
                      <Button
                        key={status}
                        variant={studentData.status === status ? 'default' : 'outline'}
                        size="sm"
                        className={
                          studentData.status === status
                            ? getStatusColor(status)
                            : ''
                        }
                        onClick={() => updateStudentAttendance(student.id, status)}
                      >
                        {getStatusIcon(status)}
                        <span className="ml-1">
                          {status.replace('_', ' ')}
                        </span>
                      </Button>
                    ))}
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor={`notes-${student.id}`}>Notes (optional)</Label>
                    <Textarea
                      id={`notes-${student.id}`}
                      placeholder="Add any notes about this student's attendance..."
                      value={studentData.notes}
                      onChange={(e) => updateStudentNotes(student.id, e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={saveAttendance} disabled={saving}>
              {saving ? 'Saving...' : 'Save Attendance'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}