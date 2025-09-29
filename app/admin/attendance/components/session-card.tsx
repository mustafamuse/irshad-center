'use client'

import { useState } from 'react'

import { format } from 'date-fns'
import { QrCode } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

import { MarkAttendanceDialog } from './mark-attendance-dialog'
import { QRCodeDisplay } from './qr-code-display'
import { toggleSelfCheckIn } from '../actions'

interface SessionCardProps {
  session: {
    id: string
    date: Date
    allowSelfCheckIn: boolean
    batch: {
      name: string
      students: Array<{ id: string; name: string }>
    }
    records: Array<{
      id: string
      status: string
      notes?: string | null
      checkInMethod: string
      checkedInAt?: Date | null
      createdAt: Date
      updatedAt: Date
      student: { id: string; name: string }
    }>
    studentsCount: number
    attendanceMarked: number
    isComplete: boolean
  }
}

export function SessionCard({ session }: SessionCardProps) {
  const [qrEnabled, setQrEnabled] = useState(session.allowSelfCheckIn)
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false)

  const handleQrToggle = async (enabled: boolean) => {
    try {
      await toggleSelfCheckIn({
        sessionId: session.id,
        enabled,
      })
      setQrEnabled(enabled)
    } catch (error) {
      console.error('Failed to toggle QR check-in:', error)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-medium">
          {format(session.date, 'MMM d, yyyy')}
        </div>
        <div
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            session.isComplete
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {session.isComplete ? 'Complete' : 'Incomplete'}
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Batch:</span>
          <span className="font-medium">{session.batch.name}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Attendance:</span>
          <span className="font-medium">
            {session.attendanceMarked}/{session.studentsCount} students
          </span>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1">
              <QrCode className="mr-2 h-4 w-4" />
              QR Check-In
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>QR Code Check-In</DialogTitle>
            </DialogHeader>
            <QRCodeDisplay
              sessionId={session.id}
              isEnabled={qrEnabled}
              onToggle={handleQrToggle}
              studentsCount={session.studentsCount}
              checkedInCount={session.attendanceMarked}
            />
          </DialogContent>
        </Dialog>
        <div className="flex-1">
          <MarkAttendanceDialog
            attendance={session.records}
            sessionId={session.id}
            students={session.batch.students}
          />
        </div>
      </div>
    </div>
  )
}
