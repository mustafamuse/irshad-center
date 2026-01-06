'use client'

import { useState, useTransition } from 'react'

import { Loader2, Pencil } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  PROGRAM_LABELS,
  PROGRAM_BADGE_COLORS,
} from '@/lib/constants/program-ui'
import { formatPhoneNumber } from '@/lib/utils/formatters'

import {
  TeacherWithDetails,
  updateTeacherDetailsAction,
  deactivateTeacherAction,
} from '../actions'

interface Props {
  teacher: TeacherWithDetails
  onUpdate?: (updated: TeacherWithDetails) => void
  onDeactivate?: () => void
}

export function TeacherDetailsTab({ teacher, onUpdate, onDeactivate }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isDeactivating, startDeactivating] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [deactivateError, setDeactivateError] = useState<string | null>(null)

  const [name, setName] = useState(teacher.name)
  const [email, setEmail] = useState(teacher.email || '')
  const [phone, setPhone] = useState(teacher.phone || '')

  function handleCancel() {
    setName(teacher.name)
    setEmail(teacher.email || '')
    setPhone(teacher.phone || '')
    setError(null)
    setIsEditing(false)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateTeacherDetailsAction({
        teacherId: teacher.id,
        name,
        email: email || undefined,
        phone: phone || undefined,
      })

      if (result.success && result.data) {
        setIsEditing(false)
        onUpdate?.(result.data)
      } else {
        setError(result.error || 'Failed to update')
      }
    })
  }

  function handleDeactivate() {
    setDeactivateError(null)
    startDeactivating(async () => {
      const result = await deactivateTeacherAction(teacher.id)
      if (result.success) {
        onDeactivate?.()
      } else {
        setDeactivateError(result.error || 'Failed to deactivate')
      }
    })
  }

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="space-y-4 rounded-lg border p-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email (optional)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone (optional)"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={isPending || !name.trim()}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-medium">{teacher.name}</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="h-8 w-8 p-0"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="text-sm">{teacher.email || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Phone</p>
            <p className="text-sm">{formatPhoneNumber(teacher.phone)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Active Classes</p>
            <p className="text-sm">{teacher.classCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Joined</p>
            <p className="text-sm">
              {new Date(teacher.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="mt-4 border-t pt-4">
          <p className="mb-2 text-xs text-muted-foreground">Programs</p>
          <div className="flex flex-wrap gap-1">
            {teacher.programs.length > 0 ? (
              teacher.programs.map((program) => (
                <Badge
                  key={program}
                  variant={PROGRAM_BADGE_COLORS[program]}
                  className="text-xs"
                >
                  {PROGRAM_LABELS[program]}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">
                No programs assigned
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-red-800">Deactivate</p>
            <p className="text-xs text-red-600">
              Remove from Dugsi (requires no active classes)
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeactivate}
            disabled={isDeactivating}
          >
            {isDeactivating && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Deactivate
          </Button>
        </div>
        {deactivateError && (
          <p className="mt-2 text-xs font-medium text-red-800">
            {deactivateError}
          </p>
        )}
      </div>
    </div>
  )
}
