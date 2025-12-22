'use client'

import { useState } from 'react'

import { Shift } from '@prisma/client'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { DugsiClassDTO } from '@/lib/types/dugsi-attendance'

import { ClassList } from './class-list'
import { ClassStats } from './class-stats'
import { CreateClassDialog } from './create-class-dialog'
import { ShiftFilter } from './shift-filter'

interface ClassesDashboardProps {
  classes: DugsiClassDTO[]
  currentShift?: Shift
}

export function ClassesDashboard({
  classes,
  currentShift,
}: ClassesDashboardProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const filteredClasses = currentShift
    ? classes.filter((c) => c.shift === currentShift)
    : classes

  const activeClasses = filteredClasses.filter((c) => c.isActive)
  const inactiveClasses = filteredClasses.filter((c) => !c.isActive)

  const totalStudents = filteredClasses.reduce(
    (sum, c) => sum + c.studentCount,
    0
  )
  const morningClasses = classes.filter((c) => c.shift === 'MORNING').length
  const afternoonClasses = classes.filter((c) => c.shift === 'AFTERNOON').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Classes
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Manage Dugsi classes and student assignments
          </p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Class
        </Button>
      </div>

      <ClassStats
        totalClasses={filteredClasses.length}
        activeClasses={activeClasses.length}
        totalStudents={totalStudents}
        morningClasses={morningClasses}
        afternoonClasses={afternoonClasses}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ShiftFilter currentShift={currentShift} />
        <p className="text-sm text-muted-foreground">
          {activeClasses.length} active, {inactiveClasses.length} inactive
        </p>
      </div>

      <ClassList classes={filteredClasses} />

      <CreateClassDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  )
}
