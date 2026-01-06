'use client'

import { useState, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { TeacherWithDetails } from '../actions'
import { CheckinHistoryTab } from './checkin-history-tab'
import { ManageProgramsDialog } from './manage-programs-dialog'
import { ManageShiftsTab } from './manage-shifts-tab'
import { TeacherDetailsTab } from './teacher-details-tab'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  teacher: TeacherWithDetails
  onSuccess?: () => void
}

export function ManageTeacherDialog({
  open,
  onOpenChange,
  teacher: initialTeacher,
  onSuccess,
}: Props) {
  const [teacher, setTeacher] = useState(initialTeacher)
  const [showProgramsDialog, setShowProgramsDialog] = useState(false)
  const [activeTab, setActiveTab] = useState('details')

  useEffect(() => {
    setTeacher(initialTeacher)
  }, [initialTeacher])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{teacher.name}</DialogTitle>
            <DialogDescription>
              Manage teacher profile and assignments
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="shifts">
                Shifts ({teacher.shifts.length})
              </TabsTrigger>
              <TabsTrigger value="programs">
                Programs ({teacher.programs.length})
              </TabsTrigger>
              <TabsTrigger value="checkins">Check-ins</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <TeacherDetailsTab
                teacher={teacher}
                onUpdate={(updated) => {
                  setTeacher(updated)
                  onSuccess?.()
                }}
                onDeactivate={() => {
                  onSuccess?.()
                  onOpenChange(false)
                }}
              />
            </TabsContent>

            <TabsContent value="shifts" className="space-y-4">
              <ManageShiftsTab
                teacherId={teacher.id}
                currentShifts={teacher.shifts}
                onUpdate={(shifts) => {
                  setTeacher({ ...teacher, shifts })
                  onSuccess?.()
                }}
              />
            </TabsContent>

            <TabsContent value="programs" className="space-y-4">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This teacher is currently assigned to{' '}
                  {teacher.programs.length} program(s).
                </p>

                <Button
                  onClick={() => setShowProgramsDialog(true)}
                  className="w-full"
                >
                  Manage Program Assignments
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="checkins" className="space-y-4">
              <CheckinHistoryTab teacherId={teacher.id} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ManageProgramsDialog
        open={showProgramsDialog}
        onOpenChange={setShowProgramsDialog}
        teacher={teacher}
        onSuccess={() => {
          onSuccess?.()
          onOpenChange(false)
        }}
      />
    </>
  )
}
