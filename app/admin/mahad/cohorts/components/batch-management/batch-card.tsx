'use client'

import { useTransition } from 'react'

import { MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BatchWithCount } from '@/lib/types/batch'

import { deleteBatchAction } from '../../actions'

interface BatchCardProps {
  batch: BatchWithCount
}

export function BatchCard({ batch }: BatchCardProps) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${batch.name}"?`)) {
      startTransition(async () => {
        const result = await deleteBatchAction(batch.id)
        if (result.success) {
          toast.success('Cohort deleted successfully')
        } else {
          toast.error(result.error || 'Failed to delete cohort')
        }
      })
    }
  }

  return (
    <Card className="flex flex-col justify-between p-3 transition-all hover:shadow-md sm:p-4">
      <div className="space-y-2 sm:space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="line-clamp-2 text-sm font-medium sm:text-base">
              {batch.name}
            </h3>
            {batch.startDate && (
              <p className="text-xs text-muted-foreground">
                Starts: {new Date(batch.startDate).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            <div className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium">
              {batch.studentCount} student{batch.studentCount !== 1 ? 's' : ''}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={isPending}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={isPending}>
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem disabled={isPending}>
                  Edit Batch
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={handleDelete}
                  disabled={isPending}
                >
                  {isPending ? 'Deleting...' : 'Delete Batch'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </Card>
  )
}
