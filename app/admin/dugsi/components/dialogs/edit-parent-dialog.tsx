'use client'

import { useEffect } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Pencil } from 'lucide-react'
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
import { formatPhoneNumber } from '@/lib/registration/utils/form-utils'

import { useActionHandler } from '../../_hooks/use-action-handler'
import {
  parentFormSchema,
  type ParentFormValues,
} from '../../_schemas/dialog-schemas'
import { formatPhoneForDisplay } from '../../_utils/phone-formatting'
import { updateParentInfo, addSecondParent } from '../../actions'

interface EditParentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: string
  parentNumber: 1 | 2
  currentData?: {
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string | null
  }
  isAddingSecondParent?: boolean
}

export function EditParentDialog({
  open,
  onOpenChange,
  studentId,
  parentNumber,
  currentData,
  isAddingSecondParent = false,
}: EditParentDialogProps) {
  const form = useForm<ParentFormValues>({
    resolver: zodResolver(parentFormSchema),
    defaultValues: {
      firstName: currentData?.firstName || '',
      lastName: currentData?.lastName || '',
      email: currentData?.email || '',
      phone: formatPhoneForDisplay(currentData?.phone),
    },
  })

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open && currentData) {
      form.reset({
        firstName: currentData.firstName || '',
        lastName: currentData.lastName || '',
        email: currentData.email || '',
        phone: formatPhoneForDisplay(currentData.phone),
      })
    }
  }, [open, currentData, form])

  // Hook for handling parent update
  const { execute: executeUpdate, isPending: isUpdating } = useActionHandler(
    updateParentInfo,
    {
      successMessage: 'Parent information updated successfully!',
      onSuccess: () => {
        onOpenChange(false)
        form.reset()
      },
    }
  )

  // Hook for handling second parent addition
  const { execute: executeAddSecond, isPending: isAddingSecond } =
    useActionHandler(addSecondParent, {
      successMessage: 'Second parent added successfully!',
      onSuccess: () => {
        onOpenChange(false)
        form.reset()
      },
    })

  const onSubmit = async (values: ParentFormValues) => {
    if (isAddingSecondParent) {
      // Only allow email when adding new second parent
      await executeAddSecond({
        studentId,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
      })
    } else {
      // Remove email when updating existing parents (emails are immutable)
      await executeUpdate({
        studentId,
        parentNumber,
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
      })
    }
  }

  const isPending = isUpdating || isAddingSecond

  const handleClose = () => {
    if (!isPending) {
      form.reset()
      onOpenChange(false)
    }
  }

  const dialogTitle = isAddingSecondParent
    ? 'Add Second Parent'
    : `Edit Parent ${parentNumber} Information`
  const dialogDescription = isAddingSecondParent
    ? 'Add a second parent to this family. All children will be updated.'
    : `Update parent ${parentNumber} information for the entire family. All children will be updated with the new information.`

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-blue-600" />
            <DialogTitle>{dialogTitle}</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John" {...field} disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Doe" {...field} disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="john@example.com"
                      {...field}
                      disabled={isPending || !isAddingSecondParent}
                    />
                  </FormControl>
                  {!isAddingSecondParent && (
                    <p className="text-xs text-muted-foreground">
                      Email cannot be changed as it's used for family
                      identification and security
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="XXX-XXX-XXXX"
                      {...field}
                      onChange={(e) => {
                        const formatted = formatPhoneNumber(e.target.value)
                        field.onChange(formatted)
                      }}
                      disabled={isPending}
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
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isAddingSecondParent ? 'Add Parent' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
