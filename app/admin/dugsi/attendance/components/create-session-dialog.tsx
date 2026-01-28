'use client'

import { useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { CreateSessionSchema } from '@/lib/validations/attendance'

import { createSession } from '../actions'

function getUpcomingWeekendDates(count: number): Date[] {
  const dates: Date[] = []
  const today = new Date()
  const current = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  )
  while (dates.length < count) {
    const day = current.getDay()
    if (day === 0 || day === 6) {
      dates.push(new Date(current))
    }
    current.setDate(current.getDate() + 1)
  }
  return dates
}

type FormData = {
  classId: string
  date: string
  notes?: string
}

interface Props {
  classes: { id: string; name: string; shift: string; label: string }[]
}

export function CreateSessionDialog({ classes }: Props) {
  const [open, setOpen] = useState(false)
  const form = useForm<FormData>({
    resolver: zodResolver(CreateSessionSchema),
  })

  async function onSubmit(data: FormData) {
    const result = await createSession(data)
    if (result.success) {
      setOpen(false)
      form.reset()
      toast.success('Session created successfully')
    } else {
      toast.error(result.error || 'Failed to create session')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="min-h-[44px] w-full sm:w-auto">
          Create Session
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Weekend Session</DialogTitle>
          <DialogDescription>
            Create a new weekend study session for attendance tracking.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="classId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Class</FormLabel>
                  <Select
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a class" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
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
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <Select
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a weekend date" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {getUpcomingWeekendDates(8).map((date) => (
                        <SelectItem
                          key={date.toISOString()}
                          value={format(date, 'yyyy-MM-dd')}
                        >
                          {format(date, 'EEEE, MMM d')}
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Create Session</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
