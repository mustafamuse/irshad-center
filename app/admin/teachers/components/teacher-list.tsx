'use client'

import { useState } from 'react'

import { Program } from '@prisma/client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { TeacherWithDetails } from '../actions'
import { ManageTeacherDialog } from './manage-teacher-dialog'

interface Props {
  teachers: TeacherWithDetails[]
  onTeacherUpdated?: () => void
}

const PROGRAM_LABELS: Record<Program, string> = {
  MAHAD_PROGRAM: 'Mahad',
  DUGSI_PROGRAM: 'Dugsi',
  YOUTH_EVENTS: 'Youth',
  GENERAL_DONATION: 'Donation',
}

const PROGRAM_COLORS: Record<
  Program,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  MAHAD_PROGRAM: 'default',
  DUGSI_PROGRAM: 'secondary',
  YOUTH_EVENTS: 'outline',
  GENERAL_DONATION: 'outline',
}

export function TeacherList({ teachers, onTeacherUpdated }: Props) {
  const [selectedTeacher, setSelectedTeacher] =
    useState<TeacherWithDetails | null>(null)

  if (teachers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">
          No teachers found. Create a teacher to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Programs</TableHead>
            <TableHead>Students</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teachers.map((teacher) => (
            <TableRow key={teacher.id}>
              <TableCell className="font-medium">{teacher.name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {teacher.email || '—'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {teacher.phone || '—'}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {teacher.programs.length > 0 ? (
                    teacher.programs.map((program) => (
                      <Badge
                        key={program}
                        variant={PROGRAM_COLORS[program]}
                        className="text-xs"
                      >
                        {PROGRAM_LABELS[program]}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      No programs
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm">{teacher.studentCount}</span>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedTeacher(teacher)}
                >
                  Manage
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedTeacher && (
        <ManageTeacherDialog
          open={!!selectedTeacher}
          onOpenChange={(open) => !open && setSelectedTeacher(null)}
          teacher={selectedTeacher}
          onSuccess={() => {
            setSelectedTeacher(null)
            onTeacherUpdated?.()
          }}
        />
      )}
    </div>
  )
}
