'use client'

import { useEffect } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, UserPlus } from 'lucide-react'
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
import { addChildToFamily } from '../../actions'
import { GradeLevelSelect } from '../shared/grade-level-select'

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
      firstName: '',
      lastName: '',
      gender: 'MALE',
      dateOfBirth: '',
      gradeLevel: undefined,
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
    if (!isAdding) {
      form.reset()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-green-600" />
            Add Child to Family
          </DialogTitle>
          <DialogDescription className="pt-2">
            Add a new child to this family. Parent information will be copied
            from existing siblings.
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

            <GradeLevelSelect
              control={form.control}
              name="gradeLevel"
              disabled={isAdding}
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
