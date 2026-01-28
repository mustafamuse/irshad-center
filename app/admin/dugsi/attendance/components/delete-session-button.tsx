'use client'

import { memo } from 'react'

import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import { deleteSession } from '../actions'

interface Props {
  sessionId: string
}

export const DeleteSessionButton = memo(function DeleteSessionButton({
  sessionId,
}: Props) {
  async function handleDelete() {
    if (!confirm('Delete this session and all its records?')) return

    const result = await deleteSession({ sessionId })
    if (result.success) {
      toast.success('Session deleted')
    } else {
      toast.error(result.error || 'Failed to delete session')
    }
  }

  return (
    <Button size="sm" variant="ghost" onClick={handleDelete}>
      <Trash2 className="size-4" />
    </Button>
  )
})
