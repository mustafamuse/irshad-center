'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import { Shift } from '@prisma/client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ShiftFilterProps {
  currentShift?: Shift
}

export function ShiftFilter({ currentShift }: ShiftFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleShiftChange = (shift: Shift | 'all') => {
    const params = new URLSearchParams(searchParams.toString())
    if (shift === 'all') {
      params.delete('shift')
    } else {
      params.set('shift', shift)
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex gap-2">
      <Button
        variant={!currentShift ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleShiftChange('all')}
        className={cn('transition-all', !currentShift && 'shadow-sm')}
      >
        All
      </Button>
      <Button
        variant={currentShift === 'MORNING' ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleShiftChange('MORNING')}
        className={cn(
          'transition-all',
          currentShift === 'MORNING' && 'shadow-sm'
        )}
      >
        Morning
      </Button>
      <Button
        variant={currentShift === 'AFTERNOON' ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleShiftChange('AFTERNOON')}
        className={cn(
          'transition-all',
          currentShift === 'AFTERNOON' && 'shadow-sm'
        )}
      >
        Afternoon
      </Button>
    </div>
  )
}
