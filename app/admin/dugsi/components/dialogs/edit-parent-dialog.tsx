'use client'

import { useEffect } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Pencil } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

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

import { useActionHandler } from '../../_hooks/use-action-handler'
import { updateParentInfo, addSecondParent } from '../../actions'

const parentFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required'),
})

type ParentFormValues = z.infer<typeof parentFormSchema>

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
      phone: currentData?.phone || '',
    },
  })

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open && currentData) {
      form.reset({
        firstName: currentData.firstName || '',
        lastName: currentData.lastName || '',
        email: currentData.email || '',
        phone: currentData.phone || '',
      })
    }
  }, [open, currentData, form])

  // Hook for handling parent update
  const { execute: executeUpdate, isPending: isUpdating } = useActionHandler(
    isAddingSecondParent ? addSecondParent : updateParentInfo,
    {
      successMessage: isAddingSecondParent
        ? 'Second parent added successfully!'
        : 'Parent information updated successfully!',
      onSuccess: () => {
        onOpenChange(false)
        form.reset()
      },
    }
  )

  const onSubmit = async (values: ParentFormValues) => {
    if (isAddingSecondParent) {
      // addSecondParent has different signature - doesn't need parentNumber
      await executeUpdate({
        studentId,
        ...values,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    } else {
      await executeUpdate({
        studentId,
        parentNumber,
        ...values,
      })
    }
  }

  const handleClose = () => {
    if (!isUpdating) {
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
                    <Input
                      placeholder="John"
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
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Doe" {...field} disabled={isUpdating} />
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
                      disabled={isUpdating}
                    />
                  </FormControl>
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
                      placeholder="+1234567890"
                      {...field}
                      disabled={isUpdating}
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
                {isAddingSecondParent ? 'Add Parent' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
