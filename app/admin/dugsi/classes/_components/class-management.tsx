'use client'

import { useMemo, useState } from 'react'

import { useRouter, useSearchParams } from 'next/navigation'

import {
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  MoreVertical,
  Pencil,
  Plus,
  Sun,
  Sunset,
  Trash2,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { ClassFormDialog } from './class-form-dialog'
import { DeleteClassDialog } from './delete-class-dialog'
import { StudentEnrollmentDialog } from './student-enrollment-dialog'
import { UnassignedStudentsSection } from './unassigned-students-section'
import type { ClassWithDetails, UnassignedStudent } from '../../_types'
import {
  assignTeacherToClassAction,
  removeTeacherFromClassAction,
} from '../../actions'

interface Teacher {
  id: string
  name: string
}

const DEFAULT_TAB = 'morning'

interface ClassManagementProps {
  classes: ClassWithDetails[]
  teachers: Teacher[]
  unassignedStudents: UnassignedStudent[]
}

export function ClassManagement({
  classes,
  teachers,
  unassignedStudents,
}: ClassManagementProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab =
    searchParams.get('tab') === 'afternoon' ? 'afternoon' : DEFAULT_TAB

  const [selectedClass, setSelectedClass] = useState<ClassWithDetails | null>(
    null
  )
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('')

  const [classFormOpen, setClassFormOpen] = useState(false)
  const [classFormMode, setClassFormMode] = useState<'create' | 'edit'>(
    'create'
  )
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [enrollmentDialogOpen, setEnrollmentDialogOpen] = useState(false)

  const morningClasses = useMemo(
    () => classes.filter((c) => c.shift === 'MORNING'),
    [classes]
  )
  const afternoonClasses = useMemo(
    () => classes.filter((c) => c.shift === 'AFTERNOON'),
    [classes]
  )

  const handleOpenDetail = (classItem: ClassWithDetails) => {
    setSelectedClass(classItem)
    setIsDetailDialogOpen(true)
    setSelectedTeacherId('')
  }

  const handleCreateClass = () => {
    setSelectedClass(null)
    setClassFormMode('create')
    setClassFormOpen(true)
  }

  const handleEditClass = (
    classItem: ClassWithDetails,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation()
    setSelectedClass(classItem)
    setClassFormMode('edit')
    setClassFormOpen(true)
  }

  const handleDeleteClass = (
    classItem: ClassWithDetails,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation()
    setSelectedClass(classItem)
    setDeleteDialogOpen(true)
  }

  const handleManageStudents = (
    classItem: ClassWithDetails,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation()
    setSelectedClass(classItem)
    setEnrollmentDialogOpen(true)
  }

  const handleAssignTeacher = async () => {
    if (!selectedClass || !selectedTeacherId) return

    setIsLoading(true)
    try {
      const result = await assignTeacherToClassAction({
        classId: selectedClass.id,
        teacherId: selectedTeacherId,
      })

      if (result.success) {
        toast.success(result.message || 'Teacher assigned')
        setSelectedTeacherId('')
        setIsDetailDialogOpen(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveTeacher = async (teacherId: string) => {
    if (!selectedClass) return

    setIsLoading(true)
    try {
      const result = await removeTeacherFromClassAction({
        classId: selectedClass.id,
        teacherId,
      })

      if (result.success) {
        toast.success(result.message || 'Teacher removed')
        setIsDetailDialogOpen(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const assignedTeacherIds = useMemo(
    () => new Set(selectedClass?.teachers.map((t) => t.teacherId) ?? []),
    [selectedClass]
  )
  const availableTeachers = useMemo(
    () => teachers.filter((t) => !assignedTeacherIds.has(t.id)),
    [teachers, assignedTeacherIds]
  )

  const renderClassCard = (classItem: ClassWithDetails, index: number) => {
    const needsAttention = classItem.teachers.length === 0
    const isMorning = classItem.shift === 'MORNING'
    const ShiftIcon = isMorning ? Sun : Sunset

    return (
      <Card
        key={classItem.id}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleOpenDetail(classItem)
          }
        }}
        className={`cursor-pointer border-0 shadow-md transition-[box-shadow,transform] duration-200 hover:-translate-y-1 hover:shadow-lg ${
          needsAttention
            ? 'ring-2 ring-[#deb43e]/40 hover:ring-[#deb43e]/60'
            : 'hover:ring-2 hover:ring-[#007078]/20'
        }`}
        style={{ animationDelay: `${index * 50}ms` }}
        onClick={() => handleOpenDetail(classItem)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full ${
                  isMorning ? 'bg-[#deb43e]/15' : 'bg-[#007078]/10'
                }`}
              >
                <ShiftIcon
                  className={`h-4 w-4 ${isMorning ? 'text-[#deb43e]' : 'text-[#007078]'}`}
                />
              </div>
              <CardTitle className="text-base">{classItem.name}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  isMorning
                    ? 'border-[#deb43e]/30 bg-[#deb43e]/10 text-[#996b1d]'
                    : 'border-[#007078]/20 bg-[#007078]/10 text-[#007078]'
                }
              >
                {classItem.shift}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    aria-label="Class options"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => handleEditClass(classItem, e)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Class
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => handleManageStudents(classItem, e)}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Manage Students
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => handleDeleteClass(classItem, e)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Class
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {classItem.description && (
            <CardDescription>{classItem.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {classItem.teachers.length === 0
                  ? 'No teachers'
                  : classItem.teachers.map((t) => t.teacherName).join(', ')}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 shrink-0" />
              <span>{classItem.studentCount} students</span>
            </div>
          </div>
          {needsAttention && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#deb43e]/10 px-3 py-2 text-sm text-[#996b1d]">
              <AlertCircle className="h-4 w-4" />
              <span>Assign a teacher to enable check-in</span>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <GraduationCap className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground">No classes</p>
      <Button
        variant="link"
        className="mt-2 text-[#007078]"
        onClick={handleCreateClass}
      >
        <Plus className="mr-1 h-4 w-4" />
        Create your first class
      </Button>
    </div>
  )

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Class Management</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:mt-2">
            Assign teachers to classes and manage student enrollment
          </p>
        </div>
        <Button
          onClick={handleCreateClass}
          className="bg-brand hover:bg-brand-hover"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Class
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const params = new URLSearchParams(searchParams.toString())
          if (value === DEFAULT_TAB) {
            params.delete('tab')
          } else {
            params.set('tab', value)
          }
          router.replace(`?${params.toString()}`, { scroll: false })
        }}
      >
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="morning" className="flex-1 sm:flex-initial">
            Morning ({morningClasses.length})
          </TabsTrigger>
          <TabsTrigger value="afternoon" className="flex-1 sm:flex-initial">
            Afternoon ({afternoonClasses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="morning" className="mt-4">
          {morningClasses.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {morningClasses.map((c, i) => renderClassCard(c, i))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="afternoon" className="mt-4">
          {afternoonClasses.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {afternoonClasses.map((c, i) => renderClassCard(c, i))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {unassignedStudents.length > 0 ? (
        <UnassignedStudentsSection
          students={unassignedStudents}
          classes={classes}
        />
      ) : (
        classes.length > 0 && (
          <div className="mt-8 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            All students are assigned to a class
          </div>
        )
      )}

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedClass?.name}</DialogTitle>
            <DialogDescription>
              Manage teachers assigned to this class
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-medium">Assigned Teachers</h3>
              {selectedClass?.teachers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No teachers assigned yet
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedClass?.teachers.map((teacher) => (
                    <div
                      key={teacher.id}
                      className="flex items-center justify-between rounded-md border p-2"
                    >
                      <span className="text-sm">{teacher.teacherName}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveTeacher(teacher.teacherId)}
                        disabled={isLoading}
                        aria-label={`Remove ${teacher.teacherName}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">Add Teacher</h3>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={selectedTeacherId}
                  onValueChange={setSelectedTeacherId}
                >
                  <SelectTrigger
                    className="w-full sm:flex-1"
                    aria-label="Select a teacher"
                  >
                    <SelectValue placeholder="Select a teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTeachers.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        All teachers assigned
                      </SelectItem>
                    ) : (
                      availableTeachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAssignTeacher}
                  disabled={!selectedTeacherId || isLoading}
                  className="w-full sm:w-auto"
                  aria-label="Add teacher"
                >
                  <Plus className="mr-2 h-4 w-4 sm:mr-0" />
                  <span className="sm:hidden">Add Teacher</span>
                </Button>
              </div>
            </div>

            <div className="pt-2 text-sm text-muted-foreground">
              <p>Students enrolled: {selectedClass?.studentCount ?? 0}</p>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                if (selectedClass) {
                  setIsDetailDialogOpen(false)
                  handleManageStudents(selectedClass)
                }
              }}
            >
              <Users className="mr-2 h-4 w-4" />
              Manage Students
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                if (selectedClass) {
                  setIsDetailDialogOpen(false)
                  handleEditClass(selectedClass)
                }
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClassFormDialog
        open={classFormOpen}
        onOpenChange={setClassFormOpen}
        mode={classFormMode}
        classData={classFormMode === 'edit' ? selectedClass : null}
      />

      <DeleteClassDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        classData={selectedClass}
        onSuccess={() => router.refresh()}
      />

      <StudentEnrollmentDialog
        open={enrollmentDialogOpen}
        onOpenChange={setEnrollmentDialogOpen}
        classData={selectedClass}
      />
    </>
  )
}
