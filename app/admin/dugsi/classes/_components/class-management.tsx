'use client'

import { useState } from 'react'

import { Shift } from '@prisma/client'
import { Users, GraduationCap, Plus, Trash2 } from 'lucide-react'
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import {
  assignTeacherToClassAction,
  removeTeacherFromClassAction,
  type ClassWithDetails,
} from '../../actions'

interface Teacher {
  id: string
  name: string
}

interface ClassManagementProps {
  classes: ClassWithDetails[]
  teachers: Teacher[]
}

export function ClassManagement({ classes, teachers }: ClassManagementProps) {
  const [selectedClass, setSelectedClass] = useState<ClassWithDetails | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('')

  const morningClasses = classes.filter((c) => c.shift === 'MORNING')
  const afternoonClasses = classes.filter((c) => c.shift === 'AFTERNOON')

  const handleOpenClass = (classItem: ClassWithDetails) => {
    setSelectedClass(classItem)
    setIsDialogOpen(true)
    setSelectedTeacherId('')
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
        setIsDialogOpen(false)
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
        setIsDialogOpen(false)
      } else {
        toast.error(result.error)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const assignedTeacherIds = selectedClass?.teachers.map((t) => t.teacherId) ?? []
  const availableTeachers = teachers.filter(
    (t) => !assignedTeacherIds.includes(t.id)
  )

  const renderClassCard = (classItem: ClassWithDetails) => (
    <Card
      key={classItem.id}
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => handleOpenClass(classItem)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{classItem.name}</CardTitle>
          <Badge variant={classItem.shift === 'MORNING' ? 'default' : 'secondary'}>
            {classItem.shift}
          </Badge>
        </div>
        {classItem.description && (
          <CardDescription>{classItem.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <GraduationCap className="h-4 w-4" />
            <span>
              {classItem.teachers.length === 0
                ? 'No teachers'
                : classItem.teachers.map((t) => t.teacherName).join(', ')}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{classItem.studentCount} students</span>
          </div>
        </div>
        {classItem.teachers.length === 0 && (
          <p className="mt-2 text-sm text-amber-600">
            Assign a teacher to enable check-in
          </p>
        )}
      </CardContent>
    </Card>
  )

  return (
    <>
      <Tabs defaultValue="morning">
        <TabsList>
          <TabsTrigger value="morning">
            Morning ({morningClasses.length})
          </TabsTrigger>
          <TabsTrigger value="afternoon">
            Afternoon ({afternoonClasses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="morning" className="mt-4">
          {morningClasses.length === 0 ? (
            <p className="text-muted-foreground">No morning classes</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {morningClasses.map(renderClassCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="afternoon" className="mt-4">
          {afternoonClasses.length === 0 ? (
            <p className="text-muted-foreground">No afternoon classes</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {afternoonClasses.map(renderClassCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedClass?.name}</DialogTitle>
            <DialogDescription>
              Manage teachers assigned to this class
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <h4 className="mb-2 text-sm font-medium">Assigned Teachers</h4>
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
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium">Add Teacher</h4>
              <div className="flex gap-2">
                <Select
                  value={selectedTeacherId}
                  onValueChange={setSelectedTeacherId}
                >
                  <SelectTrigger className="flex-1">
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
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="pt-2 text-sm text-muted-foreground">
              <p>Students enrolled: {selectedClass?.studentCount ?? 0}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
