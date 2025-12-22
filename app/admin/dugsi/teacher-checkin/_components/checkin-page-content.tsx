'use client'

import type { DugsiTeacherDTO } from '@/lib/db/queries/teacher'

import { AdminCheckInsView } from './admin-checkins-view'

interface CheckInPageContentProps {
  teachers: DugsiTeacherDTO[]
}

export function CheckInPageContent({ teachers }: CheckInPageContentProps) {
  return <AdminCheckInsView teachers={teachers} />
}
