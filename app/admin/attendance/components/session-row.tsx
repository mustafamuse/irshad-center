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
import { TableCell, TableRow } from '@/components/ui/table'

import { MarkAttendanceDialog } from './mark-attendance-dialog'
import { QRCodeDisplay } from './qr-code-display'
import { toggleSelfCheckIn } from '../actions'

interface SessionRowProps {
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
  }
}

export function SessionRow({ session }: SessionRowProps) {
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
    <TableRow>
      <TableCell>{format(session.date, 'MMM d, yyyy')}</TableCell>
      <TableCell>{session.batch.name}</TableCell>
      <TableCell>
        {session.attendanceMarked}/{session.studentsCount}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <QrCode className="h-4 w-4" />
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
          <MarkAttendanceDialog
            attendance={session.records}
            sessionId={session.id}
            students={session.batch.students}
          />
        </div>
      </TableCell>
    </TableRow>
  )
}
