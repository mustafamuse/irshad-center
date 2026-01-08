'use client'

import { TeacherWithDetails } from '../actions'
import { TeachersDashboard } from './teachers-dashboard'

interface Props {
  teachers: TeacherWithDetails[]
}

export function TeachersPageClient({ teachers }: Props) {
  return <TeachersDashboard teachers={teachers} />
}
