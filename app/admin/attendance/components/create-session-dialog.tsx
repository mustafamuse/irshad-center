'use client'

import { useState, useEffect } from 'react'

import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface ClassSchedule {
  id: string
  subject: { name: string }
  batch: { name: string }
  daysOfWeek: string[]
  startTime: string
  endTime: string
}

interface CreateSessionDialogProps {
  children: React.ReactNode
}

export function CreateSessionDialog({ children }: CreateSessionDialogProps) {
  const [open, setOpen] = useState(false)
  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  const [formData, setFormData] = useState({
    classScheduleId: '',
    date: undefined as Date | undefined,
    startTime: '',
    endTime: '',
    notes: '',
  })

  useEffect(() => {
    if (open) {
      fetchSchedules()
    }
  }, [open])

  async function fetchSchedules() {
    setLoading(true)
    try {
      // For now, we'll need to create an endpoint to fetch schedules
      // This is a placeholder - you might need to implement this endpoint
      const response = await fetch('/api/admin/schedules?weekendsOnly=true')
      if (response.ok) {
        const data = await response.json()
        setSchedules(data)
      }
    } catch (error) {
      console.error('Error fetching schedules:', error)
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormData({
      classScheduleId: '',
      date: undefined,
      startTime: '',
      endTime: '',
      notes: '',
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (
      !formData.classScheduleId ||
      !formData.date ||
      !formData.startTime ||
      !formData.endTime
    ) {
      toast.error('Please fill in all required fields')
      return
    }

    setCreating(true)
    try {
      // Create datetime objects for the session
      const sessionDate = new Date(formData.date)
      const [startHour, startMinute] = formData.startTime.split(':')
      const [endHour, endMinute] = formData.endTime.split(':')

      const startTime = new Date(sessionDate)
      startTime.setHours(parseInt(startHour), parseInt(startMinute), 0, 0)

      const endTime = new Date(sessionDate)
      endTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0)

      const response = await fetch('/api/admin/attendance/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classScheduleId: formData.classScheduleId,
          date: sessionDate.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          notes: formData.notes || undefined,
        }),
      })

      if (response.ok) {
        toast.success('Session created successfully')
        resetForm()
        setOpen(false)
        // Refresh the page or emit an event to refresh the sessions list
        window.location.reload()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create session')
      }
    } catch (error) {
      console.error('Error creating session:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to create session'
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Weekend Session</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Class Schedule Selection */}
          <div className="space-y-2">
            <Label htmlFor="schedule">Class Schedule *</Label>
            <Select
              value={formData.classScheduleId}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, classScheduleId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a class schedule" />
              </SelectTrigger>
              <SelectContent>
                {loading ? (
                  <SelectItem value="loading" disabled>
                    Loading schedules...
                  </SelectItem>
                ) : schedules.length === 0 ? (
                  <SelectItem value="no-schedules" disabled>
                    No weekend schedules found
                  </SelectItem>
                ) : (
                  schedules.map((schedule) => (
                    <SelectItem key={schedule.id} value={schedule.id}>
                      {schedule.subject.name} - {schedule.batch.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Session Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !formData.date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.date ? format(formData.date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.date}
                  onSelect={(date) =>
                    setFormData((prev) => ({ ...prev, date }))
                  }
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    startTime: e.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time *</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, endTime: e.target.value }))
                }
                required
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this session..."
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating...' : 'Create Session'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
