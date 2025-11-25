'use client'

import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BatchStudentData } from '@/lib/types/batch'

import { useLegacyActions, useSelectedStudents } from '../../_store/ui-store'
import { StudentCard } from '../shared/ui/student-card'

interface StudentSelectorProps {
  mode: 'assign' | 'transfer'
  selectedBatch: string
  destinationBatchId?: string | null
  students: BatchStudentData[]
}

export function StudentSelector({
  mode,
  selectedBatch,
  destinationBatchId,
  students,
}: StudentSelectorProps) {
  const [sourceSearch, setSourceSearch] = useState('')
  const [destinationSearch, setDestinationSearch] = useState('')

  const selectedStudentIds = useSelectedStudents()
  const { selectStudent, deselectStudent } = useLegacyActions()
  const isStudentSelected = (id: string) => selectedStudentIds.has(id)

  // Filter students based on mode and batch selection
  const sourceStudents =
    mode === 'assign'
      ? students.filter((s) => !s.batch) // Unassigned students for assign mode
      : students.filter((s) => s.batch?.id === selectedBatch) // Students from source batch for transfer mode

  const destinationStudents =
    mode === 'assign'
      ? students.filter((s) => s.batch?.id === selectedBatch) // Show selected batch students in assign mode
      : destinationBatchId
        ? students.filter((s) => s.batch?.id === destinationBatchId) // Show destination batch students in transfer mode
        : []

  // Apply search filters
  const filteredSourceStudents = sourceStudents.filter((s) =>
    sourceSearch
      ? s.name.toLowerCase().includes(sourceSearch.toLowerCase()) ||
        s.email?.toLowerCase().includes(sourceSearch.toLowerCase())
      : true
  )

  const filteredDestinationStudents = destinationStudents.filter((s) =>
    destinationSearch
      ? s.name.toLowerCase().includes(destinationSearch.toLowerCase()) ||
        s.email?.toLowerCase().includes(destinationSearch.toLowerCase())
      : true
  )

  const toggleStudent = (studentId: string) => {
    if (isStudentSelected(studentId)) {
      deselectStudent(studentId)
    } else {
      selectStudent(studentId)
    }
  }

  const getSourceTitle = () => {
    if (mode === 'assign') {
      return 'Available Students'
    }
    return `Students in Source Cohort`
  }

  const getDestinationTitle = () => {
    if (mode === 'assign') {
      return `Students in Target Cohort`
    }
    return `Students in Destination Cohort`
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Source Students */}
      <div className="flex h-[400px] flex-col">
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">{getSourceTitle()}</h3>
            <span className="text-xs text-muted-foreground">
              {selectedStudentIds.size} selected
            </span>
          </div>
          <Input
            placeholder="Search students..."
            value={sourceSearch}
            onChange={(e) => setSourceSearch(e.target.value)}
            className="h-8"
          />
        </div>

        <ScrollArea className="flex-1 rounded-md border">
          <div className="space-y-2 p-4">
            {filteredSourceStudents.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-center text-sm text-muted-foreground">
                {sourceSearch
                  ? 'No students match your search'
                  : 'No students available'}
              </div>
            ) : (
              filteredSourceStudents.map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  isSelected={isStudentSelected(student.id)}
                  onToggle={() => toggleStudent(student.id)}
                  selectable
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Destination Students */}
      <div className="flex h-[400px] flex-col">
        <div className="mb-4 space-y-2">
          <h3 className="text-sm font-medium">{getDestinationTitle()}</h3>
          <Input
            placeholder="Search students..."
            value={destinationSearch}
            onChange={(e) => setDestinationSearch(e.target.value)}
            className="h-8"
          />
        </div>

        <ScrollArea className="flex-1 rounded-md border">
          <div className="space-y-2 p-4">
            {filteredDestinationStudents.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-center text-sm text-muted-foreground">
                {destinationSearch
                  ? 'No students match your search'
                  : mode === 'transfer' && !destinationBatchId
                    ? 'Select a destination cohort first'
                    : 'No students in this cohort'}
              </div>
            ) : (
              filteredDestinationStudents.map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  isSelected={false}
                  onToggle={() => {}}
                  selectable={false}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
