'use client'

import { useTransition } from 'react'

import { Button } from '@/components/ui/button'

import { logoutTeacher } from '../login/actions'

interface Props {
  teacherName: string
}

export function TeacherHeader({ teacherName }: Props) {
  const [isPending, startTransition] = useTransition()

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">Attendance</h1>
          <p className="text-sm text-muted-foreground">{teacherName}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => startTransition(() => logoutTeacher())}
        >
          {isPending ? 'Logging out\u2026' : 'Logout'}
        </Button>
      </div>
    </header>
  )
}
