'use client'

import { useEffect } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Pencil } from 'lucide-react'
import { useForm } from 'react-hook-form'

import { NameFields } from '@/components/registration/shared/NameFields'
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
import { splitFullName } from '../../_utils/name-formatting'
import { updateChildInfo } from '../../actions'
import { GradeLevelSelect } from '../shared/grade-level-select'

interface EditChildDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: string
  currentData: {
    name: string
    gender: 'MALE' | 'FEMALE'
    dateOfBirth: Date | null
    gradeLevel: string
    schoolName: string | null
    healthInfo: string | null
  }
}

export function EditChildDialog({
  open,
  onOpenChange,
  studentId,
  currentData,
}: EditChildDialogProps) {
  // Split full name into firstName and lastName
  const { firstName, lastName } = splitFullName(currentData.name)

  const form = useForm<ChildFormValues>({
    resolver: zodResolver(childFormSchema),
    defaultValues: {
      firstName,
      lastName,
      gender: currentData.gender,
      dateOfBirth: currentData.dateOfBirth
        ? new Date(currentData.dateOfBirth).toISOString().split('T')[0]
        : '',
      gradeLevel: currentData.gradeLevel as ChildFormValues['gradeLevel'],
      schoolName: currentData.schoolName || '',
      healthInfo: currentData.healthInfo || '',
    },
  })

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open && currentData) {
      const { firstName: splitFirst, lastName: splitLast } = splitFullName(
        currentData.name
      )
      form.reset({
        firstName: splitFirst,
        lastName: splitLast,
        gender: currentData.gender,
        dateOfBirth: currentData.dateOfBirth
          ? new Date(currentData.dateOfBirth).toISOString().split('T')[0]
          : '',
        gradeLevel: currentData.gradeLevel as ChildFormValues['gradeLevel'],
        schoolName: currentData.schoolName || '',
        healthInfo: currentData.healthInfo || '',
      })
    }
  }, [open, currentData, form])

  // Hook for handling child update
  const { execute: executeUpdate, isPending: isUpdating } = useActionHandler(
    updateChildInfo,
    {
      successMessage: 'Child information updated successfully!',
      onSuccess: () => {
        onOpenChange(false)
        form.reset()
      },
    }
  )

  const onSubmit = async (values: ChildFormValues) => {
    await executeUpdate({
      studentId,
      firstName: values.firstName,
      lastName: values.lastName,
      gender: values.gender,
      dateOfBirth: values.dateOfBirth
        ? new Date(values.dateOfBirth)
        : undefined,
      gradeLevel: values.gradeLevel,
      schoolName: values.schoolName || undefined,
      healthInfo: values.healthInfo || null,
    })
  }

  const handleClose = () => {
    if (!isUpdating) {
      form.reset()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-blue-600" />
            Edit Child Information
          </DialogTitle>
          <DialogDescription className="pt-2">
            Update the child's information below.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <NameFields
              control={form.control}
              firstNameField="firstName"
              lastNameField="lastName"
              firstNameLabel="First Name"
              lastNameLabel="Last Name"
              firstNamePlaceholder="Child's first name"
              lastNamePlaceholder="Child's last name"
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
                    disabled={isUpdating}
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
                    <Input type="date" {...field} disabled={isUpdating} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <GradeLevelSelect
              control={form.control}
              name="gradeLevel"
              disabled={isUpdating}
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
                      disabled={isUpdating}
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
                      disabled={isUpdating}
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
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
