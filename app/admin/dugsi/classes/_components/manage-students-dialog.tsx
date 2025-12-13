'use client'

import { useState, useEffect, useTransition } from 'react'

import { Plus, Search, Trash2, Users, UserPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { ShiftBadge } from '@/app/admin/dugsi/components/shared/shift-badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { UnassignedStudentDTO } from '@/lib/db/queries/dugsi-class'
import type {
  DugsiClassDTO,
  ClassStudentDTO,
} from '@/lib/types/dugsi-attendance'

import {
  getStudentsInClassAction,
  getUnassignedStudentsAction,
  bulkAssignStudentsToClassAction,
  removeStudentFromClassAction,
} from '../actions'

interface ManageStudentsDialogProps {
  dugsiClass: DugsiClassDTO
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ManageStudentsDialog({
  dugsiClass,
  open,
  onOpenChange,
}: ManageStudentsDialogProps) {
  const [currentStudents, setCurrentStudents] = useState<ClassStudentDTO[]>([])
  const [unassignedStudents, setUnassignedStudents] = useState<
    UnassignedStudentDTO[]
  >([])
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dugsiClass.id])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [studentsResult, unassignedResult] = await Promise.all([
        getStudentsInClassAction(dugsiClass.id),
        getUnassignedStudentsAction(),
      ])

      if (studentsResult.success && studentsResult.data) {
        setCurrentStudents(studentsResult.data)
      }
      if (unassignedResult.success && unassignedResult.data) {
        setUnassignedStudents(unassignedResult.data)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddStudents = () => {
    if (selectedToAdd.size === 0) return

    startTransition(async () => {
      const result = await bulkAssignStudentsToClassAction(
        dugsiClass.id,
        Array.from(selectedToAdd)
      )

      if (result.success && result.data) {
        toast.success(
          `${result.data.assignedCount} student(s) assigned to ${dugsiClass.name}`
        )
        setSelectedToAdd(new Set())
        loadData()
      } else if (!result.success) {
        toast.error(result.error)
      }
    })
  }

  const handleRemoveStudent = (enrollmentId: string, studentName: string) => {
    startTransition(async () => {
      const result = await removeStudentFromClassAction(enrollmentId)

      if (result.success) {
        toast.success(`${studentName} has been removed from ${dugsiClass.name}`)
        loadData()
      } else {
        toast.error(result.error)
      }
    })
  }

  const toggleStudentSelection = (programProfileId: string) => {
    const newSelection = new Set(selectedToAdd)
    if (newSelection.has(programProfileId)) {
      newSelection.delete(programProfileId)
    } else {
      newSelection.add(programProfileId)
    }
    setSelectedToAdd(newSelection)
  }

  const filteredUnassigned = unassignedStudents.filter((s) =>
    s.studentName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {dugsiClass.name}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <ShiftBadge shift={dugsiClass.shift} />
            <span>{currentStudents.length} students enrolled</span>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="current" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="current">
              Current ({currentStudents.length})
            </TabsTrigger>
            <TabsTrigger value="add">
              Add Students ({filteredUnassigned.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="mt-4">
            {isLoading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : currentStudents.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center">
                <Users className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No students in this class
                </p>
                <p className="text-xs text-muted-foreground">
                  Switch to &quot;Add Students&quot; to assign students
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead className="w-[80px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentStudents.map((student) => (
                      <TableRow key={student.enrollmentId}>
                        <TableCell>
                          <p className="font-medium">{student.studentName}</p>
                          <p className="text-xs text-muted-foreground">
                            Since{' '}
                            {new Date(student.startDate).toLocaleDateString()}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() =>
                              handleRemoveStudent(
                                student.enrollmentId,
                                student.studentName
                              )
                            }
                            disabled={isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Remove</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="add" className="mt-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            {isLoading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredUnassigned.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center">
                <UserPlus className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? 'No matching students found'
                    : 'All students are assigned to classes'}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[250px]">
                <div className="space-y-2">
                  {filteredUnassigned.map((student) => (
                    <div
                      key={student.programProfileId}
                      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedToAdd.has(student.programProfileId)}
                          onCheckedChange={() =>
                            toggleStudentSelection(student.programProfileId)
                          }
                        />
                        <div>
                          <p className="font-medium">{student.studentName}</p>
                          {student.shift && (
                            <ShiftBadge
                              shift={student.shift}
                              className="mt-1"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {selectedToAdd.size > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                <span className="text-sm">
                  {selectedToAdd.size} student(s) selected
                </span>
                <Button
                  size="sm"
                  onClick={handleAddStudents}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Add to Class
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
