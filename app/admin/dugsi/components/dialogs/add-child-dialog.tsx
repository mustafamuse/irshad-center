'use client'

import { useEffect } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, UserPlus } from 'lucide-react'
import { useForm } from 'react-hook-form'

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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { useActionHandler } from '../../_hooks/use-action-handler'
import {
  childFormSchema,
  type ChildFormValues,
} from '../../_schemas/dialog-schemas'
import { addChildToFamily } from '../../actions'

interface AddChildDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingStudentId: string
}

export function AddChildDialog({
  open,
  onOpenChange,
  existingStudentId,
}: AddChildDialogProps) {
  const form = useForm<ChildFormValues>({
    resolver: zodResolver(childFormSchema),
    defaultValues: {
      name: '',
      gender: 'MALE',
      dateOfBirth: '',
      educationLevel: 'ELEMENTARY',
      gradeLevel: 'KINDERGARTEN',
      schoolName: '',
      healthInfo: '',
    },
  })

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset()
    }
  }, [open, form])

  // Hook for handling child addition
  const { execute: executeAdd, isPending: isAdding } = useActionHandler(
    addChildToFamily,
    {
      successMessage: 'Child added to family successfully!',
      onSuccess: () => {
        onOpenChange(false)
        form.reset()
      },
    }
  )

  const onSubmit = async (values: ChildFormValues) => {
    await executeAdd({
      existingStudentId,
      name: values.name,
      gender: values.gender,
      dateOfBirth: values.dateOfBirth
        ? new Date(values.dateOfBirth)
        : undefined,
      educationLevel: values.educationLevel,
      gradeLevel: values.gradeLevel,
      schoolName: values.schoolName || undefined,
      healthInfo: values.healthInfo || null,
    })
  }

  const handleClose = () => {
    if (!isAdding) {
      form.reset()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-green-600" />
            <DialogTitle>Add Child to Family</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Add a new child to this family. Parent information will be copied
            from existing siblings.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Child's name"
                      {...field}
                      disabled={isAdding}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isAdding}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth (Optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} disabled={isAdding} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="educationLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Education Level</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isAdding}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select education level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ELEMENTARY">Elementary</SelectItem>
                      <SelectItem value="MIDDLE_SCHOOL">
                        Middle School
                      </SelectItem>
                      <SelectItem value="HIGH_SCHOOL">High School</SelectItem>
                      <SelectItem value="COLLEGE">College</SelectItem>
                      <SelectItem value="POST_GRAD">Post Grad</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gradeLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grade Level</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isAdding}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select grade level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="KINDERGARTEN">Kindergarten</SelectItem>
                      <SelectItem value="GRADE_1">Grade 1</SelectItem>
                      <SelectItem value="GRADE_2">Grade 2</SelectItem>
                      <SelectItem value="GRADE_3">Grade 3</SelectItem>
                      <SelectItem value="GRADE_4">Grade 4</SelectItem>
                      <SelectItem value="GRADE_5">Grade 5</SelectItem>
                      <SelectItem value="GRADE_6">Grade 6</SelectItem>
                      <SelectItem value="GRADE_7">Grade 7</SelectItem>
                      <SelectItem value="GRADE_8">Grade 8</SelectItem>
                      <SelectItem value="GRADE_9">Grade 9</SelectItem>
                      <SelectItem value="GRADE_10">Grade 10</SelectItem>
                      <SelectItem value="GRADE_11">Grade 11</SelectItem>
                      <SelectItem value="GRADE_12">Grade 12</SelectItem>
                      <SelectItem value="FRESHMAN">Freshman</SelectItem>
                      <SelectItem value="SOPHOMORE">Sophomore</SelectItem>
                      <SelectItem value="JUNIOR">Junior</SelectItem>
                      <SelectItem value="SENIOR">Senior</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="schoolName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>School Name (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="School name"
                      {...field}
                      disabled={isAdding}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="healthInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Health Information (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any health concerns or allergies..."
                      {...field}
                      disabled={isAdding}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isAdding}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isAdding}>
                {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Child
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
