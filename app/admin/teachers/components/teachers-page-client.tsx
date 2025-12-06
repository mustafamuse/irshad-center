'use client'

import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'

import { TeacherWithDetails } from '../actions'
import { CreateTeacherDialog } from './create-teacher-dialog'
import { TeacherList } from './teacher-list'

interface Props {
  teachers: TeacherWithDetails[]
}

export function TeachersPageClient({ teachers }: Props) {
  const router = useRouter()

  function handleRefresh() {
    router.refresh()
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teachers</h1>
          <p className="mt-2 text-muted-foreground">
            Manage teachers and their program assignments
          </p>
        </div>
        <CreateTeacherDialog onSuccess={handleRefresh}>
          <Button>Create Teacher</Button>
        </CreateTeacherDialog>
      </div>

      <TeacherList teachers={teachers} onTeacherUpdated={handleRefresh} />
    </>
  )
}
