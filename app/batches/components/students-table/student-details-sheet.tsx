'use client'

import { useEffect, useState, useTransition } from 'react'

import { format } from 'date-fns'
import {
  CalendarIcon,
  Edit,
  Eye,
  Save,
  X,
  Mail,
  Phone as PhoneIcon,
  GraduationCap,
  School,
  DollarSign,
  Users,
  BookOpen,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { BatchStudentData, BatchWithCount } from '@/lib/types/batch'
import { getStudentStatusDisplay } from '@/lib/types/student'
import { cn } from '@/lib/utils'

import { updateStudentAction } from '../../actions'

interface StudentDetailsSheetProps {
  student: BatchStudentData
  batches: BatchWithCount[]
  open: boolean
  mode: 'view' | 'edit'
  onOpenChange: (open: boolean) => void
  onModeChange?: (mode: 'view' | 'edit') => void
}

export function StudentDetailsSheet({
  student,
  batches,
  open,
  mode,
  onOpenChange,
  onModeChange,
}: StudentDetailsSheetProps) {
  const [isPending, startTransition] = useTransition()
  const [formData, setFormData] = useState({
    name: student.name,
    email: student.email || '',
    phone: student.phone || '',
    dateOfBirth: student.dateOfBirth,
    educationLevel: student.educationLevel || 'none',
    gradeLevel: student.gradeLevel || 'none',
    schoolName: student.schoolName || '',
    monthlyRate: student.monthlyRate,
    customRate: student.customRate,
    batchId: student.batchId || 'none',
  })

  // Reset form data when student changes or dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        name: student.name,
        email: student.email || '',
        phone: student.phone || '',
        dateOfBirth: student.dateOfBirth,
        educationLevel: student.educationLevel || 'none',
        gradeLevel: student.gradeLevel || 'none',
        schoolName: student.schoolName || '',
        monthlyRate: student.monthlyRate,
        customRate: student.customRate,
        batchId: student.batchId || 'none',
      })
    }
  }, [student, open])

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateStudentAction(student.id, {
        ...formData,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        educationLevel:
          formData.educationLevel === 'none'
            ? undefined
            : formData.educationLevel,
        gradeLevel:
          formData.gradeLevel === 'none' ? undefined : formData.gradeLevel,
        schoolName: formData.schoolName || undefined,
        batchId: formData.batchId === 'none' ? undefined : formData.batchId,
      })

      if (result.success) {
        toast.success('Student updated successfully')
        onModeChange?.('view')
      } else {
        toast.error(result.error || 'Failed to update student')
      }
    })
  }

  const handleCancel = () => {
    // Reset to original values
    setFormData({
      name: student.name,
      email: student.email || '',
      phone: student.phone || '',
      dateOfBirth: student.dateOfBirth,
      educationLevel: student.educationLevel || 'none',
      gradeLevel: student.gradeLevel || 'none',
      schoolName: student.schoolName || '',
      monthlyRate: student.monthlyRate,
      customRate: student.customRate,
      batchId: student.batchId || 'none',
    })
    onModeChange?.('view')
  }

  const isEditing = mode === 'edit'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-2xl"
      >
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Edit className="h-5 w-5" />
                  Edit Student
                </>
              ) : (
                <>
                  <Eye className="h-5 w-5" />
                  Student Details
                </>
              )}
            </SheetTitle>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onModeChange?.('edit')}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
          <SheetDescription>
            {isEditing
              ? 'Update student information'
              : 'View student information and details'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Users className="h-4 w-4" />
              Basic Information
            </h3>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs text-muted-foreground">
                  Name {isEditing && '*'}
                </Label>
                {isEditing ? (
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    disabled={isPending}
                    required
                  />
                ) : (
                  <p className="text-base font-medium">{student.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-xs text-muted-foreground"
                >
                  Email
                </Label>
                {isEditing ? (
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    disabled={isPending}
                  />
                ) : student.email ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <a
                      href={`mailto:${student.email}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {student.email}
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not provided</p>
                )}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="phone"
                  className="text-xs text-muted-foreground"
                >
                  Phone
                </Label>
                {isEditing ? (
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    disabled={isPending}
                  />
                ) : student.phone ? (
                  <div className="flex items-center gap-2 text-sm">
                    <PhoneIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <a
                      href={`tel:${student.phone}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {student.phone}
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not provided</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Date of Birth
                </Label>
                {isEditing ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !formData.dateOfBirth && 'text-muted-foreground'
                        )}
                        disabled={isPending}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.dateOfBirth ? (
                          format(new Date(formData.dateOfBirth), 'PPP')
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={
                          formData.dateOfBirth
                            ? new Date(formData.dateOfBirth)
                            : undefined
                        }
                        onSelect={(date) =>
                          setFormData({
                            ...formData,
                            dateOfBirth: date || null,
                          })
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                ) : student.dateOfBirth ? (
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    {format(new Date(student.dateOfBirth), 'PPP')}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not provided</p>
                )}
              </div>
            </div>
          </div>

          {/* Education Information */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <GraduationCap className="h-4 w-4" />
              Education Information
            </h3>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label
                  htmlFor="educationLevel"
                  className="text-xs text-muted-foreground"
                >
                  Education Level
                </Label>
                {isEditing ? (
                  <Select
                    value={formData.educationLevel}
                    onValueChange={(value) =>
                      setFormData({ ...formData, educationLevel: value })
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger id="educationLevel">
                      <SelectValue placeholder="Select education level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="ELEMENTARY">Elementary</SelectItem>
                      <SelectItem value="MIDDLE_SCHOOL">
                        Middle School
                      </SelectItem>
                      <SelectItem value="HIGH_SCHOOL">High School</SelectItem>
                      <SelectItem value="COLLEGE">College</SelectItem>
                      <SelectItem value="POST_GRAD">Post Graduate</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-sm">
                      {student.educationLevel
                        ? student.educationLevel
                            .split('_')
                            .map(
                              (word) =>
                                word.charAt(0) + word.slice(1).toLowerCase()
                            )
                            .join(' ')
                        : 'Not specified'}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="gradeLevel"
                  className="text-xs text-muted-foreground"
                >
                  Grade Level
                </Label>
                {isEditing ? (
                  <Select
                    value={formData.gradeLevel}
                    onValueChange={(value) =>
                      setFormData({ ...formData, gradeLevel: value })
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger id="gradeLevel">
                      <SelectValue placeholder="Select grade level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="KINDERGARTEN">Kindergarten</SelectItem>
                      {[...Array(12)].map((_, i) => (
                        <SelectItem key={i + 1} value={`GRADE_${i + 1}`}>
                          Grade {i + 1}
                        </SelectItem>
                      ))}
                      <SelectItem value="FRESHMAN">Freshman</SelectItem>
                      <SelectItem value="SOPHOMORE">Sophomore</SelectItem>
                      <SelectItem value="JUNIOR">Junior</SelectItem>
                      <SelectItem value="SENIOR">Senior</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2">
                    <School className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-sm">
                      {student.gradeLevel
                        ? student.gradeLevel
                            .split('_')
                            .map(
                              (word) =>
                                word.charAt(0) + word.slice(1).toLowerCase()
                            )
                            .join(' ')
                        : 'Not specified'}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="schoolName"
                  className="text-xs text-muted-foreground"
                >
                  School Name
                </Label>
                {isEditing ? (
                  <Input
                    id="schoolName"
                    value={formData.schoolName}
                    onChange={(e) =>
                      setFormData({ ...formData, schoolName: e.target.value })
                    }
                    disabled={isPending}
                  />
                ) : (
                  <p className="text-sm">
                    {student.schoolName || 'Not provided'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Batch Information */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Users className="h-4 w-4" />
              Batch & Status
            </h3>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label
                  htmlFor="batch"
                  className="text-xs text-muted-foreground"
                >
                  Assigned Batch
                </Label>
                {isEditing ? (
                  <Select
                    value={formData.batchId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, batchId: value })
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger id="batch">
                      <SelectValue placeholder="Select batch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {batches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div>
                    {student.Batch ? (
                      <Badge variant="outline" className="font-normal">
                        {student.Batch.name}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="font-normal">
                        Unassigned
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <div>
                  <Badge
                    variant={
                      student.status === 'enrolled' ||
                      student.status === 'registered'
                        ? 'default'
                        : 'secondary'
                    }
                    className="font-normal"
                  >
                    {getStudentStatusDisplay(student.status as any)}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="monthlyRate"
                  className="text-xs text-muted-foreground"
                >
                  Monthly Rate
                </Label>
                {isEditing ? (
                  <Input
                    id="monthlyRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.monthlyRate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        monthlyRate: parseFloat(e.target.value) || 0,
                      })
                    }
                    disabled={isPending}
                  />
                ) : (
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">${student.monthlyRate}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sibling Information (View Only) */}
          {student.Sibling && student.Sibling.Student.length > 0 && (
            <div className="space-y-4 border-t pt-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Users className="h-4 w-4" />
                Siblings ({student.Sibling.Student.length})
              </h3>
              <div className="space-y-2">
                {student.Sibling.Student.map((sibling) => (
                  <div
                    key={sibling.id}
                    className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                  >
                    <span className="text-sm font-medium">{sibling.name}</span>
                    <Badge variant="outline" className="text-xs font-normal">
                      {getStudentStatusDisplay(sibling.status as any)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row-reverse">
              <Button
                onClick={handleSave}
                disabled={isPending || !formData.name}
              >
                <Save className="mr-2 h-4 w-4" />
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isPending}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
