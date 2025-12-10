'use client'

import { useEffect, useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { Shift } from '@prisma/client'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ErrorAlert } from '@/app/admin/_components/error-alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'


import {
  assignTeacherToStudent,
  getAvailableDugsiTeachers,
} from '../../actions'

const assignTeacherSchema = z.object({
  teacherId: z.string().min(1, 'Teacher is required'),
  shift: z.enum(['MORNING', 'AFTERNOON'], {
    required_error: 'Shift is required',
  }),
})

type AssignTeacherForm = z.infer<typeof assignTeacherSchema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: {
    id: string
    name: string
    shift: Shift | null
  }
  onSuccess?: () => void
}

export function AssignTeacherDialog({
  open,
  onOpenChange,
  student,
  onSuccess,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [teachers, setTeachers] = useState<
    Array<{
      id: string
      name: string
      email: string | null
      phone: string | null
    }>
  >([])
  const [loadingTeachers, setLoadingTeachers] = useState(true)

  const form = useForm<AssignTeacherForm>({
    resolver: zodResolver(assignTeacherSchema),
    defaultValues: {
      teacherId: '',
      shift: student.shift ?? undefined,
    },
  })

  useEffect(() => {
    if (open) {
      loadTeachers()
    }
  }, [open])

  async function loadTeachers() {
    setLoadingTeachers(true)
    const result = await getAvailableDugsiTeachers()
    if (result.success && result.data) {
      setTeachers(result.data)
    }
    setLoadingTeachers(false)
  }

  async function onSubmit(data: AssignTeacherForm) {
    setIsSubmitting(true)

    const result = await assignTeacherToStudent({
      teacherId: data.teacherId,
      studentProfileId: student.id,
      shift: data.shift,
    })

    setIsSubmitting(false)

    if (result.success) {
      onOpenChange(false)
      form.reset()
      onSuccess?.()
    } else {
      form.setError('root', {
        message: result.error || 'Failed to assign teacher',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Teacher</DialogTitle>
          <DialogDescription>
            Assign a teacher to {student.name}
            {student.shift && ` for the ${student.shift.toLowerCase()} shift`}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="teacherId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teacher</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={loadingTeachers || isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingTeachers
                              ? 'Loading teachers...'
                              : 'Select a teacher'
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {teachers.length === 0 && !loadingTeachers && (
                        <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                          No teachers available for Dugsi program
                        </div>
                      )}
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          <div>
                            <div className="font-medium">{teacher.name}</div>
                            {teacher.email && (
                              <div className="text-xs text-muted-foreground">
                                {teacher.email}
                              </div>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shift"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shift</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select shift" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="MORNING">Morning</SelectItem>
                      <SelectItem value="AFTERNOON">Afternoon</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.formState.errors.root && (
              <ErrorAlert message={form.formState.errors.root.message} />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Assigning...' : 'Assign Teacher'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
