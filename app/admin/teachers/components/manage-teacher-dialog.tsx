'use client'

import { useState } from 'react'

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
import { ManageProgramsDialog } from './manage-programs-dialog'
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
  teacher,
  onSuccess,
}: Props) {
  const [showProgramsDialog, setShowProgramsDialog] = useState(false)
  const [activeTab, setActiveTab] = useState('details')

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
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="programs">
                Programs ({teacher.programs.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <TeacherDetailsTab teacher={teacher} />
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
